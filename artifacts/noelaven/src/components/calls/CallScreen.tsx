/**
 * Full-screen video/voice call overlay — Facebook Messenger-style layout.
 *
 * Video call:
 *   • Ringing  → local camera fills the whole screen; remote avatar floats top-centre
 *   • Active   → remote video fills the whole screen; local camera is a corner PiP
 *
 * Voice call: dark-gradient background with avatar + animated rings when ringing.
 *
 * Controls auto-hide after 4 s of inactivity; tap anywhere to reveal them.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PhoneOff, Mic, MicOff, Video, VideoOff, Volume2, VolumeX, Phone,
  CameraOff,
} from 'lucide-react';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { GradientAvatar } from '@/components/ui/GradientAvatar';
import { cn } from '@/lib/utils';
import type { CallState } from '@/hooks/useWebRTC';

function fmtDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

interface Props {
  call: CallState;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleSpeaker: () => void;
}

export function CallScreen({ call, onEnd, onToggleMute, onToggleCamera, onToggleSpeaker }: Props) {
  const localVideoRef  = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const hideTimer      = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [controlsVisible, setControlsVisible] = useState(true);

  const isVideo       = call.type === 'video';
  const hasRemote     = isVideo && !!call.remoteStream && call.isActive;
  const showLocalFull = isVideo && !hasRemote; // ringing: local cam fills screen

  // ── Wire video elements to streams ─────────────────────────────────────────
  useEffect(() => {
    if (localVideoRef.current && call.localStream) {
      localVideoRef.current.srcObject = call.localStream;
    }
  }, [call.localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && call.remoteStream) {
      remoteVideoRef.current.srcObject = call.remoteStream;
    }
  }, [call.remoteStream]);

  // ── Auto-hide controls ─────────────────────────────────────────────────────
  const resetHideTimer = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    // Only auto-hide during an active video call
    if (hasRemote) {
      hideTimer.current = setTimeout(() => setControlsVisible(false), 4000);
    }
  }, [hasRemote]);

  useEffect(() => {
    resetHideTimer();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [resetHideTimer]);

  // Reveal controls when active call starts
  useEffect(() => { if (call.isActive) resetHideTimer(); }, [call.isActive, resetHideTimer]);

  return (
    <motion.div
      key="call-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[200] bg-black text-white select-none overflow-hidden"
      onClick={resetHideTimer}
    >

      {/* ── LAYER 1: fullscreen background ──────────────────────────────── */}

      {hasRemote ? (
        /* Active video call — remote fills screen */
        <video
          ref={remoteVideoRef}
          autoPlay playsInline muted={false}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : showLocalFull ? (
        /* Ringing video call — local camera fills screen (see yourself) */
        <video
          ref={localVideoRef}
          autoPlay playsInline muted
          className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
        />
      ) : (
        /* Voice call — dark gradient */
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(160deg, #0a0a1a 0%, #1a0a2e 50%, #0a0a1a 100%)' }}
        />
      )}

      {/* Subtle dark vignette so controls stay readable over any video */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.45) 100%)' }}
      />

      {/* ── LAYER 2: top bar (avatar / status) ──────────────────────────── */}
      <AnimatePresence>
        {controlsVisible && (
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.22 }}
            className="absolute top-0 inset-x-0 z-10 flex flex-col items-center pt-14 pb-6"
            style={{
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, transparent 100%)',
            }}
          >
            {/* Show avatar only for voice calls or when remote video isn't live yet */}
            {!hasRemote && (
              <div className="relative mb-4">
                {/* Ringing rings (voice) */}
                {call.isRinging && !isVideo && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    {[1, 2, 3].map(i => (
                      <motion.div
                        key={i}
                        className="absolute rounded-full border border-purple-400/40"
                        animate={{ scale: [1, 2.8], opacity: [0.5, 0] }}
                        transition={{ duration: 2, repeat: Infinity, delay: i * 0.65, ease: 'easeOut' }}
                        style={{ width: 120, height: 120 }}
                      />
                    ))}
                  </div>
                )}
                <div className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-white/25 shadow-2xl">
                  {call.remoteAvatar
                    ? <UserAvatar userId={call.remoteId ?? ''} fallbackName={call.remoteName ?? ''} fallbackSrc={call.remoteAvatar} size={96} />
                    : <GradientAvatar name={call.remoteName ?? ''} size={96} />}
                </div>
                {call.isActive && (
                  <motion.div
                    animate={{ scale: [1, 1.35, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-400 ring-2 ring-black"
                  />
                )}
              </div>
            )}

            <p className="text-[22px] font-black text-white drop-shadow">{call.remoteName}</p>

            {/* Status line */}
            {call.phase === 'failed' ? (
              <p className="text-[13px] text-red-400 font-semibold mt-1">Call failed</p>
            ) : call.phase === 'reconnecting' ? (
              <motion.p
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 0.9, repeat: Infinity }}
                className="text-[13px] text-amber-400 font-semibold mt-1"
              >
                Reconnecting…
              </motion.p>
            ) : call.phase === 'connecting' ? (
              <motion.p
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                className="text-[13px] text-blue-300 font-semibold mt-1"
              >
                Connecting…
              </motion.p>
            ) : call.isRinging ? (
              <motion.p
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                className="text-[13px] text-purple-300 font-semibold mt-1"
              >
                {isVideo ? '📹 Video calling…' : '📞 Calling…'}
              </motion.p>
            ) : call.isActive ? (
              <p className="text-[14px] text-green-400 font-bold tabular-nums mt-1 drop-shadow">
                {fmtDuration(call.duration)}
              </p>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── LAYER 3: local camera PiP (active video call only) ──────────── */}
      <AnimatePresence>
        {hasRemote && !call.isCameraOff && (
          <motion.div
            key="pip"
            initial={{ opacity: 0, scale: 0.75 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.75 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="absolute top-16 right-4 z-20 rounded-[18px] overflow-hidden shadow-2xl"
            style={{
              width: 110,
              height: 160,
              boxShadow: '0 0 0 2px rgba(255,255,255,0.25), 0 8px 32px rgba(0,0,0,0.6)',
            }}
          >
            {/* local camera always mirrors (scale-x-[-1]) so it feels natural */}
            <video
              ref={localVideoRef}
              autoPlay playsInline muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Camera-off badge when active video call + camera disabled */}
      {hasRemote && call.isCameraOff && (
        <div className="absolute top-16 right-4 z-20 w-[110px] h-[160px] rounded-[18px] bg-gray-900 flex flex-col items-center justify-center gap-1 shadow-2xl"
          style={{ boxShadow: '0 0 0 2px rgba(255,255,255,0.15)' }}>
          <CameraOff size={24} className="text-white/50" />
          <span className="text-[10px] text-white/40 font-medium">Camera off</span>
        </div>
      )}

      {/* ── LAYER 4: bottom controls ─────────────────────────────────────── */}
      <AnimatePresence>
        {controlsVisible && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ duration: 0.22 }}
            className="absolute bottom-0 inset-x-0 z-10 flex flex-col items-center pb-14 pt-10 px-8"
            style={{
              background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, transparent 100%)',
              paddingBottom: 'max(env(safe-area-inset-bottom, 0px) + 28px, 48px)',
            }}
          >
            {/* Secondary row */}
            <div className="flex justify-center gap-7 mb-8">
              <ControlBtn
                icon={call.isMuted ? <MicOff size={22} /> : <Mic size={22} />}
                label={call.isMuted ? 'Unmute' : 'Mute'}
                active={call.isMuted}
                onClick={onToggleMute}
              />
              <ControlBtn
                icon={call.isSpeakerOn ? <Volume2 size={22} /> : <VolumeX size={22} />}
                label="Speaker"
                active={!call.isSpeakerOn}
                onClick={onToggleSpeaker}
              />
              {isVideo && (
                <ControlBtn
                  icon={call.isCameraOff ? <VideoOff size={22} /> : <Video size={22} />}
                  label={call.isCameraOff ? 'Show' : 'Camera'}
                  active={call.isCameraOff}
                  onClick={onToggleCamera}
                />
              )}
            </div>

            {/* End-call button — large red pill */}
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={(e) => { e.stopPropagation(); onEnd(); }}
              className="w-[72px] h-[72px] rounded-full bg-red-500 flex items-center justify-center shadow-2xl"
              style={{ boxShadow: '0 6px 32px rgba(239,68,68,0.55)' }}
            >
              <PhoneOff size={30} className="text-white" />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Control button ────────────────────────────────────────────────────────────

function ControlBtn({
  icon, label, active, onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.85 }}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      className="flex flex-col items-center gap-2"
    >
      <div className={cn(
        'w-[58px] h-[58px] rounded-full flex items-center justify-center transition-colors backdrop-blur-sm',
        active ? 'bg-white/15' : 'bg-white/25'
      )}>
        {icon}
      </div>
      <span className="text-[11px] text-white/70 font-semibold">{label}</span>
    </motion.button>
  );
}

// ─── Incoming call banner ──────────────────────────────────────────────────────

interface IncomingCallProps {
  callerName: string;
  callerAvatar: string;
  callerId: string;
  type: 'voice' | 'video';
  onAccept: () => void;
  onDecline: () => void;
}

export function IncomingCallBanner({ callerName, callerAvatar, callerId, type, onAccept, onDecline }: IncomingCallProps) {
  return (
    <motion.div
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -100, opacity: 0 }}
      transition={{ type: 'spring', damping: 22, stiffness: 260 }}
      className="fixed top-4 inset-x-4 z-[150] rounded-[22px] overflow-hidden shadow-2xl"
      style={{ background: 'linear-gradient(135deg, #1a0a2e, #0d0d1a)' }}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="relative flex-shrink-0">
          <motion.div
            animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            className="absolute inset-0 rounded-full bg-purple-500"
          />
          <div className="w-12 h-12 rounded-full overflow-hidden relative">
            <UserAvatar userId={callerId} fallbackName={callerName} fallbackSrc={callerAvatar} size={48} />
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-black text-[15px] truncate">{callerName}</p>
          <p className="text-purple-300 text-[12px] font-medium">
            {type === 'voice' ? '📞 Incoming voice call' : '📹 Incoming video call'}
          </p>
        </div>
        <div className="flex gap-2.5 flex-shrink-0">
          <motion.button whileTap={{ scale: 0.88 }} onClick={onDecline}
            className="w-11 h-11 rounded-full bg-red-500/90 flex items-center justify-center">
            <PhoneOff size={18} className="text-white" />
          </motion.button>
          <motion.button whileTap={{ scale: 0.88 }} onClick={onAccept}
            className="w-11 h-11 rounded-full bg-green-500 flex items-center justify-center">
            <Phone size={18} className="text-white" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
