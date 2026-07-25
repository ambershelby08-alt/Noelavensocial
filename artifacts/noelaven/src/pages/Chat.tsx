import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRoute, Link, useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Phone, Video, MoreHorizontal, Image as ImageIcon,
  Smile, Mic, Send, X, Camera, ChevronDown, Check, CheckCheck,
  Reply, Edit2, Trash2, Copy, Forward, Flag,
  Bell, BellOff, Ban, LogOut, Play, Pause,
  CornerUpLeft, Loader2,
} from 'lucide-react';
import { mockMessages } from '@/lib/mockData';
import type { Message, User, Conversation } from '@/lib/mockData';
import { useMessages } from '@/hooks/useMessages';
import { useConversations } from '@/hooks/useConversations';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { useCall } from '@/contexts/CallContext';
import { isFirebaseConfigured } from '@/lib/firebase';
import {
  blockUser as fsBlockUser,
  reportConversation as fsReport,
  leaveGroupConversation as fsLeave,
  sendMessage as fsSendMessage,
} from '@/lib/firestore';
import { uploadMedia } from '@/lib/cloudinary';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday, isSameDay, differenceInMinutes } from 'date-fns';
import { safeGetTime } from '@/lib/timestamp';

// ─── Constants ────────────────────────────────────────────────────────────────

const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥', '🎉', '✨'];

const EMOJI_CATS = [
  { icon: '⭐', label: 'Popular', emojis: ['❤️', '😂', '😮', '😢', '👍', '🔥', '🎉', '✨', '😍', '🥰', '😊', '😎', '🤩', '😄', '🙌', '💯', '🫶', '💜', '🤣', '😅'] },
  { icon: '😊', label: 'Faces', emojis: ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '🙂', '😉', '😌', '😍', '🥰', '🤩', '😎', '🤓', '🧐', '😏', '🥹', '🤗', '😴', '🥳', '😈', '🤔', '😶', '🫡', '🤭', '😬', '🫠', '🥺'] },
  { icon: '👋', label: 'Gestures', emojis: ['👍', '👎', '👊', '✊', '🤛', '🤜', '🤞', '✌️', '🤟', '🤙', '👋', '🤚', '✋', '💪', '🫶', '👏', '🙌', '🤝', '🫂', '🙏', '💅', '🤳'] },
  { icon: '🌟', label: 'More', emojis: ['✨', '🌟', '💫', '⭐', '🔥', '💥', '🎉', '🎊', '🎈', '🎁', '🏆', '💯', '🎯', '🌈', '⚡', '🌊', '🍕', '🎵', '📷', '💻', '📚', '💡', '🚀', '🌸', '🦋', '🌺'] },
];

const CANNED_REPLIES: Record<string, string[]> = {
  'conv-1': ["That's such a good point! 🙌", "Haha yes exactly!!", "Omg love that idea!!", "Wait really?? Tell me more ✨", "The vibes are immaculate rn", "Say less, I'm on it 🎨", "Ok I'm obsessed with this direction"],
  'conv-2': ["Yeah that makes sense actually", "Haha true, classic dev life 😅", "Wait that's actually really smart", "LGTM 👍", "Ship it 🚀", "Nice catch!"],
  'conv-3': ["Sounds good! 🚀", "On it! Will update you soon", "Great work everyone! 💜", "Let's sync tomorrow to review"],
};

function getCannedReply(convId: string): string {
  const arr = CANNED_REPLIES[convId] ?? CANNED_REPLIES['conv-1'];
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface LocalMsg extends Message {
  /** Optimistic sending state */
  pending?: boolean;
  /** Local blob URL for preview while uploading */
  localMediaUrl?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: Date): string {
  if (isToday(d))     return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'EEEE, MMMM d');
}

function canEditOrDeleteForEveryone(msg: LocalMsg, userId: string): boolean {
  if (msg.senderId !== userId) return false;
  return differenceInMinutes(new Date(), msg.createdAt) < 30;
}

function formatVoiceDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// ─── Date separator ───────────────────────────────────────────────────────────

function DateSeparator({ date }: { date: Date }) {
  return (
    <div className="flex items-center gap-3 my-4 px-4">
      <div className="flex-1 h-px bg-black/[0.06]" />
      <span className="text-[11.5px] font-semibold text-gray-400 whitespace-nowrap px-1">{fmtDate(date)}</span>
      <div className="flex-1 h-px bg-black/[0.06]" />
    </div>
  );
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator({ user }: { user: User }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 4, scale: 0.95 }}
      className="flex items-end gap-2 px-4 mb-1"
    >
      <UserAvatar userId={user.id} fallbackName={user.displayName} fallbackSrc={(user as any).avatarUrl || undefined} size={28} className="flex-shrink-0 mb-0.5" />
      <div className="px-4 py-3 bg-white rounded-[20px] rounded-bl-sm border border-black/[0.05] shadow-sm">
        <div className="flex gap-1.5 items-center h-4">
          {[0, 1, 2].map(i => (
            <motion.div key={i} className="w-2 h-2 rounded-full bg-gray-400"
              animate={{ y: [0, -5, 0] }}
              transition={{ repeat: Infinity, duration: 0.7, delay: i * 0.18, ease: 'easeInOut' }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Quoted preview (reply reference in bubble) ───────────────────────────────

function QuotedPreview({ preview, isMe }: {
  preview: NonNullable<Message['replyToPreview']>;
  isMe: boolean;
}) {
  const previewText =
    preview.type === 'image' ? '📷 Photo'
    : preview.type === 'video' ? '🎥 Video'
    : preview.type === 'voice' ? '🎤 Voice message'
    : preview.content;

  return (
    <div
      className={cn(
        'px-3 py-2 mb-2 rounded-xl border-l-[3px] text-[12.5px] leading-tight max-w-full',
        isMe
          ? 'bg-white/20 border-white/70 text-white/90'
          : 'bg-gray-100 border-purple-400 text-gray-600'
      )}
    >
      <div className={cn('font-bold mb-0.5 text-[11.5px]', isMe ? 'text-white/80' : 'text-purple-500')}>
        {preview.senderName}
      </div>
      <div className="truncate">{previewText}</div>
    </div>
  );
}

// ─── Voice waveform SVG ───────────────────────────────────────────────────────

function VoiceWaveform({ bars, isMe, progress = 0 }: {
  bars: number[];
  isMe: boolean;
  progress?: number; // 0-1
}) {
  const width = 80;
  const height = 28;
  const barW = 2;
  const gap = 1.5;
  const total = bars.length;
  const step = width / total;
  const played = Math.floor(progress * total);

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="flex-shrink-0">
      {bars.map((v, i) => {
        const h = Math.max(3, v * height);
        const y = (height - h) / 2;
        const x = i * step + (step - barW) / 2;
        const isPast = i < played;
        return (
          <rect
            key={i}
            x={x} y={y} width={barW} height={h}
            rx={1}
            fill={isMe ? (isPast ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.4)')
                       : (isPast ? '#6B73FF' : '#C4C0FF')}
          />
        );
      })}
    </svg>
  );
}

// ─── Voice message bubble ─────────────────────────────────────────────────────

function VoiceMessageBubble({ msg, isMe }: { msg: LocalMsg; isMe: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fallback waveform bars
  const bars = msg.voiceWaveformData?.length
    ? msg.voiceWaveformData
    : Array.from({ length: 32 }, (_, i) => 0.2 + 0.6 * Math.sin(i * 0.4) * Math.random());

  const duration = msg.voiceDuration ?? 0;

  function togglePlay() {
    const url = msg.mediaUrl ?? msg.localMediaUrl;
    if (!url) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(url);
      audioRef.current.addEventListener('ended', () => { setPlaying(false); setProgress(0); });
      audioRef.current.addEventListener('timeupdate', () => {
        const a = audioRef.current!;
        setProgress(a.currentTime / (a.duration || 1));
      });
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      audioRef.current.play();
      setPlaying(true);
    }
  }

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  return (
    <div className="flex items-center gap-2.5 py-0.5 min-w-[160px]">
      <button
        onClick={togglePlay}
        className={cn(
          'w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors',
          isMe ? 'bg-white/25 text-white hover:bg-white/35' : 'bg-purple-100 text-purple-600 hover:bg-purple-200'
        )}
      >
        {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
      </button>
      <VoiceWaveform bars={bars} isMe={isMe} progress={progress} />
      <span className={cn('text-[11.5px] font-semibold flex-shrink-0', isMe ? 'text-white/80' : 'text-gray-400')}>
        {formatVoiceDuration(duration)}
      </span>
    </div>
  );
}

// ─── Image bubble ─────────────────────────────────────────────────────────────

function ImageBubble({ msg, isMe, onOpen }: { msg: LocalMsg; isMe: boolean; onOpen?: (url: string) => void }) {
  const [loaded, setLoaded] = useState(false);
  const url = msg.mediaUrl ?? msg.localMediaUrl;

  if (!url) {
    return (
      <div
        className="relative overflow-hidden rounded-[18px] w-52 h-44 flex items-center justify-center"
        style={{ background: isMe ? 'rgba(107,115,255,0.35)' : '#F3F0FF' }}
      >
        <ImageIcon size={22} className={isMe ? 'text-white/70' : 'text-purple-400'} />
      </div>
    );
  }

  return (
    <div
      className="relative rounded-[18px] overflow-hidden w-52 cursor-pointer active:scale-[0.97] transition-transform"
      onClick={() => onOpen?.(url)}
    >
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-200 z-10 rounded-[18px]">
          <Loader2 size={20} className="text-gray-400 animate-spin" />
        </div>
      )}
      <img
        src={url}
        alt=""
        onLoad={() => setLoaded(true)}
        className={cn('w-full object-cover max-h-64 rounded-[18px] transition-opacity', loaded ? 'opacity-100' : 'opacity-0')}
      />
    </div>
  );
}

// ─── Post share bubble ────────────────────────────────────────────────────────

function PostShareBubble({ post, isMe }: {
  post: NonNullable<Message['sharedPost']>;
  isMe: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-[16px] overflow-hidden border w-64',
        isMe ? 'bg-white/20 border-white/30' : 'bg-white border-black/[0.07]'
      )}
    >
      {post.imageUrl && (
        <img src={post.imageUrl} alt="" className="w-full h-32 object-cover" />
      )}
      <div className="px-3 py-2.5">
        <div className={cn('text-[11px] font-semibold mb-1', isMe ? 'text-white/70' : 'text-purple-500')}>
          📌 {post.authorName}
        </div>
        <p className={cn('text-[13px] line-clamp-2 leading-snug', isMe ? 'text-white/90' : 'text-gray-700')}>
          {post.content}
        </p>
      </div>
    </div>
  );
}

// ─── Reaction display ─────────────────────────────────────────────────────────

function ReactionDisplay({ reactions, currentUserId, onReact, isMe }: {
  reactions: Record<string, string[]>;
  currentUserId: string;
  onReact: (emoji: string) => void;
  isMe: boolean;
}) {
  if (Object.keys(reactions).length === 0) return null;
  return (
    <div className={cn('flex flex-wrap gap-1 mt-1.5', isMe ? 'justify-end' : 'justify-start')}>
      {Object.entries(reactions).map(([emoji, users]) => {
        const active = users.includes(currentUserId);
        return (
          <motion.button key={emoji} whileTap={{ scale: 0.88 }} onClick={() => onReact(emoji)}
            className={cn(
              'flex items-center gap-1 px-2.5 py-[3px] rounded-full text-[12.5px] font-semibold border transition-all',
              active ? 'bg-purple-100 border-purple-200 text-purple-700' : 'bg-white border-black/[0.06] text-gray-600 hover:bg-gray-50'
            )}
          >
            <span>{emoji}</span><span>{users.length}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

// ─── Quick reaction picker ────────────────────────────────────────────────────

function ReactionPicker({ isMe, reactions, currentUserId, onReact }: {
  isMe: boolean;
  reactions: Record<string, string[]>;
  currentUserId: string;
  onReact: (emoji: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.7, y: 10 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={cn(
        'absolute -top-14 flex items-center gap-0.5 bg-white rounded-full shadow-2xl border border-black/[0.08] px-2 py-1.5 z-20',
        isMe ? 'right-0' : 'left-0'
      )}
    >
      {QUICK_REACTIONS.map(emoji => {
        const active = reactions[emoji]?.includes(currentUserId);
        return (
          <motion.button key={emoji} whileHover={{ scale: 1.3, y: -3 }} whileTap={{ scale: 0.85 }}
            onClick={() => onReact(emoji)}
            className={cn('w-9 h-9 rounded-full flex items-center justify-center text-[18px] transition-colors', active ? 'bg-purple-100' : 'hover:bg-gray-100')}
          >
            {emoji}
          </motion.button>
        );
      })}
    </motion.div>
  );
}

// ─── Message bubble ───────────────────────────────────────────────────────────

interface BubbleProps {
  msg: LocalMsg;
  isMe: boolean;
  isFirst: boolean;
  isLast: boolean;
  isGroup: boolean;
  participants: User[];
  currentUserId: string;
  showPicker: boolean;
  onActivate: () => void;
  onLongPress: () => void;
  onReact: (emoji: string) => void;
  onOpenPhoto: (url: string) => void;
}

function MessageBubble({ msg, isMe, isFirst, isLast, isGroup, participants, currentUserId, showPicker, onActivate, onLongPress, onReact, onOpenPhoto }: BubbleProps) {
  const readByOthers = msg.readBy.filter(id => id !== currentUserId);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function startLongPress() {
    longPressTimer.current = setTimeout(() => { onLongPress(); }, 500);
  }
  function endLongPress() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }

  const displayContent = msg.editedContent ?? msg.content;

  const bubbleRadius = isMe
    ? cn('rounded-[22px]', isFirst ? 'rounded-tr-md' : '', isLast ? 'rounded-br-md' : '')
    : cn('rounded-[22px]', isFirst ? 'rounded-tl-md' : '', isLast ? 'rounded-bl-md' : '');

  const isImage = msg.type === 'image';
  const isVideo = msg.type === 'video';
  const isVoice = msg.type === 'voice';
  const isPost  = msg.type === 'post_share';
  const isMedia = isImage || isVideo || isPost || isVoice;

  // Deleted for everyone
  if (msg.deletedForEveryone) {
    return (
      <div className={cn('flex', isMe ? 'justify-end' : 'justify-start')}>
        <span className="text-[12.5px] text-gray-400 italic px-3 py-2 bg-gray-100 rounded-2xl border border-black/[0.04]">
          This message was deleted
        </span>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Reaction picker */}
      <AnimatePresence>
        {showPicker && (
          <ReactionPicker isMe={isMe} reactions={msg.reactions} currentUserId={currentUserId} onReact={onReact} />
        )}
      </AnimatePresence>

      {/* Forwarded label */}
      {msg.forwardedFrom && (
        <div className={cn('flex items-center gap-1 mb-1 text-[11px] text-gray-400', isMe ? 'justify-end' : 'justify-start')}>
          <Forward size={11} />
          <span>Forwarded from <strong>{msg.forwardedFrom.senderName}</strong></span>
        </div>
      )}

      {/* Bubble */}
      <motion.div
        whileTap={{ scale: 0.97 }}
        onClick={onActivate}
        onTouchStart={startLongPress}
        onTouchEnd={endLongPress}
        onMouseDown={startLongPress}
        onMouseUp={endLongPress}
        onMouseLeave={endLongPress}
        className={cn(
          'cursor-pointer relative select-none',
          bubbleRadius,
          isMedia ? '' : (isMe ? 'px-4 py-2.5 text-white' : 'px-4 py-2.5 bg-white border border-black/[0.06] text-gray-800 shadow-sm')
        )}
        style={!isMedia && isMe ? {
          background: 'linear-gradient(135deg, #6B73FF 0%, #9B59B6 50%, #FF6B9D 100%)',
          boxShadow: '0 3px 14px rgba(107,115,255,0.30)',
        } : {}}
      >
        {/* Reply quote */}
        {msg.replyToPreview && (
          <QuotedPreview preview={msg.replyToPreview} isMe={isMe} />
        )}

        {/* Content */}
        {isVoice ? (
          <div className={cn('px-3 py-2.5 rounded-[22px]', isMe ? 'text-white' : 'bg-white border border-black/[0.06] shadow-sm', bubbleRadius)}
            style={isMe ? { background: 'linear-gradient(135deg, #6B73FF 0%, #9B59B6 50%, #FF6B9D 100%)', boxShadow: '0 3px 14px rgba(107,115,255,0.30)' } : {}}>
            <VoiceMessageBubble msg={msg} isMe={isMe} />
          </div>
        ) : isImage ? (
          <ImageBubble msg={msg} isMe={isMe} onOpen={onOpenPhoto} />
        ) : isVideo ? (
          <div className="relative rounded-[18px] overflow-hidden w-52 h-44 bg-gray-900 flex items-center justify-center">
            {msg.mediaUrl ? (
              <video src={msg.mediaUrl} className="w-full h-full object-cover" />
            ) : null}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-black/50 flex items-center justify-center">
                <Play size={20} className="text-white ml-0.5" />
              </div>
            </div>
          </div>
        ) : isPost ? (
          <PostShareBubble post={msg.sharedPost!} isMe={isMe} />
        ) : (
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{displayContent}</p>
        )}

        {/* Edited label */}
        {msg.editedAt && !isMedia && (
          <span className={cn('text-[10.5px] ml-1', isMe ? 'text-white/60' : 'text-gray-400')}>(edited)</span>
        )}

        {/* Pending spinner */}
        {msg.pending && (
          <div className="absolute -bottom-1 -right-1">
            <Loader2 size={12} className="text-gray-400 animate-spin" />
          </div>
        )}
      </motion.div>

      {/* Read receipts */}
      {isMe && isLast && readByOthers.length > 0 && (
        <div className="flex items-center justify-end gap-1 mt-1">
          <div className="flex -space-x-1">
            {readByOthers.slice(0, 3).map(rid => {
              const reader = participants.find(p => p.id === rid);
              if (!reader) return null;
              return <UserAvatar key={rid} userId={reader.id} fallbackName={reader.displayName} fallbackSrc={(reader as any).avatarUrl || undefined} size={14} />;
            })}
          </div>
          <span className="text-[10px] text-purple-400 font-semibold">Read</span>
        </div>
      )}
      {isMe && isLast && !readByOthers.length && (
        <div className="flex items-center justify-end mt-0.5">
          {msg.pending ? <span className="text-[10px] text-gray-400">Sending…</span> : <CheckCheck size={12} className="text-purple-400" />}
        </div>
      )}
    </div>
  );
}

// ─── Bubble action sheet ──────────────────────────────────────────────────────

function BubbleActionSheet({ msg, isMe, isGroup, onClose, onReply, onEdit, onCopy, onDeleteForMe, onDeleteForEveryone, onForward }: {
  msg: LocalMsg;
  isMe: boolean;
  isGroup: boolean;
  onClose: () => void;
  onReply: () => void;
  onEdit: () => void;
  onCopy: () => void;
  onDeleteForMe: () => void;
  onDeleteForEveryone: () => void;
  onForward: () => void;
}) {
  const canEdit    = isMe && !msg.deletedForEveryone && canEditOrDeleteForEveryone(msg, msg.senderId) && msg.type === 'text';
  const canDelAll  = isMe && canEditOrDeleteForEveryone(msg, msg.senderId);

  const actions = [
    { id: 'reply',     icon: <Reply size={18} />,  label: 'Reply',               always: true },
    { id: 'forward',   icon: <Forward size={18} />, label: 'Forward',             always: true },
    { id: 'copy',      icon: <Copy size={18} />,    label: 'Copy',                always: msg.type === 'text' },
    { id: 'edit',      icon: <Edit2 size={18} />,   label: 'Edit',                always: canEdit },
    { id: 'deleteMe',  icon: <Trash2 size={18} />,  label: 'Delete for me',       always: true,  danger: true },
    { id: 'deleteAll', icon: <Trash2 size={18} />,  label: 'Delete for everyone', always: canDelAll, danger: true },
  ].filter(a => a.always);

  function handle(id: string) {
    if (id === 'reply')     onReply();
    if (id === 'forward')   onForward();
    if (id === 'copy')      onCopy();
    if (id === 'edit')      onEdit();
    if (id === 'deleteMe')  onDeleteForMe();
    if (id === 'deleteAll') onDeleteForEveryone();
    onClose();
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-50 bg-[#FDF9F6] rounded-t-[28px] shadow-2xl pb-8"
      >
        <div className="flex justify-center pt-3 pb-4">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>
        {/* Quick reactions at top */}
        <div className="flex justify-center gap-2 px-5 pb-4 border-b border-black/[0.05]">
          {QUICK_REACTIONS.map(emoji => (
            <motion.button key={emoji} whileTap={{ scale: 0.85 }} whileHover={{ scale: 1.2, y: -3 }}
              onClick={() => { /* handled outside via onReact */ onClose(); }}
              className="w-11 h-11 rounded-full flex items-center justify-center text-[22px] hover:bg-purple-50 transition-colors"
            >
              {emoji}
            </motion.button>
          ))}
        </div>
        <div className="px-5 pt-2 space-y-1">
          {actions.map(a => (
            <button key={a.id} onClick={() => handle(a.id)}
              className={cn(
                'w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-left transition-colors',
                a.danger ? 'hover:bg-red-50 text-red-500' : 'hover:bg-black/[0.04] text-gray-800'
              )}
            >
              <span className={a.danger ? 'text-red-400' : 'text-gray-500'}>{a.icon}</span>
              <span className={cn('font-semibold text-[15px]', a.danger && 'text-red-500')}>{a.label}</span>
            </button>
          ))}
        </div>
      </motion.div>
    </>
  );
}

// ─── Reply banner ─────────────────────────────────────────────────────────────

function ReplyBanner({ msg, participants, onCancel }: {
  msg: LocalMsg;
  participants: User[];
  onCancel: () => void;
}) {
  const sender = participants.find(p => p.id === msg.senderId);
  const displayContent = msg.editedContent ?? msg.content;
  const preview =
    msg.type === 'image' ? '📷 Photo'
    : msg.type === 'video' ? '🎥 Video'
    : msg.type === 'voice' ? '🎤 Voice message'
    : msg.type === 'post_share' ? '📌 Shared post'
    : displayContent;

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className="px-4 py-2.5 bg-purple-50 border-t border-purple-100 flex items-center gap-3"
    >
      <CornerUpLeft size={16} className="text-purple-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[11.5px] font-bold text-purple-500 mb-0.5">
          Replying to {sender?.displayName ?? 'Unknown'}
        </div>
        <div className="text-[12.5px] text-gray-500 truncate">{preview}</div>
      </div>
      <button onClick={onCancel} className="p-1.5 rounded-full hover:bg-purple-100 transition-colors">
        <X size={15} className="text-gray-400" />
      </button>
    </motion.div>
  );
}

// ─── Edit banner ──────────────────────────────────────────────────────────────

function EditBanner({ onCancel }: { onCancel: () => void }) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      className="px-4 py-2.5 bg-amber-50 border-t border-amber-100 flex items-center gap-3"
    >
      <Edit2 size={16} className="text-amber-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-bold text-amber-600">Editing message</div>
      </div>
      <button onClick={onCancel} className="p-1.5 rounded-full hover:bg-amber-100 transition-colors">
        <X size={15} className="text-gray-400" />
      </button>
    </motion.div>
  );
}

// ─── Emoji panel ──────────────────────────────────────────────────────────────

function EmojiPanel({ onSelect, onClose }: { onSelect: (e: string) => void; onClose: () => void }) {
  const [activeCat, setActiveCat] = useState(0);
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 260, opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 350, damping: 30 }}
      className="bg-white border-t border-black/[0.06] overflow-hidden flex-shrink-0"
    >
      <div className="flex items-center gap-1 px-4 pt-3 pb-2">
        {EMOJI_CATS.map((cat, i) => (
          <button key={cat.label} onClick={() => setActiveCat(i)}
            className={cn('px-3 py-1.5 rounded-xl text-[18px] transition-colors', activeCat === i ? 'bg-purple-100' : 'hover:bg-gray-100')}>
            {cat.icon}
          </button>
        ))}
        <button onClick={onClose} className="ml-auto p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <X size={16} className="text-gray-400" />
        </button>
      </div>
      <div className="px-3 overflow-y-auto" style={{ maxHeight: 196 }}>
        <div className="grid grid-cols-8 gap-0.5">
          {EMOJI_CATS[activeCat].emojis.map(emoji => (
            <button key={emoji} onClick={() => onSelect(emoji)}
              className="w-10 h-10 flex items-center justify-center text-[20px] hover:bg-gray-100 rounded-xl transition-colors">
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Attachment sheet ─────────────────────────────────────────────────────────

function AttachmentSheet({ onPhotoSelect, onClose }: {
  onPhotoSelect: (file: File) => void;
  onClose: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 20, opacity: 0 }}
      className="bg-white border-t border-black/[0.06] px-6 py-4 flex-shrink-0"
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) { onPhotoSelect(file); onClose(); }
        }}
      />
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: Camera,    label: 'Camera',  color: '#6B73FF', action: () => { fileRef.current?.setAttribute('capture', 'environment'); fileRef.current?.click(); } },
          { icon: ImageIcon, label: 'Gallery', color: '#FF6B9D', action: () => { fileRef.current?.removeAttribute('capture'); fileRef.current?.click(); } },
        ].map(opt => (
          <button key={opt.label} onClick={opt.action} className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 rounded-[18px] flex items-center justify-center" style={{ background: `${opt.color}22` }}>
              <opt.icon size={24} style={{ color: opt.color }} />
            </div>
            <span className="text-[12px] font-semibold text-gray-600">{opt.label}</span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Voice recording UI ───────────────────────────────────────────────────────

function VoiceRecordingUI({ duration, onStop, onCancel }: {
  duration: number;
  onStop: () => void;
  onCancel: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      className="flex items-center gap-3 px-4 py-3 bg-white border-t border-black/[0.05]"
    >
      <motion.div
        animate={{ opacity: [1, 0.3, 1] }}
        transition={{ repeat: Infinity, duration: 1.2 }}
        className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0"
      />
      <span className="text-[15px] font-semibold text-red-500 flex-1">
        Recording {formatVoiceDuration(duration)}
      </span>
      <button onClick={onCancel} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
        <Trash2 size={18} className="text-gray-400" />
      </button>
      <button onClick={onStop}
        className="px-4 py-2 rounded-full text-white text-[13.5px] font-bold transition-all"
        style={{ background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)' }}>
        Send
      </button>
    </motion.div>
  );
}

// ─── Safety menu sheet ────────────────────────────────────────────────────────

function SafetyMenuSheet({ isGroup, isDirect, onMute, onBlock, onReport, onLeave, onClose, isMuted }: {
  isGroup: boolean;
  isDirect: boolean;
  onMute: () => void;
  onBlock: () => void;
  onReport: () => void;
  onLeave: () => void;
  onClose: () => void;
  isMuted: boolean;
}) {
  const items = [
    { id: 'mute',   icon: isMuted ? <Bell size={18} /> : <BellOff size={18} />, label: isMuted ? 'Unmute notifications' : 'Mute notifications', show: true },
    { id: 'block',  icon: <Ban size={18} />,      label: 'Block user',          show: isDirect, danger: true },
    { id: 'report', icon: <Flag size={18} />,     label: 'Report conversation', show: true,     danger: true },
    { id: 'leave',  icon: <LogOut size={18} />,   label: 'Leave group',         show: isGroup,  danger: true },
  ].filter(a => a.show);

  function handle(id: string) {
    if (id === 'mute')   onMute();
    if (id === 'block')  onBlock();
    if (id === 'report') onReport();
    if (id === 'leave')  onLeave();
    onClose();
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-50 bg-[#FDF9F6] rounded-t-[28px] shadow-2xl pb-8"
      >
        <div className="flex justify-center pt-3 pb-4">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>
        <div className="px-5 space-y-1">
          {items.map(a => (
            <button key={a.id} onClick={() => handle(a.id)}
              className={cn(
                'w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-left transition-colors',
                a.danger ? 'hover:bg-red-50 text-red-500' : 'hover:bg-black/[0.04] text-gray-800'
              )}
            >
              <span className={a.danger ? 'text-red-400' : 'text-gray-500'}>{a.icon}</span>
              <span className={cn('font-semibold text-[15px]', a.danger && 'text-red-500')}>{a.label}</span>
            </button>
          ))}
        </div>
      </motion.div>
    </>
  );
}

// ─── Scroll-to-bottom button ──────────────────────────────────────────────────

function ScrollDownBtn({ onClick, unread }: { onClick: () => void; unread?: number }) {
  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      onClick={onClick}
      className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-white shadow-lg border border-black/[0.08] flex items-center justify-center z-10"
    >
      {unread ? (
        <span className="text-[11px] font-black text-purple-600">{unread}</span>
      ) : (
        <ChevronDown size={18} className="text-gray-600" />
      )}
    </motion.button>
  );
}

// ─── Forward picker sheet ─────────────────────────────────────────────────────

function ForwardPickerSheet({
  msg,
  conversations,
  currentUserId,
  onSend,
  onClose,
}: {
  msg: LocalMsg;
  conversations: Conversation[];
  currentUserId: string;
  onSend: (convIds: string[]) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const preview =
    msg.type === 'image'     ? '📷 Photo'
    : msg.type === 'video'   ? '🎥 Video'
    : msg.type === 'voice'   ? '🎤 Voice message'
    : msg.type === 'post_share' ? '📌 Shared post'
    : (msg.editedContent ?? msg.content).slice(0, 80);

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70]" onClick={onClose} />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-[75] bg-[#FDF9F6] rounded-t-[28px] shadow-2xl flex flex-col"
        style={{ maxHeight: '72vh' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-black/[0.06] flex-shrink-0">
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
          <span className="font-black text-[16px] text-gray-900">Forward message</span>
          <button
            disabled={selected.size === 0}
            onClick={() => onSend(Array.from(selected))}
            className={cn(
              'text-[14px] font-black transition-colors',
              selected.size > 0 ? 'text-purple-600' : 'text-gray-300'
            )}
          >
            Send{selected.size > 0 ? ` (${selected.size})` : ''}
          </button>
        </div>

        {/* Preview of the message being forwarded */}
        <div className="mx-5 mt-3 mb-1 flex-shrink-0 px-4 py-2.5 bg-purple-50 rounded-2xl border border-purple-100">
          <div className="flex items-center gap-2 mb-0.5">
            <Forward size={13} className="text-purple-400" />
            <span className="text-[11px] font-bold text-purple-500">Forwarding</span>
          </div>
          <p className="text-[12.5px] text-gray-600 truncate">{preview}</p>
        </div>

        {/* Conversation list */}
        <div className="overflow-y-auto flex-1 px-4 py-3 space-y-2">
          {conversations.length === 0 ? (
            <p className="text-center text-gray-400 text-[14px] py-10">No conversations yet</p>
          ) : conversations.map(conv => {
            const other = conv.participants.find(p => p.id !== currentUserId) ?? conv.participants[0];
            const name  = conv.type === 'group' ? (conv.name ?? 'Group') : other.displayName;
            const sel   = selected.has(conv.id);
            return (
              <motion.button
                key={conv.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => toggle(conv.id)}
                className={cn(
                  'w-full flex items-center gap-3.5 px-4 py-3 rounded-[18px] border transition-all text-left',
                  sel ? 'bg-purple-50 border-purple-200' : 'bg-white border-black/[0.05]'
                )}
              >
                <UserAvatar
                  userId={other.id}
                  fallbackName={other.displayName}
                  fallbackSrc={(other as any).avatarUrl || undefined}
                  size={44}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[14.5px] text-gray-900 truncate">{name}</p>
                  <p className="text-[12px] text-gray-400 truncate">{conv.lastMessage || 'No messages yet'}</p>
                </div>
                <div className={cn(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all',
                  sel ? 'border-purple-500 bg-purple-500' : 'border-gray-300'
                )}>
                  {sel && <Check size={11} className="text-white" />}
                </div>
              </motion.button>
            );
          })}
        </div>
      </motion.div>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Chat() {
  const [, params]      = useRoute('/messages/:id');
  const [, setLocation] = useLocation();
  const { currentUser } = useAuth();
  const convId          = params?.id ?? '';

  const {
    conversation: hookConv, messages: hookMessages, isLoading,
    sendMessage: hookSend, editMessage: hookEdit, deleteForMe: hookDeleteForMe,
    deleteForEveryone: hookDeleteForEveryone, toggleReaction: hookToggleReaction,
    typingUserIds, hasOlderMessages, loadingOlder, loadOlderMessages,
    notifyTyping, stopTyping,
  } = useMessages(convId);

  const { conversations, muteConversation } = useConversations();
  const voiceRecorder = useVoiceRecorder();
  const { startCall } = useCall();

  // In demo mode, seed from mockMessages
  const initMsgs = isFirebaseConfigured ? [] : (mockMessages[convId] ?? []) as LocalMsg[];
  const [messages, setMessages] = useState<LocalMsg[]>(initMsgs);
  const [isOtherTyping, setOtherTyping] = useState(false); // demo only

  // Sync from hook (Firestore)
  useEffect(() => {
    if (isFirebaseConfigured) setMessages(hookMessages as LocalMsg[]);
  }, [hookMessages]);

  const conversation = hookConv ?? null;

  // ── UI state ───────────────────────────────────────────────────────────────
  const [inputText, setInputText]         = useState('');
  const [emojiOpen, setEmojiOpen]         = useState(false);
  const [attachOpen, setAttachOpen]       = useState(false);
  const [activePicker, setActivePicker]   = useState<string | null>(null);
  const [actionMsg, setActionMsg]         = useState<LocalMsg | null>(null);
  const [replyingTo, setReplyingTo]       = useState<LocalMsg | null>(null);
  const [editingMsg, setEditingMsg]       = useState<LocalMsg | null>(null);
  // call overlay is managed globally by CallContext / AppShell
  const [safetySheet, setSafetySheet]     = useState(false);
  const [forwardMsg, setForwardMsg]       = useState<LocalMsg | null>(null);
  const [atBottom, setAtBottom]           = useState(true);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [viewingPhoto, setViewingPhoto]   = useState<string | null>(null);

  const scrollRef        = useRef<HTMLDivElement>(null);
  const bottomRef        = useRef<HTMLDivElement>(null);
  const textareaRef      = useRef<HTMLTextAreaElement>(null);
  const isInitialLoadRef = useRef(true);

  // ── Hooks that must run unconditionally (before any early return) ──────────
  const [editText, setEditText] = useState('');

  // Scroll to bottom when new messages or typing indicator arrives.
  // Initial load scrolls instantly (no visible jump); subsequent arrivals
  // scroll smoothly only when already at the bottom.
  useEffect(() => {
    if (!messages.length) return;
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      bottomRef.current?.scrollIntoView({ behavior: 'instant' });
    } else if (atBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, typingUserIds.length, atBottom]);

  // ── Guard: must be after all hooks ────────────────────────────────────────
  if (!currentUser) return null;
  // Non-null alias so closures below don't require TypeScript re-narrowing
  const cu = currentUser;

  if (!isLoading && !conversation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#FDF9F6]">
        <p className="text-gray-400">Conversation not found</p>
        <Link href="/messages" className="mt-3 text-purple-500 font-semibold">← Back to Chats</Link>
      </div>
    );
  }

  const other    = conversation?.participants.find(p => p.id !== cu.id) ?? conversation?.participants[0];
  const title    = conversation ? (conversation.type === 'group' ? (conversation.name ?? 'Group') : (other?.displayName ?? '')) : '…';
  const isGroup  = conversation?.type === 'group' ? true : false;
  const isMuted  = !!(conversations.find(c => c.id === convId)?.mutedBy?.includes(cu.id));

  // Typing users (resolve to User objects for TypingIndicator)
  const typingUsers = (isFirebaseConfigured ? typingUserIds : (isOtherTyping && other ? [other.id] : []))
    .map(id => conversation?.participants.find(p => p.id === id))
    .filter((u): u is User => !!u);

  // ── Scroll helpers ─────────────────────────────────────────────────────────

  function scrollToBottom(behavior: ScrollBehavior = 'smooth') {
    bottomRef.current?.scrollIntoView({ behavior });
  }

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    const fromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAtBottom(fromBottom < 80);
    // Load older messages when scrolling near top
    if (el.scrollTop < 60 && hasOlderMessages && !loadingOlder) {
      loadOlderMessages();
    }
  }

  // ── Textarea auto-resize ────────────────────────────────────────────────────

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    editingMsg ? setEditText(val) : setInputText(val);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
    notifyTyping();
  }

  // ── Send message ───────────────────────────────────────────────────────────

  async function doSendText() {
    const text = inputText.trim();
    if (!text) return;

    setInputText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setEmojiOpen(false);
    setAttachOpen(false);
    stopTyping();

    const replyOpts = replyingTo ? {
      replyToId: replyingTo.id,
      replyToPreview: {
        senderId: replyingTo.senderId,
        senderName: conversation?.participants.find(p => p.id === replyingTo.senderId)?.displayName ?? 'Unknown',
        content: replyingTo.editedContent ?? replyingTo.content,
        type: replyingTo.type,
      },
    } : {};
    setReplyingTo(null);

    if (isFirebaseConfigured) {
      const tempId = `pending-${Date.now()}`;
      const msg: LocalMsg = {
        id: tempId, senderId: cu.id, content: text, type: 'text',
        reactions: {}, readBy: [cu.id], createdAt: new Date(), pending: true,
        ...replyOpts,
      };
      setMessages(prev => [...prev, msg]);
      await hookSend(text, 'text', replyOpts);
    } else {
      const msg: LocalMsg = {
        id: `live-${Date.now()}`, senderId: cu.id, content: text, type: 'text',
        reactions: {}, readBy: [], createdAt: new Date(), pending: true, ...replyOpts,
      };
      setMessages(prev => [...prev, msg]);
      setTimeout(() => setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, pending: false } : m)), 400);
      // Simulated reply
      const typingDelay = 900 + Math.random() * 400;
      const replyDelay  = typingDelay + 1200 + Math.random() * 800;
      if (other) setTimeout(() => setOtherTyping(true), typingDelay);
      setTimeout(() => {
        setOtherTyping(false);
        if (!other) return;
        setMessages(prev => [...prev, {
          id: `reply-${Date.now()}`, senderId: other.id,
          content: getCannedReply(convId), type: 'text',
          reactions: {}, readBy: [cu.id], createdAt: new Date(),
        }]);
      }, replyDelay);
    }
  }

  async function doSendMedia(file: File) {
    setUploadingMedia(true);
    const localUrl = URL.createObjectURL(file);
    const type: Message['type'] = file.type.startsWith('video') ? 'video' : 'image';
    const tempId = `pending-media-${Date.now()}`;
    const msg: LocalMsg = {
      id: tempId, senderId: cu.id, content: type === 'image' ? '📷 Photo' : '🎥 Video', type,
      reactions: {}, readBy: [cu.id], createdAt: new Date(), pending: true, localMediaUrl: localUrl,
    };
    setMessages(prev => [...prev, msg]);
    try {
      const url = await uploadMedia(file, 'posts', type === 'image' ? 'image' : 'video');
      if (isFirebaseConfigured) {
        await hookSend(type === 'image' ? '📷 Photo' : '🎥 Video', type, { mediaUrl: url, mediaType: type });
      }
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, mediaUrl: url, localMediaUrl: undefined, pending: false } : m));
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempId));
    } finally {
      setUploadingMedia(false);
    }
  }

  async function doSendVoice() {
    const recording = await voiceRecorder.stop();
    if (!recording) return;
    const tempId = `pending-voice-${Date.now()}`;
    const msg: LocalMsg = {
      id: tempId, senderId: cu.id, content: '🎤 Voice message', type: 'voice',
      reactions: {}, readBy: [cu.id], createdAt: new Date(), pending: true,
      voiceDuration: recording.duration, voiceWaveformData: recording.waveform,
      localMediaUrl: URL.createObjectURL(recording.blob),
    };
    setMessages(prev => [...prev, msg]);
    try {
      const url = await uploadMedia(recording.blob, 'voice', 'auto');
      if (isFirebaseConfigured) {
        await hookSend('🎤 Voice message', 'voice', {
          mediaUrl: url, mediaType: 'voice',
          voiceDuration: recording.duration, voiceWaveformData: recording.waveform,
        });
      }
      setMessages(prev => prev.map(m => m.id === tempId ? { ...m, mediaUrl: url, pending: false } : m));
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  }

  async function doSaveEdit() {
    if (!editingMsg || !editText.trim()) return;
    const msgId = editingMsg.id;
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, editedContent: editText.trim(), editedAt: new Date() } : m));
    setEditingMsg(null);
    setEditText('');
    if (isFirebaseConfigured) {
      await hookEdit(msgId, editText.trim());
    }
  }

  function handleSend() {
    if (editingMsg) { doSaveEdit(); return; }
    doSendText();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    if (e.key === 'Escape' && editingMsg) { setEditingMsg(null); setEditText(''); }
  }

  function insertEmoji(emoji: string) {
    if (editingMsg) { setEditText(prev => prev + emoji); }
    else            { setInputText(prev => prev + emoji); }
    textareaRef.current?.focus();
  }

  // ── Reactions ──────────────────────────────────────────────────────────────

  function handleReact(msgId: string, emoji: string) {
    if (isFirebaseConfigured) {
      hookToggleReaction(msgId, emoji);
    } else {
      setMessages(prev => prev.map(m => {
        if (m.id !== msgId) return m;
        const r = { ...m.reactions };
        const users = r[emoji] ?? [];
        if (users.includes(cu.id)) {
          r[emoji] = users.filter(u => u !== cu.id);
          if (!r[emoji].length) delete r[emoji];
        } else {
          r[emoji] = [...users, cu.id];
        }
        return { ...m, reactions: r };
      }));
    }
    setActivePicker(null);
  }

  // ── Bubble actions ─────────────────────────────────────────────────────────

  function handleReply(msg: LocalMsg) {
    setReplyingTo(msg);
    setEditingMsg(null);
    setTimeout(() => textareaRef.current?.focus(), 100);
  }

  function handleEdit(msg: LocalMsg) {
    setEditingMsg(msg);
    setEditText(msg.editedContent ?? msg.content);
    setReplyingTo(null);
    setTimeout(() => textareaRef.current?.focus(), 100);
  }

  function handleCopy(msg: LocalMsg) {
    navigator.clipboard.writeText(msg.editedContent ?? msg.content).catch(() => {});
  }

  async function handleDeleteForMe(msg: LocalMsg) {
    if (isFirebaseConfigured) {
      await hookDeleteForMe(msg.id);
    } else {
      setMessages(prev => prev.filter(m => m.id !== msg.id));
    }
  }

  async function handleDeleteForEveryone(msg: LocalMsg) {
    if (isFirebaseConfigured) {
      await hookDeleteForEveryone(msg.id);
    } else {
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, deletedForEveryone: true } : m));
    }
  }

  // ── Safety actions ─────────────────────────────────────────────────────────

  async function handleBlock() {
    if (!other) return;
    if (isFirebaseConfigured) await fsBlockUser(cu.id, other.id);
    setLocation('/messages');
  }

  async function handleReport() {
    if (isFirebaseConfigured) await fsReport(convId, cu.id, 'Reported by user');
  }

  async function handleLeave() {
    if (isFirebaseConfigured) await fsLeave(convId, cu.id);
    setLocation('/messages');
  }

  async function handleForwardSend(convIds: string[]) {
    if (!forwardMsg) return;
    const content =
      forwardMsg.type === 'image'      ? '📷 Photo'
      : forwardMsg.type === 'video'    ? '🎥 Video'
      : forwardMsg.type === 'voice'    ? '🎤 Voice message'
      : forwardMsg.type === 'post_share' ? '📌 Shared post'
      : (forwardMsg.editedContent ?? forwardMsg.content);
    if (isFirebaseConfigured) {
      await Promise.all(convIds.map(cid =>
        fsSendMessage(cid, cu.id, content, forwardMsg.type ?? 'text', {
          forwardedFrom: { senderId: forwardMsg.senderId, senderName: forwardMsg.senderId },
          ...(forwardMsg.mediaUrl ? { mediaUrl: forwardMsg.mediaUrl, mediaType: forwardMsg.mediaType } : {}),
          ...(forwardMsg.sharedPost ? { sharedPost: forwardMsg.sharedPost } : {}),
        })
      ));
    }
    setForwardMsg(null);
  }

  // ── Group messages by sender + time ────────────────────────────────────────

  const visibleMessages = messages.filter(m => {
    if (m.deletedFor?.includes(cu.id)) return false;
    return true;
  });

  interface MsgGroup { senderId: string; msgs: LocalMsg[] }
  const groups: MsgGroup[] = [];
  for (const msg of visibleMessages) {
    const last = groups[groups.length - 1];
    const prevMsg = last?.msgs[last.msgs.length - 1];
    const sameWindow = prevMsg && (safeGetTime(msg.createdAt) - safeGetTime(prevMsg.createdAt) < 5 * 60_000);
    if (last && last.senderId === msg.senderId && sameWindow) {
      last.msgs.push(msg);
    } else {
      groups.push({ senderId: msg.senderId, msgs: [msg] });
    }
  }

  type Slot = { type: 'sep'; date: Date } | { type: 'group'; group: MsgGroup }
  const slots: Slot[] = [];
  let lastDate: Date | null = null;
  for (const group of groups) {
    const d = group.msgs[0].createdAt;
    if (!lastDate || !isSameDay(lastDate, d)) {
      slots.push({ type: 'sep', date: d });
      lastDate = d;
    }
    slots.push({ type: 'group', group });
  }

  const inputVal = editingMsg ? editText : inputText;
  const hasText  = inputVal.trim().length > 0;

  return (
    <div className="flex flex-col bg-[#F8F5F2]" style={{ minHeight: '100dvh' }}>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 flex items-center gap-3 px-3 py-3 bg-white/95 backdrop-blur-xl border-b border-black/[0.05] shadow-sm flex-shrink-0">
        <Link href="/messages">
          <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors flex-shrink-0">
            <ArrowLeft size={20} className="text-gray-700" />
          </button>
        </Link>

        <div className="relative flex-shrink-0">
          {isGroup ? (
            <div className="relative w-10 h-10">
              {(conversation?.participants.filter(p => p.id !== cu.id) ?? []).slice(0, 2).map((p, i) => (
                <div key={p.id} className="absolute border-2 border-white rounded-full"
                  style={i === 0 ? { bottom: 0, left: 0 } : { top: 0, right: 0 }}>
                  <UserAvatar userId={p.id} fallbackName={p.displayName} fallbackSrc={(p as any).avatarUrl || undefined} size={28} />
                </div>
              ))}
            </div>
          ) : other ? (
            <>
              <UserAvatar userId={other.id} fallbackName={other.displayName} fallbackSrc={(other as any).avatarUrl || undefined} size={40} />
              <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-400 border-2 border-white" />
            </>
          ) : null}
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="font-black text-[15px] text-gray-900 truncate leading-tight">{title}</h2>
          <p className="text-[12px] text-green-500 font-semibold leading-tight">
            {isGroup ? `${conversation?.participants.length ?? 0} members · Active now` : 'Active now'}
          </p>
        </div>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          {/* Voice + video only for 1-to-1 chats */}
          {!isGroup && (
            <>
              <button
                onClick={() => other && startCall(other.id, other.displayName, other.avatarUrl ?? '', convId, 'voice')}
                className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
                <Phone size={18} />
              </button>
              <button
                onClick={() => other && startCall(other.id, other.displayName, other.avatarUrl ?? '', convId, 'video')}
                className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
                <Video size={20} />
              </button>
            </>
          )}
          <button onClick={() => setSafetySheet(true)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
            <MoreHorizontal size={20} />
          </button>
        </div>
      </header>

      {/* ── Load older indicator ─────────────────────────────────────── */}
      {loadingOlder && (
        <div className="flex items-center justify-center py-3 bg-transparent">
          <Loader2 size={18} className="text-purple-400 animate-spin" />
        </div>
      )}

      {/* ── Messages area ─────────────────────────────────────────────── */}
      {activePicker && (
        <div className="fixed inset-0 z-10" onClick={() => setActivePicker(null)} />
      )}

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto relative" style={{ overscrollBehavior: 'contain' }}>
        <div className="py-4 space-y-1">
          {slots.map((slot, si) => {
            if (slot.type === 'sep') return <DateSeparator key={`sep-${si}`} date={slot.date} />;

            const { group } = slot;
            const isMe = group.senderId === cu.id;
            const sender = conversation?.participants.find(p => p.id === group.senderId);
            const senderName = sender?.displayName ?? 'Unknown';

            return (
              <div key={`grp-${si}`} className={cn('flex gap-2.5 px-4 my-3', isMe ? 'justify-end' : 'justify-start')}>
                {!isMe && (
                  <div className="flex-shrink-0 self-end mb-6">
                    <UserAvatar userId={group.senderId} fallbackName={senderName} fallbackSrc={sender ? (sender as any).avatarUrl || undefined : undefined} size={30} />
                  </div>
                )}
                <div className={cn('flex flex-col gap-1 max-w-[72%]', isMe ? 'items-end' : 'items-start')}>
                  {isGroup && !isMe && (
                    <span className="text-[11.5px] font-semibold text-gray-400 ml-1 mb-0.5">{senderName}</span>
                  )}
                  {group.msgs.map((msg, mi) => (
                    <div key={msg.id} className={cn('flex flex-col', isMe ? 'items-end' : 'items-start')}>
                      <MessageBubble
                        msg={msg}
                        isMe={isMe}
                        isFirst={mi === 0}
                        isLast={mi === group.msgs.length - 1}
                        isGroup={isGroup}
                        participants={conversation?.participants ?? []}
                        currentUserId={cu.id}
                        showPicker={activePicker === msg.id}
                        onActivate={() => setActivePicker(p => p === msg.id ? null : msg.id)}
                        onLongPress={() => { setActionMsg(msg); setActivePicker(null); }}
                        onReact={emoji => handleReact(msg.id, emoji)}
                        onOpenPhoto={url => setViewingPhoto(url)}
                      />
                      <ReactionDisplay
                        reactions={msg.reactions}
                        currentUserId={cu.id}
                        onReact={emoji => handleReact(msg.id, emoji)}
                        isMe={isMe}
                      />
                    </div>
                  ))}
                  <span className="text-[10.5px] text-gray-400 mt-0.5 mx-1">
                    {format(group.msgs[group.msgs.length - 1].createdAt, 'h:mm a')}
                  </span>
                </div>
              </div>
            );
          })}

          <AnimatePresence>
            {typingUsers.map(u => <TypingIndicator key={u.id} user={u} />)}
          </AnimatePresence>

          <div ref={bottomRef} className="h-1" />
        </div>

        <AnimatePresence>
          {!atBottom && (
            <div className="sticky bottom-4 flex justify-end pr-4">
              <ScrollDownBtn onClick={() => scrollToBottom()} />
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Voice recording UI ──────────────────────────────────────── */}
      <AnimatePresence>
        {voiceRecorder.isRecording && (
          <VoiceRecordingUI
            key="voice-rec"
            duration={voiceRecorder.duration}
            onStop={doSendVoice}
            onCancel={voiceRecorder.cancel}
          />
        )}
      </AnimatePresence>

      {/* ── Emoji panel ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {emojiOpen && <EmojiPanel key="emoji" onSelect={insertEmoji} onClose={() => setEmojiOpen(false)} />}
      </AnimatePresence>

      {/* ── Attachment sheet ─────────────────────────────────────────── */}
      <AnimatePresence>
        {attachOpen && <AttachmentSheet key="attach" onPhotoSelect={doSendMedia} onClose={() => setAttachOpen(false)} />}
      </AnimatePresence>

      {/* ── Input bar ───────────────────────────────────────────────── */}
      {!voiceRecorder.isRecording && (
        <div
          className="sticky bottom-0 z-20 bg-white/95 backdrop-blur-xl border-t border-black/[0.05] flex-shrink-0"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          {/* Reply banner */}
          <AnimatePresence>
            {replyingTo && <ReplyBanner key="reply" msg={replyingTo} participants={conversation?.participants ?? []} onCancel={() => setReplyingTo(null)} />}
          </AnimatePresence>
          {/* Edit banner */}
          <AnimatePresence>
            {editingMsg && <EditBanner key="edit" onCancel={() => { setEditingMsg(null); setEditText(''); }} />}
          </AnimatePresence>

          <div className="px-3 py-3 flex items-end gap-2">
            {/* Attach */}
            <motion.button whileTap={{ scale: 0.88 }}
              onClick={() => { setAttachOpen(v => !v); setEmojiOpen(false); }}
              disabled={uploadingMedia}
              className={cn('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all mb-0.5',
                attachOpen ? 'text-white shadow-md' : 'text-gray-400 hover:text-purple-500 hover:bg-purple-50'
              )}
              style={attachOpen ? { background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)' } : {}}
            >
              {uploadingMedia ? <Loader2 size={20} className="animate-spin" /> : <ImageIcon size={21} />}
            </motion.button>

            {/* Text input */}
            <div className="flex-1 flex items-end bg-gray-100 rounded-[22px] px-4 py-2.5 gap-2 focus-within:bg-white focus-within:ring-2 focus-within:ring-purple-200 transition-all border border-transparent focus-within:border-purple-200">
              <textarea
                ref={textareaRef}
                value={inputVal}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                placeholder={editingMsg ? 'Edit message…' : 'Message…'}
                rows={1}
                className="flex-1 bg-transparent outline-none resize-none text-[15px] text-gray-900 placeholder:text-gray-400 leading-[1.4] max-h-[120px] overflow-y-auto"
                style={{ lineHeight: '1.4' }}
              />
              <motion.button whileTap={{ scale: 0.88 }}
                onClick={() => { setEmojiOpen(v => !v); setAttachOpen(false); }}
                className={cn('flex-shrink-0 text-gray-400 hover:text-purple-500 transition-colors self-end mb-0.5', emojiOpen && 'text-purple-500')}
              >
                <Smile size={20} />
              </motion.button>
            </div>

            {/* Send or Mic */}
            <AnimatePresence mode="wait">
              {hasText || editingMsg ? (
                <motion.button key="send"
                  initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}
                  whileTap={{ scale: 0.88 }}
                  onClick={handleSend}
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-md mb-0.5 text-white"
                  style={{ background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)', boxShadow: '0 3px 12px rgba(107,115,255,0.40)' }}
                >
                  {editingMsg ? <Check size={18} /> : <Send size={17} className="ml-0.5 -mt-0.5" />}
                </motion.button>
              ) : (
                <motion.button key="mic"
                  initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}
                  whileTap={{ scale: 0.88 }}
                  onClick={voiceRecorder.start}
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-gray-100 text-gray-500 hover:bg-purple-50 hover:text-purple-500 transition-all mb-0.5"
                >
                  <Mic size={19} />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {/* ── Overlays ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {actionMsg && (
          <BubbleActionSheet
            key="bubble-action"
            msg={actionMsg}
            isMe={actionMsg.senderId === cu.id}
            isGroup={isGroup}
            onClose={() => setActionMsg(null)}
            onReply={() => handleReply(actionMsg)}
            onEdit={() => handleEdit(actionMsg)}
            onCopy={() => handleCopy(actionMsg)}
            onDeleteForMe={() => handleDeleteForMe(actionMsg)}
            onDeleteForEveryone={() => handleDeleteForEveryone(actionMsg)}
            onForward={() => { setForwardMsg(actionMsg); }}
          />
        )}
        {/* Call overlay managed globally by AppShell via CallContext */}
        {safetySheet && (
          <SafetyMenuSheet
            key="safety"
            isGroup={isGroup}
            isDirect={!isGroup}
            isMuted={isMuted}
            onMute={() => muteConversation(convId, !isMuted)}
            onBlock={handleBlock}
            onReport={handleReport}
            onLeave={handleLeave}
            onClose={() => setSafetySheet(false)}
          />
        )}
        {forwardMsg && (
          <ForwardPickerSheet
            key="forward"
            msg={forwardMsg}
            conversations={conversations.filter(c => c.id !== convId)}
            currentUserId={cu.id}
            onSend={handleForwardSend}
            onClose={() => setForwardMsg(null)}
          />
        )}
      </AnimatePresence>

      {/* Full-screen photo viewer */}
      {viewingPhoto && (
        <div
          className="fixed inset-0 z-[120] bg-black/95 flex items-center justify-center"
          onClick={() => setViewingPhoto(null)}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            onClick={() => setViewingPhoto(null)}
          >
            ✕
          </button>
          <img
            src={viewingPhoto}
            alt=""
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={e => e.stopPropagation()}
          />
          <a
            href={viewingPhoto}
            download
            target="_blank"
            rel="noreferrer"
            className="absolute bottom-6 left-1/2 -translate-x-1/2 px-5 py-2.5 bg-white/15 text-white text-[13px] font-semibold rounded-full hover:bg-white/25 transition-colors"
            onClick={e => e.stopPropagation()}
          >
            Download
          </a>
        </div>
      )}
    </div>
  );
}
