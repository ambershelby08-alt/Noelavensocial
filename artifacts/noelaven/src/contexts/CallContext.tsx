/**
 * Global call context — a single useWebRTC instance shared across the app.
 * AppShell renders CallScreen / FloatingCallWindow / IncomingCallBanner.
 * Chat.tsx calls startCall().
 */
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useWebRTC, type CallState } from '@/hooks/useWebRTC';
import { useAuth } from '@/contexts/AuthContext';
import { isFirebaseConfigured } from '@/lib/firebase';
import { subscribeIncomingCalls, type CallDoc } from '@/lib/callSignaling';

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
  switchCamera: () => Promise<void>;
  /** Present when an incoming call is ringing (before answering). */
  incomingCall: CallDoc | null;
  answerIncoming: () => Promise<void>;
  declineIncoming: () => Promise<void>;
}

const CallContext = createContext<CallContextValue | null>(null);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const rtc = useWebRTC();
  const [incomingCall, setIncomingCall] = useState<CallDoc | null>(null);
  const ringRef = useRef<{ stop: () => void } | null>(null);

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

  // Subscribe to incoming ringing calls from Firestore
  useEffect(() => {
    if (!currentUser || !isFirebaseConfigured) return;
    const unsub = subscribeIncomingCalls(currentUser.id, incoming => {
      setIncomingCall(prev => {
        // Don't interrupt an active call
        if (rtc.call.callId) return prev;
        return incoming;
      });
    });
    return unsub;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  async function answerIncoming() {
    if (!incomingCall) return;
    const call = incomingCall;
    setIncomingCall(null); // stops ring via useEffect
    await rtc.answerIncomingCall(call);
  }

  async function declineIncoming() {
    if (!incomingCall) return;
    await rtc.declineCall(incomingCall.callId);
    setIncomingCall(null); // stops ring via useEffect
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
