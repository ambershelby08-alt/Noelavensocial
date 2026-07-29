/**
 * Global call context — a single useWebRTC instance shared across the app.
 * AppShell renders CallScreen / FloatingCallWindow / IncomingCallBanner.
 * Chat.tsx calls startCall().
 *
 * ── Phantom call fix ─────────────────────────────────────────────────────────
 *
 * Root causes of phantom incoming calls that were fixed here:
 *
 *  1. Stale closure on active-call check.
 *     The original code used `rtc.call.callId` inside `setIncomingCall`'s
 *     updater.  Because the updater is created once (at effect registration)
 *     it captured a stale value of `rtc.call` from that render — even when an
 *     active call was in progress, the check always saw `callId = null` from
 *     the mount snapshot, allowing phantom calls through.
 *     Fix: sync `rtc.call.callId` into `activeCallIdRef` on every render and
 *     read the ref (not the closure) inside the subscription callback.
 *
 *  2. Stale Firestore `ringing` documents.
 *     If the caller's app crashes or loses connectivity before it can update
 *     the call status, the document stays `ringing` in Firestore forever.
 *     Every time the callee reconnects (refresh, WebSocket resume), Firestore
 *     re-delivers the snapshot and rings the phone again.
 *     Fix: `subscribeIncomingCalls` in callSignaling.ts now auto-expires calls
 *     older than CALL_MAX_RING_AGE_MS before delivering them here.
 *
 *  3. No deduplication across reconnects.
 *     Even a legitimately-aged call that was declined could re-ring if the
 *     callee refreshed before the caller's Firestore update propagated.
 *     Fix: `handledCallIdsRef` (persisted in sessionStorage) records every
 *     call ID that has been answered, declined, or dismissed so it is never
 *     shown again within the same browser session.
 */
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useWebRTC, type CallState } from '@/hooks/useWebRTC';
import { useAuth } from '@/contexts/AuthContext';
import { isFirebaseConfigured } from '@/lib/firebase';
import { subscribeIncomingCalls, cleanupStaleCallsForUser, isCallStale, type CallDoc } from '@/lib/callSignaling';

// ─── Ring tone via Web Audio API ─────────────────────────────────────────────

function createRingOscillator(ctx: AudioContext): { stop: () => void } {
  const gainNode = ctx.createGain();
  gainNode.gain.setValueAtTime(0, ctx.currentTime);
  gainNode.connect(ctx.destination);

  let stopped = false;
  let loopTimeout: ReturnType<typeof setTimeout>;

  function ring() {
    if (stopped) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(660, now + 0.15);
    osc.connect(gainNode);
    gainNode.gain.cancelScheduledValues(now);
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.22, now + 0.05);
    gainNode.gain.setValueAtTime(0.22, now + 0.35);
    gainNode.gain.linearRampToValueAtTime(0, now + 0.45);
    osc.start(now);
    osc.stop(now + 0.5);
    loopTimeout = setTimeout(() => { if (!stopped) ring(); }, 1800);
  }

  ring();
  return {
    stop() {
      stopped = true;
      clearTimeout(loopTimeout);
      gainNode.gain.cancelScheduledValues(ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.05);
      setTimeout(() => { try { ctx.close(); } catch { /* ignore */ } }, 100);
    },
  };
}

// ─── sessionStorage helpers (deduplication across browser reconnects) ─────────

const SESSION_KEY = 'nlv_handled_calls';

function loadHandledCallIds(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveHandledCallIds(ids: Set<string>): void {
  try {
    // Keep only the last 20 IDs to prevent unbounded growth within a session.
    sessionStorage.setItem(SESSION_KEY, JSON.stringify([...ids].slice(-20)));
  } catch { /* ignore — sessionStorage unavailable (e.g. iframe sandboxed) */ }
}

// ─── Context interface ────────────────────────────────────────────────────────

interface CallContextValue {
  call: CallState;
  startCall: (
    calleeId: string, calleeName: string, calleeAvatar: string,
    conversationId: string, type: 'voice' | 'video'
  ) => Promise<void>;
  endCall: () => Promise<void>;
  toggleMute: () => void;
  toggleCamera: () => void;
  toggleSpeaker: () => void;
  toggleMinimize: () => void;
  toggleSwapped: () => void;
  switchCamera: () => Promise<void>;
  /** Present when an incoming call is ringing (before answering). */
  incomingCall: CallDoc | null;
  answerIncoming: () => Promise<void>;
  declineIncoming: () => Promise<void>;
}

const CallContext = createContext<CallContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const rtc = useWebRTC();
  const [incomingCall, setIncomingCall] = useState<CallDoc | null>(null);
  const ringRef = useRef<{ stop: () => void } | null>(null);

  // ── Fix: keep a live ref of the active callId ─────────────────────────────
  // The subscription callback is created once (no deps re-run it). Using
  // `rtc.call.callId` directly inside it causes a stale-closure bug where the
  // value is always the call state at mount time, not the current one.
  // Reading `activeCallIdRef.current` always returns the latest value.
  const activeCallIdRef = useRef<string | null>(null);
  useEffect(() => {
    activeCallIdRef.current = rtc.call.callId;
  });

  // ── Fix: dedup by call ID across reconnects ───────────────────────────────
  // Stores call IDs that this session has already handled (answered/declined/
  // auto-expired) so they never ring a second time within the same tab/session.
  const handledCallIdsRef = useRef<Set<string>>(loadHandledCallIds());

  function markCallHandled(callId: string): void {
    handledCallIdsRef.current.add(callId);
    saveHandledCallIds(handledCallIdsRef.current);
    console.log('[CallContext] Marked call as handled', { callId });
  }

  // Play / stop ring tone whenever incomingCall changes
  useEffect(() => {
    if (incomingCall) {
      try {
        const ctx = new AudioContext();
        ringRef.current = createRingOscillator(ctx);
      } catch {
        // AudioContext may be blocked before user gesture; silently skip
      }
    } else {
      ringRef.current?.stop();
      ringRef.current = null;
    }
    return () => {
      ringRef.current?.stop();
      ringRef.current = null;
    };
  }, [incomingCall]);

  // ── Subscribe to incoming ringing calls from Firestore ────────────────────
  useEffect(() => {
    if (!currentUser || !isFirebaseConfigured) return;

    // ── Startup cleanup: expire any stuck 'ringing' docs BEFORE the reactive
    //    listener fires. This ensures no stale document can even momentarily
    //    flash as an incoming call on page load / reconnect.
    cleanupStaleCallsForUser(currentUser.id).catch(() => {});

    const unsub = subscribeIncomingCalls(currentUser.id, incoming => {
      // ── No incoming call / call ended ─────────────────────────────────────
      if (incoming === null) {
        setIncomingCall(null);
        return;
      }

      // ── Guard: status sanity (Firestore offline cache can deliver docs with
      //    pending-write status that doesn't match the query filter yet) ──────
      if (incoming.status !== 'ringing') {
        console.warn('[CallContext] Received non-ringing call from subscribeIncomingCalls — ignoring', {
          callId: incoming.callId,
          status: incoming.status,
        });
        return;
      }

      // ── Guard: already in a call (use ref — never a stale closure) ────────
      if (activeCallIdRef.current) {
        console.debug('[CallContext] Ignoring incoming call — already in an active call', {
          activeCallId:   activeCallIdRef.current,
          incomingCallId: incoming.callId,
        });
        return;
      }

      // ── Guard: age check (secondary; callSignaling.ts already filters these,
      //    but defence-in-depth prevents edge cases at the UI layer too) ──────
      if (isCallStale(incoming)) {
        console.warn('[CallContext] Ignoring stale call that slipped past signaling filter', {
          callId: incoming.callId,
          ageMs:  Date.now() - incoming.createdAt.getTime(),
        });
        markCallHandled(incoming.callId);
        return;
      }

      // ── Guard: already handled (answered / declined / expired) ───────────
      if (handledCallIdsRef.current.has(incoming.callId)) {
        console.debug('[CallContext] Ignoring already-handled call', { callId: incoming.callId });
        return;
      }

      // ── Guard: ignore calls we ourselves initiated (caller ≠ callee check) ─
      if (incoming.callerId === currentUser.id) {
        console.warn('[CallContext] Received own outgoing call as incoming — ignoring', {
          callId: incoming.callId,
        });
        return;
      }

      // ── All guards passed — ring ──────────────────────────────────────────
      console.log('[Call] State transition', {
        state:          'idle → ringing',
        callId:         incoming.callId,
        callerId:       incoming.callerId,
        callerName:     incoming.callerName,
        calleeId:       currentUser.id,
        conversationId: incoming.conversationId,
        type:           incoming.type,
        createdAt:      incoming.createdAt.toISOString(),
        callAgeMs:      Date.now() - incoming.createdAt.getTime(),
        timestamp:      new Date().toISOString(),
      });

      setIncomingCall(incoming);
    });

    return unsub;
  // Re-subscribe only when the authenticated user changes.
  // Intentionally NOT including rtc.call here — we track that via the ref.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // ── Answer ─────────────────────────────────────────────────────────────────

  async function answerIncoming() {
    if (!incomingCall) return;
    const call = incomingCall;
    markCallHandled(call.callId);
    setIncomingCall(null); // stops ring via useEffect
    console.log('[CallContext] Answering call', {
      state:          'ringing → connecting',
      callId:         call.callId,
      callerId:       call.callerId,
      conversationId: call.conversationId,
      type:           call.type,
      timestamp:      new Date().toISOString(),
    });
    await rtc.answerIncomingCall(call);
  }

  // ── Decline ────────────────────────────────────────────────────────────────

  async function declineIncoming() {
    if (!incomingCall) return;
    const call = incomingCall;
    markCallHandled(call.callId);
    setIncomingCall(null); // stops ring via useEffect
    console.log('[CallContext] Declining call', {
      state:          'ringing → declined',
      callId:         call.callId,
      callerId:       call.callerId,
      conversationId: call.conversationId,
      timestamp:      new Date().toISOString(),
    });
    await rtc.declineCall(call.callId, call.conversationId, call.type);
  }

  return (
    <CallContext.Provider value={{
      call: rtc.call,
      startCall: rtc.startCall,
      endCall: rtc.endCall,
      toggleMute: rtc.toggleMute,
      toggleCamera: rtc.toggleCamera,
      toggleSpeaker: rtc.toggleSpeaker,
      toggleMinimize: rtc.toggleMinimize,
      toggleSwapped: rtc.toggleSwapped,
      switchCamera: rtc.switchCamera,
      incomingCall,
      answerIncoming,
      declineIncoming,
    }}>
      {children}
    </CallContext.Provider>
  );
}

export function useCall(): CallContextValue {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used inside <CallProvider>');
  return ctx;
}
