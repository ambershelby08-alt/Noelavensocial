/**
 * useWebRTC — manages the full lifecycle of a WebRTC peer connection.
 *
 * Key behaviours added over the original:
 *  • ICE config fetched from /api/ice-config (STUN + short-lived TURN creds)
 *  • Five call phases: connecting → ringing → connected → reconnecting → failed
 *  • ICE-connection-state machine with 30 s connection timeout and 8 s
 *    reconnection grace before giving up
 *  • ICE restart attempted on 'failed' before tearing down
 *  • Explicit track + sender cleanup on hang-up / failure
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  isFirebaseConfigured,
  createCall,
  answerCall,
  updateCallStatus,
  addIceCandidate,
  subscribeCall,
  subscribeIceCandidates,
  type CallType,
  type CallStatus,
  type LocalCallPhase,
  type CallDoc,
} from '@/lib/callSignaling';
import { getIceConfig } from '@/lib/iceConfig';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CallState {
  callId: string | null;
  status: CallStatus | null;
  /** Local-only phase for UI display. */
  phase: LocalCallPhase | null;
  type: CallType | null;
  remoteId: string | null;
  remoteName: string | null;
  remoteAvatar: string | null;
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
  callId: null, status: null, phase: null, type: null,
  remoteId: null, remoteName: null, remoteAvatar: null,
  duration: 0, isMuted: false, isSpeakerOn: true, isCameraOff: false,
  isRinging: false, isActive: false,
  localStream: null, remoteStream: null,
};

// ─── Timeouts ─────────────────────────────────────────────────────────────────

/** Max time from PC creation to ICE 'connected'. */
const ICE_CONNECT_TIMEOUT_MS  = 30_000;
/** Grace period in ICE 'disconnected' before giving up. */
const ICE_RECONNECT_GRACE_MS  = 8_000;
/** How long to wait for an ICE restart to succeed. */
const ICE_RESTART_TIMEOUT_MS  = 10_000;
/** Ring timeout before marking as missed. */
const RING_TIMEOUT_MS         = 45_000;

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useWebRTC() {
  const { currentUser } = useAuth();
  const [call, setCall]  = useState<CallState>(INITIAL);

  const pcRef    = useRef<RTCPeerConnection | null>(null);
  const localRef = useRef<MediaStream | null>(null);
  const remoteRef = useRef<MediaStream | null>(null);
  const timers   = useRef<{
    interval:   ReturnType<typeof setInterval>  | null;
    demo:       ReturnType<typeof setTimeout>   | null;
    ring:       ReturnType<typeof setTimeout>   | null;
    iceConnect: ReturnType<typeof setTimeout>   | null;
    reconnect:  ReturnType<typeof setTimeout>   | null;
    iceRestart: ReturnType<typeof setTimeout>   | null;
  }>({ interval: null, demo: null, ring: null, iceConnect: null, reconnect: null, iceRestart: null });
  const unsubs   = useRef<Array<() => void>>([]);

  // ── Cleanup ───────────────────────────────────────────────────────────────

  const cleanup = useCallback(() => {
    // Stop all senders (cleaner than just track.stop on some browsers)
    try {
      pcRef.current?.getSenders().forEach(s => {
        try { s.track?.stop(); } catch { /* ignore */ }
      });
    } catch { /* ignore */ }
    pcRef.current?.close();
    pcRef.current = null;

    // Stop local tracks explicitly
    localRef.current?.getTracks().forEach(t => { try { t.stop(); } catch { /* ignore */ } });
    localRef.current  = null;
    remoteRef.current = null;

    unsubs.current.forEach(u => { try { u(); } catch { /* ignore */ } });
    unsubs.current = [];

    // Clear all timers
    const t = timers.current;
    if (t.interval)   { clearInterval(t.interval);   t.interval   = null; }
    if (t.demo)       { clearTimeout(t.demo);         t.demo       = null; }
    if (t.ring)       { clearTimeout(t.ring);         t.ring       = null; }
    if (t.iceConnect) { clearTimeout(t.iceConnect);   t.iceConnect = null; }
    if (t.reconnect)  { clearTimeout(t.reconnect);    t.reconnect  = null; }
    if (t.iceRestart) { clearTimeout(t.iceRestart);   t.iceRestart = null; }

    setCall(INITIAL);
  }, []);

  // ── Duration timer ────────────────────────────────────────────────────────

  const startTimer = useCallback(() => {
    if (timers.current.interval) return; // already running
    timers.current.interval = setInterval(() => {
      setCall(s => ({ ...s, duration: s.duration + 1 }));
    }, 1000);
  }, []);

  // ── ICE connection state machine ──────────────────────────────────────────

  const attachIceHandlers = useCallback((pc: RTCPeerConnection) => {
    // Start connection timeout from PC creation
    timers.current.iceConnect = setTimeout(() => {
      timers.current.iceConnect = null;
      const state = pcRef.current?.iceConnectionState;
      if (state && !['connected', 'completed', 'closed'].includes(state)) {
        console.warn('[WebRTC] ICE connection timeout');
        setCall(s => ({ ...s, phase: 'failed' }));
        cleanup();
      }
    }, ICE_CONNECT_TIMEOUT_MS);

    function handleIceState() {
      const state = pc.iceConnectionState;
      console.debug('[WebRTC] iceConnectionState →', state);

      if (state === 'checking') {
        setCall(s => ({ ...s, phase: 'connecting' }));

      } else if (state === 'connected' || state === 'completed') {
        // Clear all pending ICE timers
        const t = timers.current;
        if (t.iceConnect) { clearTimeout(t.iceConnect); t.iceConnect = null; }
        if (t.reconnect)  { clearTimeout(t.reconnect);  t.reconnect  = null; }
        if (t.iceRestart) { clearTimeout(t.iceRestart); t.iceRestart = null; }

        setCall(s => ({ ...s, phase: 'connected', isActive: true, status: 'active' }));
        startTimer();

      } else if (state === 'disconnected') {
        setCall(s => ({ ...s, phase: 'reconnecting' }));

        // Give the browser a grace period to self-heal before we tear down
        if (!timers.current.reconnect) {
          timers.current.reconnect = setTimeout(() => {
            timers.current.reconnect = null;
            if (pcRef.current?.iceConnectionState === 'disconnected') {
              console.warn('[WebRTC] ICE reconnect grace expired');
              setCall(s => ({ ...s, phase: 'failed' }));
              cleanup();
            }
          }, ICE_RECONNECT_GRACE_MS);
        }

      } else if (state === 'failed') {
        if (timers.current.reconnect) { clearTimeout(timers.current.reconnect); timers.current.reconnect = null; }

        // Attempt ICE restart (works when we are the offer side)
        if (pc.restartIce && pc.signalingState === 'stable') {
          console.info('[WebRTC] ICE failed — attempting restart');
          pc.restartIce();
          setCall(s => ({ ...s, phase: 'reconnecting' }));

          timers.current.iceRestart = setTimeout(() => {
            timers.current.iceRestart = null;
            if (pcRef.current?.iceConnectionState !== 'connected' &&
                pcRef.current?.iceConnectionState !== 'completed') {
              console.warn('[WebRTC] ICE restart failed');
              setCall(s => ({ ...s, phase: 'failed' }));
              cleanup();
            }
          }, ICE_RESTART_TIMEOUT_MS);
        } else {
          setCall(s => ({ ...s, phase: 'failed' }));
          cleanup();
        }

      } else if (state === 'closed') {
        setCall(s => ({ ...s, phase: null }));
      }
    }

    pc.oniceconnectionstatechange = handleIceState;
  }, [cleanup, startTimer]);

  // ── Build RTCPeerConnection (callee path) ─────────────────────────────────

  function buildPc(callId: string, side: 'caller' | 'callee', config: RTCConfiguration) {
    const pc = new RTCPeerConnection(config);
    pcRef.current = pc;

    const remote = new MediaStream();
    remoteRef.current = remote;
    setCall(s => ({ ...s, remoteStream: remote }));

    pc.ontrack = e => {
      e.streams[0].getTracks().forEach(t => remote.addTrack(t));
      setCall(s => ({ ...s, remoteStream: remote }));
    };

    pc.onicecandidate = async ({ candidate }) => {
      if (candidate && isFirebaseConfigured) {
        await addIceCandidate(callId, side, candidate.toJSON()).catch(() => {});
      }
    };

    if (isFirebaseConfigured) {
      const otherSide = side === 'caller' ? 'callee' : 'caller';
      const u = subscribeIceCandidates(callId, otherSide, async c => {
        try {
          if (pc.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(c));
        } catch { /* ignore */ }
      });
      unsubs.current.push(u);
    }

    attachIceHandlers(pc);
    return pc;
  }

  // ── Acquire media ─────────────────────────────────────────────────────────

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
      const ctx  = new AudioContext();
      const dest = ctx.createMediaStreamDestination();
      localRef.current = dest.stream;
      setCall(s => ({ ...s, localStream: dest.stream }));
      return dest.stream;
    }
  }

  // ── Start a call (caller side) ────────────────────────────────────────────

  const startCall = useCallback(async (
    calleeId: string,
    calleeName: string,
    calleeAvatar: string,
    conversationId: string,
    type: CallType
  ) => {
    if (!currentUser || call.callId) return;

    setCall(s => ({
      ...s,
      status: 'ringing', phase: 'ringing', type,
      remoteId: calleeId, remoteName: calleeName, remoteAvatar: calleeAvatar,
      isRinging: true,
    }));

    try {
      const stream = await getMedia(type);

      if (!isFirebaseConfigured) {
        // Demo mode: simulate a connected call after 2 s
        setCall(s => ({ ...s, callId: 'demo-call' }));
        timers.current.demo = setTimeout(() => {
          timers.current.demo = null;
          setCall(s => {
            if (!s.callId) return s;
            return { ...s, status: 'active', phase: 'connected', isActive: true, isRinging: false };
          });
          startTimer();
        }, 2000);
        return;
      }

      // Fetch ICE config (STUN + TURN) — falls back to STUN on failure
      const iceConfig = await getIceConfig();

      const callIdRef = { current: '' };
      const pc = new RTCPeerConnection(iceConfig);
      pcRef.current = pc;

      const remote = new MediaStream();
      remoteRef.current = remote;
      setCall(s => ({ ...s, remoteStream: remote }));

      pc.ontrack = e => {
        e.streams[0].getTracks().forEach(t => remote.addTrack(t));
        setCall(s => ({ ...s, remoteStream: remote }));
      };

      // Queue candidates until callId is available
      const pendingCandidates: RTCIceCandidateInit[] = [];
      pc.onicecandidate = async ({ candidate }) => {
        if (!candidate) return;
        const id = callIdRef.current;
        if (id) {
          await addIceCandidate(id, 'caller', candidate.toJSON()).catch(() => {});
        } else {
          pendingCandidates.push(candidate.toJSON());
        }
      };

      attachIceHandlers(pc);

      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const callId = await createCall(
        currentUser.id, currentUser.displayName, currentUser.avatarUrl ?? '',
        calleeId, conversationId, type, offer
      );
      callIdRef.current = callId;
      setCall(s => ({ ...s, callId }));

      // Flush queued candidates
      for (const c of pendingCandidates) {
        await addIceCandidate(callId, 'caller', c).catch(() => {});
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

      // Ring timeout
      timers.current.ring = setTimeout(() => {
        timers.current.ring = null;
        if (callIdRef.current) updateCallStatus(callIdRef.current, 'missed').catch(() => {});
        cleanup();
      }, RING_TIMEOUT_MS);

    } catch {
      cleanup();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, call.callId, cleanup, startTimer, attachIceHandlers]);

  // ── Answer a call (callee side) ───────────────────────────────────────────

  const answerIncomingCall = useCallback(async (incoming: CallDoc) => {
    if (!currentUser) return;

    setCall(s => ({
      ...s,
      callId: incoming.callId,
      status: 'active',
      phase: 'connecting',
      type: incoming.type,
      remoteId: incoming.callerId,
      remoteName: incoming.callerName,
      remoteAvatar: incoming.callerAvatar,
      isRinging: false,
      isActive: false, // will flip to true once ICE is connected
    }));

    if (!isFirebaseConfigured) {
      setCall(s => ({ ...s, phase: 'connected', isActive: true }));
      startTimer();
      return;
    }

    try {
      const stream    = await getMedia(incoming.type);
      const iceConfig = await getIceConfig();
      const pc        = buildPc(incoming.callId, 'callee', iceConfig);

      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      await pc.setRemoteDescription(new RTCSessionDescription(incoming.offer!));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await answerCall(incoming.callId, answer);
    } catch {
      cleanup();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, cleanup, startTimer, attachIceHandlers]);

  // ── Decline ───────────────────────────────────────────────────────────────

  const declineCall = useCallback(async (callId: string) => {
    if (isFirebaseConfigured) await updateCallStatus(callId, 'declined').catch(() => {});
    cleanup();
  }, [cleanup]);

  // ── End call ──────────────────────────────────────────────────────────────

  const endCall = useCallback(async () => {
    const id = call.callId;
    cleanup(); // dismiss UI immediately
    if (id && id !== 'demo-call' && isFirebaseConfigured) {
      updateCallStatus(id, 'ended').catch(() => {});
    }
  }, [call.callId, cleanup]);

  // ── Media controls ────────────────────────────────────────────────────────

  const toggleMute = useCallback(() => {
    const muted = !call.isMuted;
    localRef.current?.getAudioTracks().forEach(t => { t.enabled = !muted; });
    setCall(s => ({ ...s, isMuted: muted }));
  }, [call.isMuted]);

  const toggleCamera = useCallback(() => {
    const off = !call.isCameraOff;
    localRef.current?.getVideoTracks().forEach(t => { t.enabled = !off; });
    setCall(s => ({ ...s, isCameraOff: off }));
  }, [call.isCameraOff]);

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
