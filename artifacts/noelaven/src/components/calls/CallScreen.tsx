/**
 * Full-screen call overlay — redesigned to match Noelaven reference UI.
 *
 * Voice:  dark bg, centered card with waveform bars + avatar ring + 2×2 controls.
 * Video:  full-screen remote video + rainbow-border PiP + bottom control bar.
 *
 * All stream-binding logic (callback refs) is preserved from the prior
 * implementation to avoid the "both panels show local video" regression.
 */
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PhoneOff, Mic, MicOff, Volume2, VolumeX, Phone,
  VideoOff, MessageSquare, RotateCcw, MoreHorizontal,
  Shield, Grid3X3, UserPlus, CheckCircle2,
} from 'lucide-react';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { GradientAvatar } from '@/components/ui/GradientAvatar';
import type { CallState } from '@/hooks/useWebRTC';

function fmtDuration(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

// ── Animated waveform bars ────────────────────────────────────────────────────
const BAR_HEIGHTS = [0.35, 0.65, 0.90, 0.55, 0.80, 0.45, 0.75, 0.38, 0.60, 0.50];

function Waveform({ side }: { side: 'left' | 'right' }) {
  const bars = side === 'left' ? [...BAR_HEIGHTS].reverse() : BAR_HEIGHTS;
  return (
    <div className="flex items-center gap-[3.5px]">
      {bars.map((h, i) => (
        <motion.div
          key={i}
          className="w-[3px] rounded-full"
          style={{ background: 'linear-gradient(to top, #EC4899, #7C3AED)' }}
          animate={{
            height: [
              `${h * 20}px`,
              `${h * 44}px`,
              `${h * 18}px`,
              `${h * 38}px`,
              `${h * 20}px`,
            ],
          }}
          transition={{
            duration: 1.4 + i * 0.08,
            repeat: Infinity,
            repeatType: 'loop',
            ease: 'easeInOut',
            delay: i * 0.07,
          }}
        />
      ))}
    </div>
  );
}

// ── Control button ────────────────────────────────────────────────────────────
function CtrlBtn({
  icon: Icon,
  label,
  active = false,
  danger = false,
  large = false,
  onPress,
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  danger?: boolean;
  large?: boolean;
  onPress: () => void;
}) {
  const size = large ? 72 : 58;
  const iconSize = large ? 26 : 22;

  const bg = danger
    ? '#EC4899'
    : active
    ? 'rgba(236,72,153,0.18)'
    : 'rgba(255,255,255,0.10)';

  const border = active && !danger ? '1.5px solid rgba(236,72,153,0.5)' : 'none';

  return (
    <motion.button
      whileTap={{ scale: 0.88 }}
      onClick={onPress}
      className="flex flex-col items-center gap-2"
    >
      <div
        className="rounded-full flex items-center justify-center backdrop-blur-sm"
        style={{
          width: size,
          height: size,
          background: bg,
          border,
          boxShadow: danger ? '0 4px 20px rgba(236,72,153,0.5)' : undefined,
        }}
      >
        <Icon size={iconSize} className="text-white" />
      </div>
      <span className="text-[11px] text-white/70 font-medium">{label}</span>
    </motion.button>
  );
}

interface Props {
  call: CallState;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleCamera: () => void;
  onToggleSpeaker: () => void;
  onMinimize: () => void;
  onSwitchCamera: () => void;
  onToggleSwap: () => void;
}

export function CallScreen({
  call, onEnd, onToggleMute, onToggleCamera, onToggleSpeaker, onMinimize, onSwitchCamera, onToggleSwap,
}: Props) {
  const screenRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const swapped = call.swapped;

  const isVideo   = call.type === 'video';
  const hasRemote = isVideo && !!call.remoteStream && call.isActive;
  const showLocalFull = isVideo && !hasRemote;

  const largeStream   = hasRemote ? (swapped ? call.localStream  : call.remoteStream) : null;
  const pipStream     = hasRemote ? (swapped ? call.remoteStream : call.localStream)  : null;
  const largeMirrored = hasRemote && swapped;
  const pipMirrored   = hasRemote && !swapped;

  // ── Callback refs ───────────────────────────────────────────────────────────
  const setRingVideo  = useCallback((el: HTMLVideoElement | null) => {
    if (el) el.srcObject = call.localStream ?? null;
  }, [call.localStream]);

  const setLargeVideo = useCallback((el: HTMLVideoElement | null) => {
    if (el) el.srcObject = largeStream ?? null;
  }, [largeStream]);

  const setPipVideo   = useCallback((el: HTMLVideoElement | null) => {
    if (el) el.srcObject = pipStream ?? null;
  }, [pipStream]);

  // ── Auto-hide controls on video call ───────────────────────────────────────
  const resetHideTimer = useCallback(() => {
    if (!isVideo) return;
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setControlsVisible(true);
    hideTimer.current = setTimeout(() => setControlsVisible(false), 4000);
  }, [isVideo]);

  useEffect(() => {
    if (hasRemote) resetHideTimer();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [hasRemote, resetHideTimer]);

  // ── Status label ────────────────────────────────────────────────────────────
  const statusLabel = (() => {
    if (call.phase === 'failed')       return { text: 'Call failed',      color: '#f87171' };
    if (call.phase === 'reconnecting') return { text: 'Reconnecting…',   color: '#fbbf24' };
    if (call.phase === 'connecting')   return { text: 'Connecting…',     color: '#EC4899' };
    if (call.isRinging)                return { text: isVideo ? 'Video calling…' : 'Calling…', color: '#EC4899' };
    return null;
  })();

  // ─────────────────────────────────────────────────────────────────────────
  // VOICE CALL
  // ─────────────────────────────────────────────────────────────────────────
  if (!isVideo) {
    return (
      <div
        ref={screenRef}
        className="fixed inset-0 z-[200] flex flex-col"
        style={{ background: 'linear-gradient(160deg, #060610 0%, #0e0618 60%, #060610 100%)' }}
      >
        {/* Ambient glow */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)' }} />
          <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 w-72 h-72 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(236,72,153,0.12) 0%, transparent 70%)' }} />
        </div>

        {/* Back / minimize button */}
        <div className="relative z-10 flex items-center pt-14 pb-4 px-5">
          <motion.button whileTap={{ scale: 0.88 }} onClick={onMinimize}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.08)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </motion.button>
        </div>

        {/* ── Main voice card ─────────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col items-center justify-center px-5 -mt-8">
          <div
            className="w-full rounded-[28px] overflow-hidden py-8 px-6"
            style={{
              background: 'rgba(12,10,22,0.85)',
              border: '1.5px solid rgba(236,72,153,0.35)',
              boxShadow: '0 0 60px rgba(124,58,237,0.18), 0 0 30px rgba(236,72,153,0.10)',
              backdropFilter: 'blur(16px)',
            }}
          >
            {/* Status badges row */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)' }}>
                <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                <span className="text-[11px] font-bold text-green-400">
                  {call.isActive ? 'Connected' : 'Connecting'}
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)' }}>
                <Shield size={11} style={{ color: '#A78BFA' }} />
                <span className="text-[11px] font-bold" style={{ color: '#A78BFA' }}>End-to-end Encrypted</span>
              </div>
            </div>

            {/* Avatar + waveform row */}
            <div className="flex items-center justify-center gap-5 mb-5">
              {/* Left waveform */}
              <Waveform side="left" />

              {/* Avatar */}
              <div className="relative flex-shrink-0">
                {/* Ringing pulse rings */}
                {call.isRinging && (
                  <>
                    {[1, 2].map(i => (
                      <motion.div
                        key={i}
                        className="absolute inset-0 rounded-full"
                        style={{ border: '2px solid rgba(236,72,153,0.4)' }}
                        animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
                        transition={{ duration: 2, repeat: Infinity, delay: i * 0.7, ease: 'easeOut' }}
                      />
                    ))}
                  </>
                )}
                {/* Rainbow ring */}
                <div className="p-[3px] rounded-full"
                  style={{ background: 'linear-gradient(135deg, #EC4899, #7C3AED, #2563EB)' }}>
                  <div className="p-[2px] rounded-full bg-[#0c0a16]">
                    {call.remoteAvatar
                      ? <UserAvatar userId={call.remoteId ?? ''} fallbackName={call.remoteName ?? ''} fallbackSrc={call.remoteAvatar} size={112} />
                      : <GradientAvatar name={call.remoteName ?? ''} size={112} />}
                  </div>
                </div>
                {/* Heart badge */}
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full flex items-center justify-center shadow-lg"
                  style={{ background: '#EC4899', border: '2px solid #0c0a16' }}>
                  <span className="text-[14px]">❤️</span>
                </div>
              </div>

              {/* Right waveform */}
              <Waveform side="right" />
            </div>

            {/* Name + handle + status */}
            <div className="text-center mb-6">
              <div className="flex items-center justify-center gap-2 mb-1">
                <p className="text-[22px] font-black text-white">{call.remoteName}</p>
                <CheckCircle2 size={18} style={{ color: '#3B82F6' }} />
              </div>
              {/* handle not in CallState — omit */}
              <p className="text-[13px] text-white/60 mb-1">Voice Call</p>
              {call.isActive ? (
                <p className="text-[20px] font-black tabular-nums" style={{ color: '#EC4899' }}>
                  {fmtDuration(call.duration)}
                </p>
              ) : statusLabel ? (
                <motion.p
                  animate={call.phase === 'failed' ? {} : { opacity: [1, 0.4, 1] }}
                  transition={{ duration: 1.1, repeat: Infinity }}
                  className="text-[14px] font-semibold"
                  style={{ color: statusLabel.color }}
                >
                  {statusLabel.text}
                </motion.p>
              ) : null}
            </div>

            {/* Controls: [Mute] [End Call] [Speaker] / [Keypad] [Add Call] */}
            <div className="flex items-end justify-between px-4">
              {/* Left column */}
              <div className="flex flex-col gap-4">
                <CtrlBtn icon={call.isMuted ? MicOff : Mic} label={call.isMuted ? 'Unmute' : 'Mute'}
                  active={call.isMuted} onPress={onToggleMute} />
                <CtrlBtn icon={call.isSpeakerOn ? Volume2 : VolumeX} label="Speaker"
                  active={call.isSpeakerOn} onPress={onToggleSpeaker} />
              </div>

              {/* Center: End Call */}
              <CtrlBtn icon={PhoneOff} label="End Call" danger large onPress={onEnd} />

              {/* Right column */}
              <div className="flex flex-col gap-4">
                <CtrlBtn icon={Grid3X3} label="Keypad" onPress={() => {}} />
                <CtrlBtn icon={UserPlus} label="Add Call" onPress={() => {}} />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom safe area */}
        <div className="h-10" />

        {/* Media permission warning */}
        {call.mediaPermissionDenied && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute bottom-20 inset-x-4 rounded-[16px] px-4 py-3 text-center"
            style={{ background: 'rgba(251,146,60,0.15)', border: '1px solid rgba(251,146,60,0.3)' }}
          >
            <p className="text-amber-300 text-[12px] font-semibold">
              ⚠️ Mic access denied — the other person can't hear you
            </p>
          </motion.div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // VIDEO CALL
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      ref={screenRef}
      className="fixed inset-0 z-[200] bg-black overflow-hidden"
      onClick={resetHideTimer}
    >
      {/* ── Background / large video ─────────────────────────────────────────── */}
      {showLocalFull ? (
        /* Ringing: local cam fills screen */
        <video
          ref={setRingVideo}
          autoPlay muted playsInline
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
        />
      ) : hasRemote ? (
        /* Active call: remote is large panel */
        <video
          ref={setLargeVideo}
          autoPlay playsInline
          className="absolute inset-0 w-full h-full object-cover"
          style={largeMirrored ? { transform: 'scaleX(-1)' } : undefined}
        />
      ) : (
        /* Connecting: dark gradient */
        <div className="absolute inset-0"
          style={{ background: 'linear-gradient(160deg, #0a0a1a 0%, #1a0a2e 50%, #0a0a1a 100%)' }}>
          {/* Avatar centred while waiting */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <div className="p-[3px] rounded-full"
              style={{ background: 'linear-gradient(135deg, #EC4899, #7C3AED, #2563EB)' }}>
              <div className="p-[2px] rounded-full bg-[#0a0a1a]">
                {call.remoteAvatar
                  ? <UserAvatar userId={call.remoteId ?? ''} fallbackName={call.remoteName ?? ''} fallbackSrc={call.remoteAvatar} size={100} />
                  : <GradientAvatar name={call.remoteName ?? ''} size={100} />}
              </div>
            </div>
            <p className="text-white font-black text-[20px]">{call.remoteName}</p>
            {statusLabel && (
              <motion.p
                animate={{ opacity: [1, 0.4, 1] }}
                transition={{ duration: 1.1, repeat: Infinity }}
                className="text-[14px] font-semibold"
                style={{ color: statusLabel.color }}
              >
                {statusLabel.text}
              </motion.p>
            )}
          </div>
        </div>
      )}

      {/* Dark vignette overlay */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.50) 100%)' }} />

      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {controlsVisible && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
            className="absolute top-0 inset-x-0 z-10 flex items-center justify-between pt-14 pb-5 px-5"
            style={{ background: 'linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)' }}
          >
            {/* Left: green dot + name + timer */}
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                <p className="text-white font-black text-[16px]">{call.remoteName}</p>
              </div>
              {call.isActive && (
                <p className="text-[14px] font-black tabular-nums ml-[18px]"
                  style={{ color: '#EC4899' }}>
                  {fmtDuration(call.duration)}
                </p>
              )}
            </div>
            {/* Right: flip + more */}
            <div className="flex gap-2">
              <motion.button whileTap={{ scale: 0.88 }} onClick={onSwitchCamera}
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}>
                <RotateCcw size={17} className="text-white" />
              </motion.button>
              <motion.button whileTap={{ scale: 0.88 }} onClick={onMinimize}
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(255,255,255,0.12)', backdropFilter: 'blur(8px)' }}>
                <MoreHorizontal size={17} className="text-white" />
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── PiP panel ─────────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {hasRemote && (
          <motion.div
            key="pip"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute bottom-32 right-4 z-10 cursor-pointer"
            style={{
              width: 100, height: 140,
              borderRadius: 16,
              padding: 2,
              background: 'linear-gradient(135deg, #EC4899, #7C3AED, #2563EB)',
            }}
            onClick={e => { e.stopPropagation(); onToggleSwap(); resetHideTimer(); }}
          >
            <div className="w-full h-full rounded-[14px] overflow-hidden bg-black">
              <video
                ref={setPipVideo}
                autoPlay muted playsInline
                className="w-full h-full object-cover"
                style={pipMirrored ? { transform: 'scaleX(-1)' } : undefined}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Bottom controls ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {controlsVisible && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-0 inset-x-0 z-10 pb-10 pt-4 px-6"
            style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.80) 0%, transparent 100%)' }}
          >
            <div className="flex items-end justify-between">
              <CtrlBtn icon={call.isMuted ? MicOff : Mic} label={call.isMuted ? 'Unmute' : 'Mute'}
                active={call.isMuted} onPress={onToggleMute} />
              <CtrlBtn icon={VideoOff} label="Camera Off" active={call.isCameraOff} onPress={onToggleCamera} />
              <CtrlBtn icon={PhoneOff} label="End Call" danger large onPress={onEnd} />
              <CtrlBtn icon={call.isSpeakerOn ? Volume2 : VolumeX} label="Speaker"
                active={call.isSpeakerOn} onPress={onToggleSpeaker} />
              <CtrlBtn icon={MessageSquare} label="Open Chat" onPress={onMinimize} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Permission warning ─────────────────────────────────────────────────── */}
      {call.mediaPermissionDenied && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          className="absolute top-28 inset-x-4 rounded-[16px] px-4 py-3 text-center z-10"
          style={{ background: 'rgba(251,146,60,0.15)', border: '1px solid rgba(251,146,60,0.3)' }}
        >
          <p className="text-amber-300 text-[12px] font-semibold">
            ⚠️ Camera & mic access denied
          </p>
        </motion.div>
      )}
    </div>
  );
}

// ─── Incoming Call Banner ─────────────────────────────────────────────────────

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
      data-testid="incoming-call-banner"
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -100, opacity: 0 }}
      transition={{ type: 'spring', damping: 22, stiffness: 260 }}
      className="fixed top-4 inset-x-4 z-[150] rounded-[22px] overflow-hidden shadow-2xl"
      style={{
        background: 'rgba(12,10,22,0.96)',
        border: '1.5px solid rgba(236,72,153,0.35)',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 30px rgba(236,72,153,0.15)',
      }}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="relative flex-shrink-0">
          {/* Pulse ring */}
          <motion.div
            animate={{ scale: [1, 1.6], opacity: [0.5, 0] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            className="absolute inset-0 rounded-full"
            style={{ background: 'rgba(236,72,153,0.4)' }}
          />
          {/* Rainbow ring around avatar */}
          <div className="p-[2.5px] rounded-full"
            style={{ background: 'linear-gradient(135deg, #EC4899, #7C3AED, #2563EB)' }}>
            <div className="p-[1.5px] rounded-full bg-[#0c0a16]">
              <UserAvatar userId={callerId} fallbackName={callerName} fallbackSrc={callerAvatar} size={44} />
            </div>
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <p data-testid="incoming-caller-name" className="text-white font-black text-[15px] truncate">{callerName}</p>
          <p className="text-[12px] font-medium" style={{ color: '#EC4899' }}>
            {type === 'voice' ? '📞 Incoming voice call' : '📹 Incoming video call'}
          </p>
        </div>
        <div className="flex gap-2.5 flex-shrink-0">
          <motion.button data-testid="decline-call-btn" whileTap={{ scale: 0.88 }} onClick={onDecline}
            className="w-11 h-11 rounded-full flex items-center justify-center"
            style={{ background: 'rgba(239,68,68,0.9)' }}>
            <PhoneOff size={18} className="text-white" />
          </motion.button>
          <motion.button data-testid="accept-call-btn" whileTap={{ scale: 0.88 }} onClick={onAccept}
            className="w-11 h-11 rounded-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #10B981, #059669)' }}>
            <Phone size={18} className="text-white" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
