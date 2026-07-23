/**
 * Full-screen overlay shown during an active or ringing call.
 */
import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PhoneOff, Mic, MicOff, Video, VideoOff, Volume2, VolumeX, Phone,
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

  const isVideo = call.type === 'video';

  return (
    <motion.div
      key="call-screen"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[200] flex flex-col bg-gray-950 text-white select-none"
    >
      {/* Background: gradient or remote video */}
      {isVideo && call.remoteStream ? (
        <video
          ref={remoteVideoRef}
          autoPlay playsInline muted={false}
          className="absolute inset-0 w-full h-full object-cover opacity-80"
        />
      ) : (
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(160deg, #0a0a1a 0%, #1a0a2e 50%, #0a0a1a 100%)' }}
        >
          {/* Animated rings when ringing */}
          {call.isRinging && (
            <div className="absolute inset-0 flex items-center justify-center">
              {[1, 2, 3].map(i => (
                <motion.div
                  key={i}
                  className="absolute rounded-full border border-purple-500/30"
                  animate={{ scale: [1, 2.4], opacity: [0.6, 0] }}
                  transition={{ duration: 2, repeat: Infinity, delay: i * 0.6, ease: 'easeOut' }}
                  style={{ width: 140, height: 140 }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Top overlay: status */}
      <div className="relative z-10 flex flex-col items-center pt-20 pb-6">
        {/* Avatar */}
        <div className="relative mb-5">
          <div className="w-28 h-28 rounded-full overflow-hidden ring-4 ring-white/20 shadow-2xl">
            {call.remoteAvatar ? (
              <UserAvatar
                userId={call.remoteId ?? ''}
                fallbackName={call.remoteName ?? ''}
                fallbackSrc={call.remoteAvatar}
                size={112}
              />
            ) : (
              <GradientAvatar name={call.remoteName ?? ''} size={112} />
            )}
          </div>
          {call.isActive && (
            <motion.div
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-green-500 ring-2 ring-gray-950"
            />
          )}
        </div>

        <h2 className="text-[24px] font-black text-white mb-1">{call.remoteName}</h2>

        {/* Status line */}
        {call.isRinging ? (
          <motion.p
            animate={{ opacity: [1, 0.4, 1] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            className="text-[14px] text-purple-300 font-medium"
          >
            {call.type === 'voice' ? '📞 Calling…' : '📹 Video calling…'}
          </motion.p>
        ) : call.isActive ? (
          <p className="text-[15px] text-green-400 font-bold tabular-nums">
            {fmtDuration(call.duration)}
          </p>
        ) : null}
      </div>

      {/* Local video pip (video calls only) */}
      {isVideo && call.localStream && !call.isCameraOff && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute top-24 right-4 z-20 w-[100px] h-[140px] rounded-[16px] overflow-hidden ring-2 ring-white/30 shadow-xl"
        >
          <video ref={localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        </motion.div>
      )}

      {/* Bottom controls */}
      <div className="relative z-10 mt-auto pb-14 pt-8 px-8">
        {/* Secondary controls row */}
        <div className="flex justify-center gap-6 mb-8">
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
            <ControlBtn
              icon={call.isCameraOff ? <VideoOff size={20} /> : <Video size={20} />}
              label={call.isCameraOff ? 'Show' : 'Camera'}
              active={call.isCameraOff}
              onClick={onToggleCamera}
            />
          )}
        </div>

        {/* End call */}
        <div className="flex justify-center">
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={onEnd}
            className="w-[68px] h-[68px] rounded-full bg-red-500 flex items-center justify-center shadow-2xl shadow-red-500/40"
          >
            <PhoneOff size={28} className="text-white" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

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
      whileTap={{ scale: 0.88 }}
      onClick={onClick}
      className="flex flex-col items-center gap-2"
    >
      <div className={cn(
        'w-14 h-14 rounded-full flex items-center justify-center transition-colors',
        active ? 'bg-white/10' : 'bg-white/20'
      )}>
        {icon}
      </div>
      <span className="text-[11px] text-white/60 font-medium">{label}</span>
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
        {/* Pulsing ring around avatar */}
        <div className="relative flex-shrink-0">
          <motion.div
            animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
            transition={{ duration: 1.2, repeat: Infinity }}
            className="absolute inset-0 rounded-full bg-purple-500"
          />
          <div className="w-12 h-12 rounded-full overflow-hidden relative">
            <UserAvatar
              userId={callerId}
              fallbackName={callerName}
              fallbackSrc={callerAvatar}
              size={48}
            />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-white font-black text-[15px] truncate">{callerName}</p>
          <p className="text-purple-300 text-[12px] font-medium">
            {type === 'voice' ? '📞 Incoming voice call' : '📹 Incoming video call'}
          </p>
        </div>

        <div className="flex gap-2.5 flex-shrink-0">
          {/* Decline */}
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={onDecline}
            className="w-11 h-11 rounded-full bg-red-500/90 flex items-center justify-center"
          >
            <PhoneOff size={18} className="text-white" />
          </motion.button>
          {/* Accept */}
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={onAccept}
            className="w-11 h-11 rounded-full bg-green-500 flex items-center justify-center"
          >
            <Phone size={18} className="text-white" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
