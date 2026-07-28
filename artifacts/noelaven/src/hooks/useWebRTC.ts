/**
 * useWebRTC — manages the full lifecycle of a WebRTC peer connection.
 *
 * Key behaviours:
 *  • ICE config fetched from /api/ice-config (STUN + short-lived TURN creds)
 *  • Five call phases: connecting → ringing → connected → reconnecting → failed
 *  • ICE-connection-state machine with 30 s connection timeout and 20 s
 *    reconnection grace before giving up (increased from 8 s)
 *  • ICE restart attempted on 'failed' on BOTH caller and callee sides
 *  • Callee subscribes to call doc — detects when caller hangs up immediately
 *  • Explicit track + sender cleanup on hang-up / failure
 *  • Minimize and switchCamera controls
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  isFirebaseConfigured,
  createCall,
  answerCall,
  updateCallStatus,
  deleteCall,
  addIceCandidate,
  subscribeCall,
  subscribeIceCandidates,
  type CallType,
  type CallStatus,
  type LocalCallPhase,
  type CallDoc,
} from '@/lib/callSignaling';
import { getIceConfig } from '@/lib/iceConfig';
import { sendMessage as fsSendMessage } from '@/lib/firestore';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CallState {
  callId: string | null;
  conversationId: string | null;
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
  isMinimized: boolean;
  /** Whether local/remote feeds are swapped. Lifted here so it survives remounts. */
  swapped: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  /** True if getUserMedia was denied — shown as a warning in CallScreen. */
  mediaPermissionDenied: boolean;
}

/** Format seconds as M:SS */
function formatCallDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const INITIAL: CallState = {
  callId: null, conversationId: null, status: null, phase: null, type: null,
  remoteId: null, remoteName: null, remoteAvatar: null,
  duration: 0, isMuted: false, isSpeakerOn: true, isCameraOff: false,
  isRinging: false, isActive: false, isMinimized: false, swapped: false,
  localStream: null, remoteStream: null,
  mediaPermissionDenied: false,
};

// ─── Timeouts ─────────────────────────────────────────────────────────────────

/** Max time from PC creation to ICE 'connected'. */
const ICE_CONNECT_TIMEOUT_MS  = 30_000;
/**
 * Grace period in ICE 'disconnected' before giving up.
 * 20 s (was 8 s) — mobile/Wi-Fi networks can take longer to self-heal.
 */
const ICE_RECONNECT_GRACE_MS  = 20_000;
/** How long to wait for an ICE restart to succeed. */
const ICE_RESTART_TIMEOUT_MS  = 15_000;
/** Ring timeout before marking as missed. */
const RING_TIMEOUT_MS         = 45_000;

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useWebRTC() {
  const { currentUser } = useAuth();
  const [call, setCall]  = useState<CallState>(INITIAL);

  const pcRef     = useRef<RTCPeerConnection | null>(null);
  const localRef  = useRef<MediaStream | null>(null);
  const remoteRef = useRef<MediaStream | null>(null);
  const timers    = useRef<{
    interval:   ReturnType<typeof setInterval>  | null;
    demo:       ReturnType<typeof setTimeout>   | null;
    ring:       ReturnType<typeof setTimeout>   | null;
    iceConnect: ReturnType<typeof setTimeout>   | null;
    reconnect:  ReturnType<typeof setTimeout>   | null;
    iceRestart: ReturnType<typeof setTimeout>   | null;
  }>({ interval: null, demo: null, ring: null, iceConnect: null, reconnect: null, iceRestart: null });
  const unsubs    = useRef<Array<() => void>>([]);
  /** Monotonic counter bumped each time a new RTCPeerConnection is created.
   *  Guards stale reconnect timers from tearing down a healthy replacement PC. */
  const pcGenRef  = useRef(0);

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
        console.warn('[WebRTC] ICE connection timeout after 30 s — state:', state);
        setCall(s => ({ ...s, phase: 'failed' }));
        cleanup();
      }
    }, ICE_CONNECT_TIMEOUT_MS);

    function handleIceState() {
      const state      = pc.iceConnectionState;
      const connState  = pc.connectionState;
      const sigState   = pc.signalingState;
      const localTks   = localRef.current?.getTracks().length ?? 0;
      const remoteTks  = remoteRef.current?.getTracks().length ?? 0;
      console.debug(
        `[WebRTC] iceState=${state} connState=${connState} sigState=${sigState}`,
        `localTracks=${localTks} remoteTracks=${remoteTks}`,
      );

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

        // Give the browser a 20 s grace period to self-heal before we tear down.
        // (Was 8 s — too aggressive for mobile/Wi-Fi packet loss.)
        if (!timers.current.reconnect) {
          // Capture PC generation so the timer doesn't fire cleanup if a new
          // peer connection was already created (ICE restart / re-dial).
          const genAtSchedule = pcGenRef.current;
          timers.current.reconnect = setTimeout(() => {
            timers.current.reconnect = null;
            if (
              genAtSchedule === pcGenRef.current &&
              pcRef.current?.iceConnectionState === 'disconnected'
            ) {
              console.warn('[WebRTC] ICE reconnect grace (20 s) expired — hanging up');
              setCall(s => ({ ...s, phase: 'failed' }));
              cleanup();
            }
          }, ICE_RECONNECT_GRACE_MS);
        }

      } else if (state === 'failed') {
        if (timers.current.reconnect) { clearTimeout(timers.current.reconnect); timers.current.reconnect = null; }

        // Attempt ICE restart — works on both caller AND callee sides per the
        // W3C spec (pc.restartIce() is not gated on being the offerer).
        if (pc.restartIce) {
          console.info('[WebRTC] ICE failed — attempting restartIce()');
          try {
            pc.restartIce();
            setCall(s => ({ ...s, phase: 'reconnecting' }));

            timers.current.iceRestart = setTimeout(() => {
              timers.current.iceRestart = null;
              const s = pcRef.current?.iceConnectionState;
              if (s !== 'connected' && s !== 'completed') {
                console.warn('[WebRTC] ICE restart failed after 15 s — hanging up');
                setCall(prev => ({ ...prev, phase: 'failed' }));
                cleanup();
              }
            }, ICE_RESTART_TIMEOUT_MS);
          } catch (err) {
            console.error('[WebRTC] restartIce() threw:', err, '— hanging up');
            setCall(s => ({ ...s, phase: 'failed' }));
            cleanup();
          }
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

  // ── Build RTCPeerConnection (shared helper — used by callee path) ─────────

  // NOTE: declared as a regular function (not useCallback) because it is only
  // called from inside useCallback bodies that already have stable refs.
  function buildPc(callId: string, side: 'caller' | 'callee', config: RTCConfiguration) {
    const pc = new RTCPeerConnection(config);
    pcRef.current = pc;
    // Bump generation so any in-flight reconnect timer knows a new PC exists.
    pcGenRef.current += 1;

    // ── Remote stream — dedicated MediaStream, never shared with local ──────
    const remote = new MediaStream();
    remoteRef.current = remote;
    setCall(s => ({ ...s, remoteStream: remote }));

    pc.ontrack = e => {
      const localTks  = localRef.current?.getTracks().length ?? 0;
      const remoteTks = remote.getTracks().length;
      console.debug(
        `[WebRTC] ontrack side=${side} kind=${e.track.kind}`,
        `streams=${e.streams.length} existingRemoteTracks=${remoteTks} localTracks=${localTks}`,
      );

      // Prefer the stream associated with the track; fall back to bare track.
      const srcStream = e.streams[0];
      if (srcStream) {
        srcStream.getTracks().forEach(t => {
          if (!remote.getTracks().find(x => x.id === t.id)) remote.addTrack(t);
        });
      } else {
        if (!remote.getTracks().find(x => x.id === e.track.id)) remote.addTrack(e.track);
      }

      // Force a new object reference so callback refs in CallScreen re-fire.
      const updated = new MediaStream(remote.getTracks());
      remoteRef.current = updated;
      setCall(s => ({ ...s, remoteStream: updated }));
    };

    pc.onicecandidate = async ({ candidate }) => {
      if (candidate && isFirebaseConfigured) {
        await addIceCandidate(callId, side, candidate.toJSON()).catch(() => {});
      }
    };

    if (isFirebaseConfigured) {
      // Subscribe to the other side's ICE candidates.
      const otherSide = side === 'caller' ? 'callee' : 'caller';
      const u1 = subscribeIceCandidates(callId, otherSide, async c => {
        try {
          if (pc.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(c));
        } catch { /* ignore stale / duplicate candidates */ }
      });
      unsubs.current.push(u1);

      // Callee subscribes to the call doc so it detects when the caller hangs
      // up immediately — without waiting for ICE to time out.
      if (side === 'callee') {
        const u2 = subscribeCall(callId, async remoteDoc => {
          if (!remoteDoc) return;
          if (remoteDoc.status === 'ended' || remoteDoc.status === 'declined') {
            console.log('[WebRTC] Caller ended/declined call — cleaning up callee');
            cleanup();
          }
        });
        unsubs.current.push(u2);
      }
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
      setCall(s => ({ ...s, localStream: stream, mediaPermissionDenied: false }));
      return stream;
    } catch {
      // No permissions — create silent/black fallback and surface the denial to UI
      console.warn('[WebRTC] getUserMedia denied — using silent/black fallback');
      setCall(s => ({ ...s, mediaPermissionDenied: true }));
      try {
        const ctx  = new AudioContext();
        const dest = ctx.createMediaStreamDestination();
        localRef.current = dest.stream;
        setCall(s => ({ ...s, localStream: dest.stream }));
        return dest.stream;
      } catch {
        // AudioContext also unavailable (e.g. in a sandboxed iframe)
        const empty = new MediaStream();
        localRef.current = empty;
        setCall(s => ({ ...s, localStream: empty }));
        return empty;
      }
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
      conversationId,
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
      const hasTurn = iceConfig.iceServers?.some(
        srv => (Array.isArray(srv.urls) ? srv.urls : [srv.urls]).some(
          (u: string) => u.startsWith('turn:') || u.startsWith('turns:'),
        ),
      );
      console.debug('[WebRTC] caller ICE servers:', iceConfig.iceServers?.length, '— TURN present:', hasTurn);

      const callIdRef = { current: '' };

      // ── Build peer connection (caller inline — mirrors buildPc for callee) ─
      const pc = new RTCPeerConnection(iceConfig);
      pcRef.current = pc;

      // Dedicated remote stream — NEVER assign localStream here
      const remote = new MediaStream();
      remoteRef.current = remote;
      setCall(s => ({ ...s, remoteStream: remote }));

      pc.ontrack = e => {
        const remoteTks = remote.getTracks().length;
        console.debug(
          `[WebRTC] caller ontrack kind=${e.track.kind}`,
          `streams=${e.streams.length} existingRemoteTracks=${remoteTks}`,
        );
        const srcStream = e.streams[0];
        if (srcStream) {
          srcStream.getTracks().forEach(t => {
            if (!remote.getTracks().find(x => x.id === t.id)) remote.addTrack(t);
          });
        } else {
          if (!remote.getTracks().find(x => x.id === e.track.id)) remote.addTrack(e.track);
        }
        // New object reference → callback refs in CallScreen re-fire
        const updated = new MediaStream(remote.getTracks());
        remoteRef.current = updated;
        setCall(s => ({ ...s, remoteStream: updated }));
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

      // Subscribe to callee's ICE candidates
      const u1 = subscribeIceCandidates(callId, 'callee', async c => {
        try {
          if (pc.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(c));
        } catch { /* ignore */ }
      });
      unsubs.current.push(u1);

      // Watch for answer / status changes
      const u2 = subscribeCall(callId, async remoteDoc => {
        if (!remoteDoc) return;
        if (remoteDoc.status === 'declined' || remoteDoc.status === 'ended' || remoteDoc.status === 'missed') {
          console.log('[WebRTC] Call status →', remoteDoc.status, '— cleaning up caller');
          cleanup(); return;
        }
        if (remoteDoc.answer && pc.signalingState !== 'stable') {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(remoteDoc.answer));
            setCall(s => ({ ...s, isRinging: false }));
          } catch (err) { console.error('[WebRTC] setRemoteDescription failed:', err); }
        }
      });
      unsubs.current.push(u2);

      // Ring timeout
      timers.current.ring = setTimeout(() => {
        timers.current.ring = null;
        if (callIdRef.current) updateCallStatus(callIdRef.current, 'missed').catch(() => {});
        // Write a missed-call event into the shared conversation so both parties see it.
        // conversationId and type are captured from startCall's parameters (closure).
        if (conversationId && currentUser?.id && isFirebaseConfigured) {
          const callLabel = type === 'video' ? 'Video' : 'Voice';
          fsSendMessage(conversationId, currentUser.id, `Missed ${callLabel.toLowerCase()} call`, 'call', {
            callType: type ?? 'voice',
            callDuration: 0,
            callStatus: 'missed',
          }).catch(() => {});
        }
        cleanup();
      }, RING_TIMEOUT_MS);

    } catch (err) {
      console.error('[WebRTC] startCall error:', err);
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
      conversationId: incoming.conversationId,
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
      const hasTurn   = iceConfig.iceServers?.some(
        srv => (Array.isArray(srv.urls) ? srv.urls : [srv.urls]).some(
          (u: string) => u.startsWith('turn:') || u.startsWith('turns:'),
        ),
      );
      console.debug('[WebRTC] callee ICE servers:', iceConfig.iceServers?.length, '— TURN present:', hasTurn);

      const pc = buildPc(incoming.callId, 'callee', iceConfig);

      stream.getTracks().forEach(t => pc.addTrack(t, stream));
      await pc.setRemoteDescription(new RTCSessionDescription(incoming.offer!));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await answerCall(incoming.callId, answer);
    } catch (err) {
      console.error('[WebRTC] answerIncomingCall error:', err);
      cleanup();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, cleanup, startTimer, attachIceHandlers]);

  // ── Decline ───────────────────────────────────────────────────────────────

  const declineCall = useCallback(async (
    callId: string,
    conversationId?: string,
    callType?: CallType,
  ) => {
    if (isFirebaseConfigured) await updateCallStatus(callId, 'declined').catch(() => {});
    // Write a declined-call event into the shared conversation so both parties see it.
    if (conversationId && currentUser?.id && isFirebaseConfigured) {
      const callLabel = callType === 'video' ? 'Video' : 'Voice';
      fsSendMessage(conversationId, currentUser.id, `Declined ${callLabel.toLowerCase()} call`, 'call', {
        callType: callType ?? 'voice',
        callDuration: 0,
        callStatus: 'declined',
      }).catch(() => {});
    }
    cleanup();
  }, [cleanup, currentUser]);

  // ── End call ──────────────────────────────────────────────────────────────

  const endCall = useCallback(async () => {
    const id       = call.callId;
    const convId   = call.conversationId;
    const duration = call.duration;
    const type     = call.type;
    const wasActive = call.isActive;
    const uid      = currentUser?.id;
    console.log('[WebRTC] endCall — user hung up callId:', id);
    cleanup(); // dismiss UI immediately
    if (id && id !== 'demo-call' && isFirebaseConfigured) {
      updateCallStatus(id, 'ended').catch(() => {});
      // Clean up Firestore call doc + ICE candidates after a short delay
      // (delay gives both sides time to read the 'ended' status first)
      setTimeout(() => deleteCall(id).catch(() => {}), 5000);
    }
    // Inject a call-summary system message into the conversation thread
    if (convId && uid && isFirebaseConfigured && id !== 'demo-call') {
      try {
        const callLabel = type === 'video' ? 'Video' : 'Voice';
        const content = wasActive
          ? `${callLabel} call · ${formatCallDuration(duration)}`
          : `Missed ${callLabel.toLowerCase()} call`;
        await fsSendMessage(convId, uid, content, 'call', {
          callType: type ?? 'voice',
          callDuration: duration,
          callStatus: wasActive ? 'ended' : 'missed',
        });
      } catch {
        // Non-critical — call still ended successfully
      }
    }
  }, [call.callId, call.conversationId, call.duration, call.type, call.isActive, currentUser, cleanup]);

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

  const toggleMinimize = useCallback(() => {
    setCall(s => ({ ...s, isMinimized: !s.isMinimized }));
  }, []);

  const toggleSwapped = useCallback(() => {
    setCall(s => ({ ...s, swapped: !s.swapped }));
  }, []);

  /** Switch between front and rear camera. No-ops safely when:
   *  • no active call, • only one camera, • getUserMedia is denied, or
   *  • the PC/stream becomes null during the async gap. */
  const switchCamera = useCallback(async () => {
    // Guard 1 — must have an active call with a live peer connection and stream.
    const pc    = pcRef.current;
    const local = localRef.current;
    if (!pc || !local) return;

    const videoTrack = local.getVideoTracks()[0];
    if (!videoTrack) return;

    // Guard 2 — enumerate cameras; skip silently if only one is available.
    let videoDevices: MediaDeviceInfo[] = [];
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      videoDevices = (devices ?? []).filter(d => d.kind === 'videoinput');
    } catch {
      // enumerateDevices not supported / permission denied — bail out gracefully.
      console.info('[WebRTC] switchCamera: enumerateDevices unavailable');
      return;
    }
    if (videoDevices.length < 2) {
      console.info('[WebRTC] switchCamera: only one camera available, skipping');
      return;
    }

    const settings      = videoTrack.getSettings() as MediaTrackSettings & { facingMode?: string };
    const currentFacing = settings.facingMode ?? 'user';
    const newFacing     = currentFacing === 'user' ? 'environment' : 'user';

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { exact: newFacing } },
        audio: false,
      });

      // Guard 3 — track must exist in the new stream.
      const newTrack = newStream.getVideoTracks()[0];
      if (!newTrack) {
        newStream.getTracks().forEach(t => t.stop());
        return;
      }

      // Guard 4 — PC may have been replaced during the async getUserMedia gap.
      if (!pcRef.current || !localRef.current) {
        newTrack.stop();
        return;
      }

      // Replace the track in the peer connection without renegotiation.
      const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video');
      if (sender) await sender.replaceTrack(newTrack);

      // Swap track in the local stream.
      localRef.current.removeTrack(videoTrack);
      localRef.current.addTrack(newTrack);
      videoTrack.stop();

      // New MediaStream reference triggers callback refs in CallScreen.
      const updated = new MediaStream(localRef.current.getTracks());
      localRef.current = updated;
      setCall(s => ({ ...s, localStream: updated }));
    } catch (err) {
      console.warn('[WebRTC] switchCamera failed:', err);
    }
  }, []);

  // Cleanup on unmount
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
    toggleMinimize,
    toggleSwapped,
    switchCamera,
  };
}
