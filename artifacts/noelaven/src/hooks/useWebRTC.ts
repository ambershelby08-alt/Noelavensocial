/**
 * useWebRTC — manages the lifecycle of a WebRTC peer connection for voice/video calls.
 *
 * Usage:
 *   const rtc = useWebRTC();
 *   await rtc.startCall(calleeId, conversationId, 'voice');
 *   rtc.answerCall(callId, offer, 'voice');
 *   rtc.endCall();
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  isFirebaseConfigured,
  STUN_CONFIG,
  createCall,
  answerCall,
  updateCallStatus,
  addIceCandidate,
  subscribeCall,
  subscribeIceCandidates,
  type CallType,
  type CallStatus,
  type CallDoc,
} from '@/lib/callSignaling';

export interface CallState {
  callId: string | null;
  status: CallStatus | null;
  type: CallType | null;
  /** The remote user's info (callee when we're calling, caller when we're answering) */
  remoteId: string | null;
  remoteName: string | null;
  remoteAvatar: string | null;
  /** Seconds elapsed (counts up while active) */
  duration: number;
  isMuted: boolean;
  isSpeakerOn: boolean;
  isCameraOff: boolean;
  isRinging: boolean;
  isActive: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
}

const INITIAL: CallState = {
  callId: null, status: null, type: null,
  remoteId: null, remoteName: null, remoteAvatar: null,
  duration: 0, isMuted: false, isSpeakerOn: true, isCameraOff: false,
  isRinging: false, isActive: false,
  localStream: null, remoteStream: null,
};

export function useWebRTC() {
  const { currentUser } = useAuth();
  const [call, setCall] = useState<CallState>(INITIAL);

  const pcRef       = useRef<RTCPeerConnection | null>(null);
  const localRef    = useRef<MediaStream | null>(null);
  const remoteRef   = useRef<MediaStream | null>(null);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const unsubs      = useRef<Array<() => void>>([]);

  // ── Cleanup ────────────────────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
    localRef.current?.getTracks().forEach(t => t.stop());
    localRef.current = null;
    remoteRef.current = null;
    unsubs.current.forEach(u => u());
    unsubs.current = [];
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setCall(INITIAL);
  }, []);

  // ── Duration timer ─────────────────────────────────────────────────────────
  function startTimer() {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCall(s => ({ ...s, duration: s.duration + 1 }));
    }, 1000);
  }

  // ── Build RTCPeerConnection ────────────────────────────────────────────────
  function buildPc(callId: string, side: 'caller' | 'callee') {
    const pc = new RTCPeerConnection(STUN_CONFIG);
    pcRef.current = pc;

    // Gather remote stream
    const remote = new MediaStream();
    remoteRef.current = remote;
    setCall(s => ({ ...s, remoteStream: remote }));

    pc.ontrack = e => {
      e.streams[0].getTracks().forEach(t => remote.addTrack(t));
      setCall(s => ({ ...s, remoteStream: remote, isActive: true, status: 'active' }));
      startTimer();
    };

    // Send ICE candidates
    pc.onicecandidate = async ({ candidate }) => {
      if (candidate && isFirebaseConfigured) {
        await addIceCandidate(callId, side, candidate.toJSON());
      }
    };

    // Apply incoming ICE candidates from the other side
    const otherSide = side === 'caller' ? 'callee' : 'caller';
    if (isFirebaseConfigured) {
      const u = subscribeIceCandidates(callId, otherSide, async (c) => {
        try {
          if (pc.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(c));
        } catch { /* ignore */ }
      });
      unsubs.current.push(u);
    }

    return pc;
  }

  // ── Acquire media ──────────────────────────────────────────────────────────
  async function getMedia(type: CallType): Promise<MediaStream> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video',
      });
      localRef.current = stream;
      setCall(s => ({ ...s, localStream: stream }));
      return stream;
    } catch {
      // No permissions — create silent/black fallback
      const ctx = new AudioContext();
      const dest = ctx.createMediaStreamDestination();
      const stream = dest.stream;
      localRef.current = stream;
      setCall(s => ({ ...s, localStream: stream }));
      return stream;
    }
  }

  // ── Start a call (caller side) ─────────────────────────────────────────────
  const startCall = useCallback(async (
    calleeId: string,
    calleeName: string,
    calleeAvatar: string,
    conversationId: string,
    type: CallType
  ) => {
    if (!currentUser || call.callId) return;

    setCall(s => ({
      ...s, status: 'ringing', type,
      remoteId: calleeId, remoteName: calleeName, remoteAvatar: calleeAvatar,
      isRinging: true,
    }));

    try {
      const stream = await getMedia(type);

      if (!isFirebaseConfigured) {
        // Demo mode: simulate connected call after 2s
        setCall(s => ({ ...s, callId: 'demo-call' }));
        setTimeout(() => {
          setCall(s => ({ ...s, status: 'active', isActive: true, isRinging: false }));
          startTimer();
        }, 2000);
        return;
      }

      // Use a mutable callId ref so the ICE handler can always use the real ID
      const callIdRef = { current: '' };

      const pc = new RTCPeerConnection(STUN_CONFIG);
      pcRef.current = pc;

      const remote = new MediaStream();
      remoteRef.current = remote;
      setCall(s => ({ ...s, remoteStream: remote }));

      pc.ontrack = e => {
        e.streams[0].getTracks().forEach(t => remote.addTrack(t));
        setCall(s => ({ ...s, remoteStream: remote, isActive: true, status: 'active' }));
        startTimer();
      };

      // Gathered candidates — queue them until we have a callId
      const pendingCandidates: RTCIceCandidateInit[] = [];
      pc.onicecandidate = async ({ candidate }) => {
        if (!candidate) return;
        const id = callIdRef.current;
        if (id) {
          await addIceCandidate(id, 'caller', candidate.toJSON());
        } else {
          pendingCandidates.push(candidate.toJSON());
        }
      };

      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const callId = await createCall(
        currentUser.id, currentUser.displayName, currentUser.avatarUrl ?? '',
        calleeId, conversationId, type, offer
      );
      callIdRef.current = callId;
      setCall(s => ({ ...s, callId }));

      // Flush pending candidates
      for (const c of pendingCandidates) {
        await addIceCandidate(callId, 'caller', c);
      }

      // Subscribe to callee's candidates
      const u1 = subscribeIceCandidates(callId, 'callee', async c => {
        try {
          if (pc.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(c));
        } catch { /* ignore */ }
      });
      unsubs.current.push(u1);

      // Watch for answer / status changes
      const u2 = subscribeCall(callId, async remote => {
        if (!remote) return;
        if (remote.status === 'declined' || remote.status === 'ended' || remote.status === 'missed') {
          cleanup(); return;
        }
        if (remote.answer && pc.signalingState !== 'stable') {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(remote.answer));
            setCall(s => ({ ...s, isRinging: false }));
          } catch { /* ignore */ }
        }
      });
      unsubs.current.push(u2);

      // Timeout after 45s → mark missed
      setTimeout(() => {
        if (callIdRef.current) updateCallStatus(callIdRef.current, 'missed').catch(() => {});
        cleanup();
      }, 45_000);

    } catch {
      cleanup();
    }
  }, [currentUser, call.callId, cleanup]);

  // ── Answer a call (callee side) ────────────────────────────────────────────
  const answerIncomingCall = useCallback(async (incoming: CallDoc) => {
    if (!currentUser) return;

    setCall(s => ({
      ...s,
      callId: incoming.callId,
      status: 'active',
      type: incoming.type,
      remoteId: incoming.callerId,
      remoteName: incoming.callerName,
      remoteAvatar: incoming.callerAvatar,
      isRinging: false,
      isActive: true,
    }));

    if (!isFirebaseConfigured) {
      startTimer();
      return;
    }

    try {
      const stream = await getMedia(incoming.type);
      const pc = buildPc(incoming.callId, 'callee');
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      await pc.setRemoteDescription(new RTCSessionDescription(incoming.offer!));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await answerCall(incoming.callId, answer);
      startTimer();
    } catch {
      cleanup();
    }
  }, [currentUser, cleanup]);

  // ── Decline incoming call ──────────────────────────────────────────────────
  const declineCall = useCallback(async (callId: string) => {
    if (isFirebaseConfigured) await updateCallStatus(callId, 'declined').catch(() => {});
    cleanup();
  }, [cleanup]);

  // ── End active call ────────────────────────────────────────────────────────
  const endCall = useCallback(async () => {
    const id = call.callId;
    if (id && isFirebaseConfigured) {
      await updateCallStatus(id, 'ended').catch(() => {});
    }
    cleanup();
  }, [call.callId, cleanup]);

  // ── Toggle mute ────────────────────────────────────────────────────────────
  const toggleMute = useCallback(() => {
    const muted = !call.isMuted;
    localRef.current?.getAudioTracks().forEach(t => { t.enabled = !muted; });
    setCall(s => ({ ...s, isMuted: muted }));
  }, [call.isMuted]);

  // ── Toggle camera ──────────────────────────────────────────────────────────
  const toggleCamera = useCallback(() => {
    const off = !call.isCameraOff;
    localRef.current?.getVideoTracks().forEach(t => { t.enabled = !off; });
    setCall(s => ({ ...s, isCameraOff: off }));
  }, [call.isCameraOff]);

  // ── Toggle speaker ─────────────────────────────────────────────────────────
  const toggleSpeaker = useCallback(() => {
    setCall(s => ({ ...s, isSpeakerOn: !s.isSpeakerOn }));
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  return {
    call,
    startCall,
    answerIncomingCall,
    declineCall,
    endCall,
    toggleMute,
    toggleCamera,
    toggleSpeaker,
  };
}
