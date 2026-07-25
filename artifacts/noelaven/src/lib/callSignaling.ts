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
  updateDoc, onSnapshot, serverTimestamp, query, where,
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
    cb({
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
    });
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

export const STUN_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  ],
};

export { isFirebaseConfigured };
