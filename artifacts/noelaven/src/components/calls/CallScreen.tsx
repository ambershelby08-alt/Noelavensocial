/**
 * Full-screen video/voice call overlay.
 *
 * Video call layout:
 *   • Ringing  → local camera fills the whole screen
 *   • Active   → large panel (remote by default) + PiP panel (local by default)
 *   • Tap PiP or the swap button to swap which is large / small
 *
 * Stream binding uses callback refs so the correct srcObject is applied at
 * element mount time regardless of whether the stream reference changed.
 * This fixes the "both panels show local video" bug that occurred because
 * the prior useEffect approach didn't re-fire when video elements remounted
 * after the ringing→active layout transition.
 *
 * Voice call: dark-gradient background with avatar + animated rings.
 *
 * Controls auto-hide after 4 s of inactivity; tap anywhere to reveal.
 */
import React, { useRef, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PhoneOff, Mic, MicOff, Video, VideoOff, Volume2, VolumeX, Phone,
  CameraOff, Minimize2, Maximize2, SwitchCamera, ArrowLeftRight,
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
  onMinimize: () => void;
  onSwitchCamera: () => void;
  onToggleSwap: () => void;
}

export function CallScreen({
  call, onEnd, onToggleMute, onToggleCamera, onToggleSpeaker, onMinimize, onSwitchCamera, onToggleSwap,
}: Props) {
  const screenRef  = useRef<HTMLDivElement>(null);
  const hideTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [controlsVisible, setControlsVisible] = useState(true);
  // `swapped` lives in CallState (call.swapped) so it survives remounts.
  const swapped = call.swapped;
  const [isFullscreen, setIsFullscreen]       = useState(false);

  const isVideo       = call.type === 'video';
  const hasRemote     = isVideo && !!call.remoteStream && call.isActive;
  // During ringing for a video call: local cam fills the whole screen.
  const showLocalFull = isVideo && !hasRemote;

  // ── Compute which stream goes in which panel ────────────────────────────────
  // When swapped: local is large, remote is PiP.
  // When not swapped (default): remote is large, local is PiP.
  const largeStream  = hasRemote ? (swapped ? call.localStream  : call.remoteStream) : null;
  const pipStream    = hasRemote ? (swapped ? call.remoteStream : call.localStream)  : null;
  const largeMirrored = hasRemote && swapped;   // mirror when local cam is large
  const pipMirrored   = hasRemote && !swapped;  // mirror when local cam is PiP

  // ── Callback refs — applied at mount time, re-applied when stream changes ──
  // React calls a callback ref with null when the old ref function changes, then
  // calls the new function with the element. This guarantees srcObject is set
  // even when the DOM element mounts into an already-resolved stream.

  const setRingVideo = useCallback((el: HTMLVideoElement | null) => {
    if (el) el.srcObject = call.localStream ?? null;
  }, [call.localStream]);

  const setLargeVideo = useCallback((el: HTMLVideoElement | null) => {
    if (el) el.srcObject = largeStream ?? null;
  }, [largeStream]);

  const setPipVideo = useCallback((el: HTMLVideoElement | null) => {
    if (el) el.srcObject = pipStream ?? null;
  }, [pipStream]);

  // ── Fullscreen ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const handleFullScreen = useCallback(() => {
    if (!document.fullscreenElement) {
      screenRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  // ── Auto-hide controls ─────────────────────────────────────────────────────
  const resetHideTimer = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (hasRemote) {
      hideTimer.current = setTimeout(() => setControlsVisible(false), 4000);
    }
  }, [hasRemote]);

  useEffect(() => {
    resetHideTimer();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [resetHideTimer]);

  useEffect(() => { if (call.isActive) resetHideTimer(); }, [call.isActive, resetHideTimer]);

  return (
    <motion.div
      ref={screenRef}
      key="call-screen"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[200] bg-black text-white select-none overflow-hidden"
      onClick={resetHideTimer}
    >

      {/* ── LAYER 1: fullscreen background ──────────────────────────────────── */}

      {hasRemote ? (
        /* Active video call — large panel (remote or local depending on swap) */
        <video
          ref={setLargeVideo}
          autoPlay playsInline muted={!largeMirrored /* mute local cam audio in large panel */}
          className={cn(
            'absolute inset-0 w-full h-full object-cover',
            largeMirrored && 'scale-x-[-1]',
          )}
        />
      ) : showLocalFull ? (
        /* Ringing video call — local camera fills screen so you see yourself */
        <video
          ref={setRingVideo}
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

      {/* ── LAYER 2: top bar (avatar / status / top-right controls) ─────────── */}
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
            {/* Minimize + Fullscreen — top-right corner */}
            <div className="absolute top-14 right-4 flex gap-2">
              <button
                onClick={e => { e.stopPropagation(); onMinimize(); }}
                className="w-8 h-8 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center"
              >
                <Minimize2 size={14} className="text-white" />
              </button>
              <button
                onClick={e => { e.stopPropagation(); handleFullScreen(); }}
                className="w-8 h-8 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center"
              >
                <Maximize2 size={14} className="text-white" />
              </button>
            </div>

            {/* Avatar — shown for voice calls or before remote video is live */}
            {!hasRemote && (
              <div className="relative mb-4">
                {/* Ringing rings (voice calls only) */}
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

      {/* ── LAYER 3: PiP panel (active video call only) ──────────────────────── */}
      <AnimatePresence>
        {hasRemote && (
          <motion.div
            key="pip"
            initial={{ opacity: 0, scale: 0.75 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.75 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            className="absolute top-16 right-4 z-20 rounded-[18px] overflow-hidden shadow-2xl cursor-pointer"
            style={{
              width: 110,
              height: 160,
              boxShadow: '0 0 0 2px rgba(255,255,255,0.25), 0 8px 32px rgba(0,0,0,0.6)',
            }}
            onClick={e => { e.stopPropagation(); onToggleSwap(); }}
          >
            {(!swapped && call.isCameraOff) ? (
              /* Local cam is in PiP and camera is off */
              <div className="w-full h-full bg-gray-900 flex flex-col items-center justify-center gap-1">
                <CameraOff size={22} className="text-white/50" />
                <span className="text-[9px] text-white/40 font-medium">Camera off</span>
              </div>
            ) : (
              <video
                ref={setPipVideo}
                autoPlay playsInline muted={pipMirrored /* mute own mic echo in PiP */}
                className={cn(
                  'w-full h-full object-cover',
                  pipMirrored && 'scale-x-[-1]',
                )}
              />
            )}

            {/* Swap hint overlay */}
            <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity bg-black/30 rounded-[18px]">
              <ArrowLeftRight size={20} className="text-white drop-shadow" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── LAYER 4: bottom controls ──────────────────────────────────────────── */}
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
            {/* Secondary controls row */}
            <div className="flex justify-center gap-5 mb-8 flex-wrap">
              <ControlBtn
                icon={call.isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                label={call.isMuted ? 'Unmute' : 'Mute'}
                active={call.isMuted}
                onClick={onToggleMute}
              />
              <ControlBtn
                icon={call.isSpeakerOn ? <Volume2 size={20} /> : <VolumeX size={20} />}
                label="Speaker"
                active={!call.isSpeakerOn}
                onClick={onToggleSpeaker}
              />
              {isVideo && (
                <>
                  <ControlBtn
                    icon={call.isCameraOff ? <VideoOff size={20} /> : <Video size={20} />}
                    label={call.isCameraOff ? 'Show' : 'Camera'}
                    active={call.isCameraOff}
                    onClick={onToggleCamera}
                  />
                  <ControlBtn
                    icon={<SwitchCamera size={20} />}
                    label="Flip"
                    active={false}
                    onClick={onSwitchCamera}
                  />
                  {hasRemote && (
                    <ControlBtn
                      icon={<ArrowLeftRight size={20} />}
                      label="Swap"
                      active={swapped}
                      onClick={onToggleSwap}
                    />
                  )}
                </>
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

// ── Control button ─────────────────────────────────────────────────────────────

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
        'w-[54px] h-[54px] rounded-full flex items-center justify-center transition-colors backdrop-blur-sm',
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
