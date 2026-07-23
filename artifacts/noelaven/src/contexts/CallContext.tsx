/**
 * Global call context — a single useWebRTC instance shared across the app.
 * AppShell renders CallScreen / IncomingCallBanner.
 * Chat.tsx calls startCall().
 */
import React, { createContext, useContext, useEffect, useState } from 'react';
import { useWebRTC, type CallState } from '@/hooks/useWebRTC';
import { useAuth } from '@/contexts/AuthContext';
import { isFirebaseConfigured } from '@/lib/firebase';
import { subscribeIncomingCalls, type CallDoc } from '@/lib/callSignaling';

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

  // Subscribe to incoming ringing calls from Firestore
  useEffect(() => {
    if (!currentUser || !isFirebaseConfigured) return;
    const unsub = subscribeIncomingCalls(currentUser.id, incoming => {
      // Only show if we don't already have an active call
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
    setIncomingCall(null);
    await rtc.answerIncomingCall(call);
  }

  async function declineIncoming() {
    if (!incomingCall) return;
    await rtc.declineCall(incomingCall.callId);
    setIncomingCall(null);
  }

  return (
    <CallContext.Provider value={{
      call: rtc.call,
      startCall: rtc.startCall,
      endCall: rtc.endCall,
      toggleMute: rtc.toggleMute,
      toggleCamera: rtc.toggleCamera,
      toggleSpeaker: rtc.toggleSpeaker,
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
