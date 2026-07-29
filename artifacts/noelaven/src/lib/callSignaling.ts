/**
 * WebRTC call signaling via Firestore.
 *
 * Schema:
 *   calls/{callId}
 *     callerId, callerName, callerAvatar
 *     calleeId
 *     conversationId
 *     type: 'voice' | 'video'
 *     status: 'ringing' | 'active' | 'ended' | 'declined' | 'missed'
 *     offer: RTCSessionDescriptionInit
 *     answer: RTCSessionDescriptionInit
 *     createdAt: Timestamp
 *
 *   calls/{callId}/callerCandidates/{id}  – ICE candidates from caller
 *   calls/{callId}/calleeCandidates/{id}  – ICE candidates from callee
 */

import {
  getFirestore, collection, doc, addDoc, getDoc,
  updateDoc, deleteDoc, getDocs, onSnapshot, serverTimestamp, query, where,
  type Unsubscribe,
} from 'firebase/firestore';
import { isFirebaseConfigured } from '@/lib/firebase';

/** Statuses stored in Firestore and synced between peers. */
export type CallStatus = 'ringing' | 'active' | 'ended' | 'declined' | 'missed';
export type CallType   = 'voice' | 'video';

/**
 * Local-only call phase — drives UI display and is never written to Firestore.
 *
 *  connecting   – ICE gathering / STUN probing in progress
 *  ringing      – offer sent (caller) or received (callee), waiting for answer
 *  connected    – ICE in 'connected' or 'completed', media flowing
 *  reconnecting – ICE in 'disconnected'; attempting to recover
 *  failed       – ICE permanently failed or timed out; call will be torn down
 */
export type LocalCallPhase =
  | 'connecting'
  | 'ringing'
  | 'connected'
  | 'reconnecting'
  | 'failed';

export interface CallDoc {
  callId: string;
  callerId: string;
  callerName: string;
  callerAvatar: string;
  calleeId: string;
  conversationId: string;
  type: CallType;
  status: CallStatus;
  offer?: RTCSessionDescriptionInit;
  answer?: RTCSessionDescriptionInit;
  createdAt: Date;
}

function db() { return getFirestore(); }

/** Caller: create call doc with SDP offer. Returns callId. */
export async function createCall(
  callerId: string,
  callerName: string,
  callerAvatar: string,
  calleeId: string,
  conversationId: string,
  type: CallType,
  offer: RTCSessionDescriptionInit
): Promise<string> {
  const ref = await addDoc(collection(db(), 'calls'), {
    callerId, callerName, callerAvatar,
    calleeId, conversationId, type,
    status: 'ringing',
    offer,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/** Callee: write SDP answer. */
export async function answerCall(callId: string, answer: RTCSessionDescriptionInit): Promise<void> {
  await updateDoc(doc(db(), 'calls', callId), { answer, status: 'active' });
}

/** Either party: update status (ended / declined / missed). */
export async function updateCallStatus(callId: string, status: CallStatus): Promise<void> {
  await updateDoc(doc(db(), 'calls', callId), { status });
}

/**
 * Delete a call document and its ICE candidate sub-collections.
 * Called by the caller after a short delay post-hang-up to avoid data bloat.
 * Fails silently — cleanup is best-effort.
 */
export async function deleteCall(callId: string): Promise<void> {
  try {
    const callRef = doc(db(), 'calls', callId);
    // Delete ICE candidate sub-collections first
    for (const sub of ['callerCandidates', 'calleeCandidates']) {
      const subSnap = await getDocs(collection(db(), 'calls', callId, sub));
      await Promise.all(subSnap.docs.map(d => deleteDoc(d.ref)));
    }
    await deleteDoc(callRef);
  } catch {
    // Best-effort — don't throw
  }
}

/** Add an ICE candidate (caller or callee side). */
export async function addIceCandidate(
  callId: string,
  side: 'caller' | 'callee',
  candidate: RTCIceCandidateInit
): Promise<void> {
  const sub = side === 'caller' ? 'callerCandidates' : 'calleeCandidates';
  await addDoc(collection(db(), 'calls', callId, sub), { ...candidate });
}

/** Fetch call doc snapshot once. */
export async function getCall(callId: string): Promise<CallDoc | null> {
  const snap = await getDoc(doc(db(), 'calls', callId));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    callId: snap.id,
    callerId: d.callerId,
    callerName: d.callerName,
    callerAvatar: d.callerAvatar,
    calleeId: d.calleeId,
    conversationId: d.conversationId,
    type: d.type,
    status: d.status,
    offer: d.offer,
    answer: d.answer,
    createdAt: d.createdAt?.toDate?.() ?? new Date(),
  };
}

/** Subscribe to a specific call doc (for status / answer changes). */
export function subscribeCall(callId: string, cb: (call: CallDoc | null) => void): Unsubscribe {
  return onSnapshot(doc(db(), 'calls', callId), snap => {
    if (!snap.exists()) { cb(null); return; }
    const d = snap.data();
    cb({
      callId: snap.id,
      callerId: d.callerId,
      callerName: d.callerName,
      callerAvatar: d.callerAvatar,
      calleeId: d.calleeId,
      conversationId: d.conversationId,
      type: d.type,
      status: d.status,
      offer: d.offer,
      answer: d.answer,
      createdAt: d.createdAt?.toDate?.() ?? new Date(),
    });
  }, err => console.error('[subscribeCall]', err.code, err.message));
}

/**
 * Calls ringing for longer than this are considered stale.
 * Root cause of phantom calls: if a caller's app crashes before it can update
 * the status to ended/missed, the document stays `ringing` forever.  Every
 * time the callee reconnects, Firestore re-delivers the snapshot and the phone
 * rings again.  We discard any call that is older than this threshold and
 * auto-expire it to `missed` so it is never delivered again.
 */
export const CALL_MAX_RING_AGE_MS = 45_000; // 45 s — matches RING_TIMEOUT_MS in useWebRTC

/** Returns true when a ringing call document is too old to legitimately ring. */
export function isCallStale(call: CallDoc): boolean {
  return Date.now() - call.createdAt.getTime() > CALL_MAX_RING_AGE_MS;
}

/**
 * Eagerly expire every stale `ringing` call document on app startup,
 * BEFORE the reactive `subscribeIncomingCalls` listener delivers them.
 *
 * Why: `subscribeIncomingCalls` expires stale docs when the snapshot arrives.
 * But a stuck doc can momentarily flash to the UI before the TTL check fires.
 * Calling this once on mount wipes the database clean so no ghost docs exist.
 *
 * Covers two roles:
 *   • Callee: docs targeting this user — would ring them directly.
 *   • Caller: docs created by this user that were never cleaned up — they ring
 *     the remote party on every reconnect until the remote's TTL check fires.
 */
export async function cleanupStaleCallsForUser(userId: string): Promise<void> {
  if (!userId) return;
  try {
    // Callee-side: uses the same composite index as subscribeIncomingCalls.
    const calleeSnap = await getDocs(query(
      collection(db(), 'calls'),
      where('calleeId', '==', userId),
      where('status',   '==', 'ringing'),
    ));

    // Caller-side: requires a separate (callerId, status) composite index.
    // Best-effort — skip if the index has not been deployed.
    let callerDocs: typeof calleeSnap.docs = [];
    try {
      const callerSnap = await getDocs(query(
        collection(db(), 'calls'),
        where('callerId', '==', userId),
        where('status',   '==', 'ringing'),
      ));
      callerDocs = callerSnap.docs;
    } catch { /* (callerId, status) index not deployed — reactive TTL still covers this */ }

    const staleDocs = [...calleeSnap.docs, ...callerDocs].filter(d => {
      const ts = d.data().createdAt?.toDate?.() as Date | undefined;
      return ts instanceof Date && Date.now() - ts.getTime() > CALL_MAX_RING_AGE_MS;
    });

    if (staleDocs.length === 0) return;

    console.log('[callSignaling] startup cleanup: expiring', staleDocs.length, 'stale ringing doc(s)', {
      userId,
      callIds: staleDocs.map(d => d.id),
    });
    await Promise.all(staleDocs.map(d =>
      updateDoc(d.ref, { status: 'missed' }).catch(() => {})
    ));
  } catch (err) {
    // Non-critical — reactive TTL check in subscribeIncomingCalls is the backstop.
    console.warn('[callSignaling] cleanupStaleCallsForUser error (non-critical):', err);
  }
}

/** Subscribe to incoming ringing calls for a user. */
export function subscribeIncomingCalls(userId: string, cb: (call: CallDoc | null) => void): Unsubscribe {
  const q = query(
    collection(db(), 'calls'),
    where('calleeId', '==', userId),
    where('status', '==', 'ringing'),
  );
  return onSnapshot(q, snap => {
    if (snap.empty) { cb(null); return; }
    const d = snap.docs[0].data();
    const call: CallDoc = {
      callId: snap.docs[0].id,
      callerId: d.callerId,
      callerName: d.callerName,
      callerAvatar: d.callerAvatar,
      calleeId: d.calleeId,
      conversationId: d.conversationId,
      type: d.type,
      status: d.status,
      offer: d.offer,
      answer: d.answer,
      createdAt: d.createdAt?.toDate?.() ?? new Date(),
    };

    // Auto-expire phantom calls — caller app crashed before updating status.
    // Silently update to 'missed' and tell the subscriber there is no call,
    // so the recipient is never rung by a ghost document on reconnect.
    if (isCallStale(call)) {
      const ageMs = Date.now() - call.createdAt.getTime();
      console.warn('[callSignaling] Auto-expiring stale ringing call', {
        callId: call.callId,
        callerId: call.callerId,
        conversationId: call.conversationId,
        ageMs,
        exceededBy: ageMs - CALL_MAX_RING_AGE_MS,
      });
      updateDoc(doc(db(), 'calls', call.callId), { status: 'missed' }).catch(() => {});
      cb(null);
      return;
    }

    cb(call);
  }, err => console.error('[subscribeIncomingCalls]', err.code, err.message));
}

/** Subscribe to ICE candidates from the other side. */
export function subscribeIceCandidates(
  callId: string,
  side: 'caller' | 'callee',
  cb: (candidate: RTCIceCandidateInit) => void
): Unsubscribe {
  const sub = side === 'caller' ? 'callerCandidates' : 'calleeCandidates';
  return onSnapshot(collection(db(), 'calls', callId, sub), snap => {
    snap.docChanges().forEach(change => {
      if (change.type === 'added') cb(change.doc.data() as RTCIceCandidateInit);
    });
  }, err => console.error('[subscribeIceCandidates]', err.code, err.message));
}

// Re-export the canonical STUN-only config from iceConfig so there is a single
// source of truth. useWebRTC.ts should prefer getIceConfig() and only fall back
// to this when the API call fails.
export { STUN_ONLY as STUN_CONFIG } from '@/lib/iceConfig';

export { isFirebaseConfigured };
