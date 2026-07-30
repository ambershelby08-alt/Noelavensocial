import React, { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useRoute, Link, useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Phone, Video, MoreHorizontal, Image as ImageIcon,
  Smile, Mic, Send, X, Camera, ChevronDown, Check, CheckCheck,
  Reply, Edit2, Trash2, Copy, Forward, Flag,
  Bell, BellOff, Ban, LogOut, Play, Pause,
  CornerUpLeft, Loader2, AlertCircle, GalleryHorizontal, RefreshCw,
  Download, CheckCircle, Share2, PhoneMissed,
} from 'lucide-react';
import { downloadImage } from '@/lib/downloadMedia';
import { mockMessages } from '@/lib/mockData';
import type { Message, User, Conversation } from '@/lib/mockData';
import { useMessages } from '@/hooks/useMessages';
import { useConversations } from '@/hooks/useConversations';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { useUserPresence } from '@/hooks/useUserPresence';
import { useCall } from '@/contexts/CallContext';
import { isFirebaseConfigured } from '@/lib/firebase';
import {
  blockUser as fsBlockUser,
  reportConversation as fsReport,
  leaveGroupConversation as fsLeave,
  sendMessage as fsSendMessage,
  searchUsers as fsSearchUsers,
  ensureDMConversation as fsEnsureDMConversation,
} from '@/lib/firestore';
import { uploadMedia } from '@/lib/cloudinary';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday, isSameDay, differenceInMinutes } from 'date-fns';
import { safeGetTime, formatRelativeTime } from '@/lib/timestamp';

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
  /** Send failed — show retry button */
  failed?: boolean;
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
      <span className="text-[11.5px] font-semibold text-[rgba(255,255,255,0.45)] whitespace-nowrap px-1">{fmtDate(date)}</span>
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
      <div className="px-4 py-3 bg-[#111] rounded-[20px] rounded-bl-sm border border-[#1a1a1a] shadow-sm">
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
          ? 'bg-[#111]/20 border-white/70 text-white/90'
          : 'bg-[#1a1a1a] border-[#F5C542] text-[#BDBDBD]'
      )}
    >
      <div className={cn('font-bold mb-0.5 text-[11.5px]', isMe ? 'text-white/80' : 'text-[#F5C542]')}>
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
                       : (isPast ? '#F5C542' : '#C4C0FF')}
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
          isMe ? 'bg-[#111]/25 text-white hover:bg-[#111]/35' : 'bg-[rgba(245,197,66,0.15)] text-[#F5C542] hover:bg-[rgba(245,197,66,0.2)]'
        )}
      >
        {playing ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
      </button>
      <VoiceWaveform bars={bars} isMe={isMe} progress={progress} />
      <span className={cn('text-[11.5px] font-semibold flex-shrink-0', isMe ? 'text-white/80' : 'text-[rgba(255,255,255,0.45)]')}>
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
        style={{ background: isMe ? 'rgba(245,197,66,0.35)' : '#F3F0FF' }}
      >
        <ImageIcon size={22} className={isMe ? 'text-white/70' : 'text-[#F5C542]'} />
      </div>
    );
  }

  return (
    <div
      className="relative rounded-[18px] overflow-hidden w-52 cursor-pointer active:scale-[0.97] transition-transform"
      onClick={() => onOpen?.(url)}
    >
      {!loaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#222] z-10 rounded-[18px]">
          <Loader2 size={20} className="text-[rgba(255,255,255,0.45)] animate-spin" />
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
        isMe ? 'bg-[#111]/20 border-white/30' : 'bg-[#111] border-black/[0.07]'
      )}
    >
      {post.imageUrl && (
        <img src={post.imageUrl} alt="" className="w-full h-32 object-cover" />
      )}
      <div className="px-3 py-2.5">
        <div className={cn('text-[11px] font-semibold mb-1', isMe ? 'text-white/70' : 'text-[#F5C542]')}>
          📌 {post.authorName}
        </div>
        <p className={cn('text-[13px] line-clamp-2 leading-snug', isMe ? 'text-white/90' : 'text-[#BDBDBD]')}>
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
              active ? 'bg-[rgba(245,197,66,0.15)] border-[rgba(245,197,66,0.25)] text-purple-700' : 'bg-[#111] border-[#1a1a1a] text-[#BDBDBD] hover:bg-[#111]'
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
        'absolute -top-14 flex items-center gap-0.5 bg-[#111] rounded-full shadow-2xl border border-[#2a2a2a] px-2 py-1.5 z-20',
        isMe ? 'right-0' : 'left-0'
      )}
    >
      {QUICK_REACTIONS.map(emoji => {
        const active = reactions[emoji]?.includes(currentUserId);
        return (
          <motion.button key={emoji} whileHover={{ scale: 1.3, y: -3 }} whileTap={{ scale: 0.85 }}
            onClick={() => onReact(emoji)}
            className={cn('w-9 h-9 rounded-full flex items-center justify-center text-[18px] transition-colors', active ? 'bg-[rgba(245,197,66,0.15)]' : 'hover:bg-[#1a1a1a]')}
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
  onRetry?: () => void;
}

function MessageBubble({ msg, isMe, isFirst, isLast, isGroup, participants, currentUserId, showPicker, onActivate, onLongPress, onReact, onOpenPhoto, onRetry }: BubbleProps) {
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
  const isCall  = msg.type === 'call';
  const isMedia = isImage || isVideo || isPost || isVoice;

  // Call-event system message — centred pill, not a regular bubble
  if (isCall) {
    const missed   = msg.callStatus === 'missed' || msg.callStatus === 'declined';
    const isVideo_ = msg.callType === 'video';
    return (
      <div className="flex items-center justify-center py-1">
        <div className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[#1a1a1a]/80 rounded-full text-[12px] text-[#BDBDBD] border border-[#1a1a1a]">
          {missed ? (
            <PhoneMissed size={13} className="text-red-400 flex-shrink-0" />
          ) : isVideo_ ? (
            <Video size={13} className="text-[#F5C542] flex-shrink-0" />
          ) : (
            <Phone size={13} className="text-[#F5C542] flex-shrink-0" />
          )}
          <span className={missed ? 'text-red-400 font-medium' : ''}>{msg.content}</span>
        </div>
      </div>
    );
  }

  // Deleted for everyone
  if (msg.deletedForEveryone) {
    return (
      <div className={cn('flex', isMe ? 'justify-end' : 'justify-start')}>
        <span className="text-[12.5px] text-[rgba(255,255,255,0.45)] italic px-3 py-2 bg-[#1a1a1a] rounded-2xl border border-[#1a1a1a]">
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
        <div className={cn('flex items-center gap-1 mb-1 text-[11px] text-[rgba(255,255,255,0.45)]', isMe ? 'justify-end' : 'justify-start')}>
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
          isMedia ? '' : (isMe ? 'px-4 py-2.5 text-white' : 'px-4 py-2.5 bg-[#111] border border-[#1a1a1a] text-white shadow-sm')
        )}
        style={!isMedia && isMe ? {
          background: 'linear-gradient(135deg, #6B73FF 0%, #9B59B6 50%, #FF6B9D 100%)',
          boxShadow: '0 3px 14px rgba(245,197,66,0.30)',
        } : {}}
      >
        {/* Reply quote */}
        {msg.replyToPreview && (
          <QuotedPreview preview={msg.replyToPreview} isMe={isMe} />
        )}

        {/* Content */}
        {isVoice ? (
          <div className={cn('px-3 py-2.5 rounded-[22px]', isMe ? 'text-white' : 'bg-[#111] border border-[#1a1a1a] shadow-sm', bubbleRadius)}
            style={isMe ? { background: 'linear-gradient(135deg, #6B73FF 0%, #9B59B6 50%, #FF6B9D 100%)', boxShadow: '0 3px 14px rgba(245,197,66,0.30)' } : {}}>
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
          <span className={cn('text-[10.5px] ml-1', isMe ? 'text-white/60' : 'text-[rgba(255,255,255,0.45)]')}>(edited)</span>
        )}

        {/* Pending spinner / failed indicator */}
        {msg.pending && !msg.failed && (
          <div className="absolute -bottom-1 -right-1">
            <Loader2 size={12} className="text-[rgba(255,255,255,0.45)] animate-spin" />
          </div>
        )}
        {msg.failed && (
          <div className="absolute -bottom-1 -right-1">
            <AlertCircle size={14} className="text-red-400" />
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
          <span className="text-[10px] text-[#F5C542] font-semibold">Read</span>
        </div>
      )}
      {isMe && isLast && !readByOthers.length && (
        <div className="flex items-center justify-end mt-0.5 gap-1">
          {msg.failed ? (
            <button
              onClick={e => { e.stopPropagation(); onRetry?.(); }}
              className="flex items-center gap-1 text-[10px] text-red-400 font-semibold hover:text-red-600 transition-colors"
            >
              <RefreshCw size={10} />
              Tap to retry
            </button>
          ) : msg.pending ? (
            <span className="text-[10px] text-[rgba(255,255,255,0.45)]">Sending…</span>
          ) : (
            <CheckCheck size={12} className="text-[#F5C542]" />
          )}
        </div>
      )}
    </div>
  );
}

// ─── Bubble action sheet ──────────────────────────────────────────────────────

function BubbleActionSheet({ msg, isMe, isGroup, onClose, onReply, onEdit, onCopy, onDeleteForMe, onDeleteForEveryone, onForward, onReact, onDownload }: {
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
  onReact: (emoji: string) => void;
  onDownload?: () => void;
}) {
  const canEdit    = isMe && !msg.deletedForEveryone && canEditOrDeleteForEveryone(msg, msg.senderId) && msg.type === 'text';
  const canDelAll  = isMe && canEditOrDeleteForEveryone(msg, msg.senderId);
  const isPhoto    = (msg.type === 'image') && !!(msg.mediaUrl ?? msg.localMediaUrl);

  const actions = [
    { id: 'reply',    icon: <Reply size={18} />,    label: 'Reply',               always: msg.type !== 'call' },
    { id: 'forward',  icon: <Forward size={18} />,  label: 'Forward',             always: msg.type !== 'call' },
    { id: 'download', icon: <Download size={18} />, label: 'Download photo',      always: isPhoto && !!onDownload },
    { id: 'copy',     icon: <Copy size={18} />,     label: 'Copy',                always: msg.type === 'text' },
    { id: 'edit',     icon: <Edit2 size={18} />,    label: 'Edit',                always: canEdit },
    { id: 'deleteMe', icon: <Trash2 size={18} />,   label: 'Delete for me',       always: true,  danger: true },
    { id: 'deleteAll',icon: <Trash2 size={18} />,   label: 'Delete for everyone', always: canDelAll, danger: true },
  ].filter(a => a.always);

  function handle(id: string) {
    if (id === 'reply')    onReply();
    if (id === 'forward')  onForward();
    if (id === 'download') onDownload?.();
    if (id === 'copy')     onCopy();
    if (id === 'edit')     onEdit();
    if (id === 'deleteMe') onDeleteForMe();
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
        className="fixed inset-x-0 bottom-0 z-50 bg-black rounded-t-[28px] shadow-2xl pb-8"
      >
        <div className="flex justify-center pt-3 pb-4">
          <div className="w-10 h-1 rounded-full bg-[#333]" />
        </div>
        {/* Quick reactions at top */}
        <div className="flex justify-center gap-2 px-5 pb-4 border-b border-[#1a1a1a]">
          {QUICK_REACTIONS.map(emoji => {
            const active = msg.reactions?.[emoji]?.includes(msg.senderId);
            return (
              <motion.button key={emoji} whileTap={{ scale: 0.85 }} whileHover={{ scale: 1.2, y: -3 }}
                onClick={() => { onReact(emoji); onClose(); }}
                className={cn('w-11 h-11 rounded-full flex items-center justify-center text-[22px] transition-colors', active ? 'bg-[rgba(245,197,66,0.15)]' : 'hover:bg-[#1a1a1a]')}
              >
                {emoji}
              </motion.button>
            );
          })}
        </div>
        <div className="px-5 pt-2 space-y-1">
          {actions.map(a => (
            <button key={a.id} onClick={() => handle(a.id)}
              className={cn(
                'w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-left transition-colors',
                a.danger ? 'hover:bg-red-50 text-red-500' : 'hover:bg-black/[0.04] text-white'
              )}
            >
              <span className={a.danger ? 'text-red-400' : 'text-[#BDBDBD]'}>{a.icon}</span>
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
      className="px-4 py-2.5 bg-[rgba(245,197,66,0.08)] border-t border-[rgba(245,197,66,0.2)] flex items-center gap-3"
    >
      <CornerUpLeft size={16} className="text-[#F5C542] flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[11.5px] font-bold text-[#F5C542] mb-0.5">
          Replying to {sender?.displayName ?? 'Unknown'}
        </div>
        <div className="text-[12.5px] text-[#BDBDBD] truncate">{preview}</div>
      </div>
      <button onClick={onCancel} className="p-1.5 rounded-full hover:bg-[rgba(245,197,66,0.15)] transition-colors">
        <X size={15} className="text-[rgba(255,255,255,0.45)]" />
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
      className="px-4 py-2.5 bg-[#111] border-t border-[#1a1a1a] flex items-center gap-3"
    >
      <Edit2 size={16} className="text-[#EC4899] flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-[12.5px] font-bold text-[#BDBDBD]">Editing message</div>
      </div>
      <button onClick={onCancel} className="p-1.5 rounded-full hover:bg-[#1a1a1a] transition-colors">
        <X size={15} className="text-[rgba(255,255,255,0.45)]" />
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
      className="bg-[#111] border-t border-[#1a1a1a] overflow-hidden flex-shrink-0"
    >
      <div className="flex items-center gap-1 px-4 pt-3 pb-2">
        {EMOJI_CATS.map((cat, i) => (
          <button key={cat.label} onClick={() => setActiveCat(i)}
            className={cn('px-3 py-1.5 rounded-xl text-[18px] transition-colors', activeCat === i ? 'bg-[rgba(245,197,66,0.15)]' : 'hover:bg-[#1a1a1a]')}>
            {cat.icon}
          </button>
        ))}
        <button onClick={onClose} className="ml-auto p-1.5 rounded-lg hover:bg-[#1a1a1a] transition-colors">
          <X size={16} className="text-[rgba(255,255,255,0.45)]" />
        </button>
      </div>
      <div className="px-3 overflow-y-auto" style={{ maxHeight: 196 }}>
        <div className="grid grid-cols-8 gap-0.5">
          {EMOJI_CATS[activeCat].emojis.map(emoji => (
            <button key={emoji} onClick={() => onSelect(emoji)}
              className="w-10 h-10 flex items-center justify-center text-[20px] hover:bg-[#1a1a1a] rounded-xl transition-colors">
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
      className="bg-[#111] border-t border-[#1a1a1a] px-6 py-4 flex-shrink-0"
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
          { icon: Camera,    label: 'Camera',  color: '#F5C542', action: () => { fileRef.current?.setAttribute('capture', 'environment'); fileRef.current?.click(); } },
          { icon: ImageIcon, label: 'Gallery', color: '#F5C542', action: () => { fileRef.current?.removeAttribute('capture'); fileRef.current?.click(); } },
        ].map(opt => (
          <button key={opt.label} onClick={opt.action} className="flex flex-col items-center gap-2">
            <div className="w-14 h-14 rounded-[18px] flex items-center justify-center" style={{ background: `${opt.color}22` }}>
              <opt.icon size={24} style={{ color: opt.color }} />
            </div>
            <span className="text-[12px] font-semibold text-[#BDBDBD]">{opt.label}</span>
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
      className="flex items-center gap-3 px-4 py-3 bg-[#111] border-t border-[#1a1a1a]"
    >
      <motion.div
        animate={{ opacity: [1, 0.3, 1] }}
        transition={{ repeat: Infinity, duration: 1.2 }}
        className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0"
      />
      <span className="text-[15px] font-semibold text-red-500 flex-1">
        Recording {formatVoiceDuration(duration)}
      </span>
      <button onClick={onCancel} className="p-2 rounded-full hover:bg-[#1a1a1a] transition-colors">
        <Trash2 size={18} className="text-[rgba(255,255,255,0.45)]" />
      </button>
      <button onClick={onStop}
        className="px-4 py-2 rounded-full text-white text-[13.5px] font-bold transition-all"
        style={{ background: 'linear-gradient(135deg, #EC4899, #7C3AED, #2563EB)' }}>
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
    if (id === 'mute')   { onMute();   onClose(); }
    if (id === 'block')  { onBlock();  onClose(); }
    if (id === 'leave')  { onLeave();  onClose(); }
    // 'report' intentionally does NOT call onClose() here.
    // The confirmation dialog opens on top of the sheet, and the sheet
    // closes only after the report is confirmed (or cancelled).
    if (id === 'report') { onReport(); }
  }

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" onClick={onClose} />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-50 bg-black rounded-t-[28px] shadow-2xl pb-8"
      >
        <div className="flex justify-center pt-3 pb-4">
          <div className="w-10 h-1 rounded-full bg-[#333]" />
        </div>
        <div className="px-5 space-y-1">
          {items.map(a => (
            <button key={a.id} onClick={() => handle(a.id)}
              className={cn(
                'w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-left transition-colors',
                a.danger ? 'hover:bg-red-50 text-red-500' : 'hover:bg-black/[0.04] text-white'
              )}
            >
              <span className={a.danger ? 'text-red-400' : 'text-[#BDBDBD]'}>{a.icon}</span>
              <span className={cn('font-semibold text-[15px]', a.danger && 'text-red-500')}>{a.label}</span>
            </button>
          ))}
        </div>
      </motion.div>
    </>
  );
}

// ─── Scroll-to-bottom button ──────────────────────────────────────────────────

function ScrollDownBtn({ onClick, newCount }: { onClick: () => void; newCount?: number }) {
  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-3 h-9 rounded-full shadow-lg border border-[#2a2a2a] z-10',
        newCount ? 'bg-[#F5C542] text-white pr-3.5' : 'bg-[#111] text-[#BDBDBD]',
      )}
    >
      <ChevronDown size={16} />
      {newCount ? (
        <span className="text-[12px] font-black">{newCount} new</span>
      ) : null}
    </motion.button>
  );
}

// ─── Forward picker sheet ─────────────────────────────────────────────────────

function ForwardPickerSheet({
  msg,
  conversations,
  currentUserId,
  currentUser,
  onSend,
  onClose,
}: {
  msg: LocalMsg;
  conversations: Conversation[];
  currentUserId: string;
  currentUser: User;
  onSend: (convIds: string[]) => void;
  onClose: () => void;
}) {
  const [selected, setSelected]         = useState<Set<string>>(new Set());
  const [query, setQuery]               = useState('');
  // People search (for forwarding to contacts not in existing conversations)
  const [userQuery, setUserQuery]       = useState('');
  const [userResults, setUserResults]   = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Map<string, User>>(new Map());
  const [userLoading, setUserLoading]   = useState(false);
  const userTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced user search
  useEffect(() => {
    if (!userQuery.trim()) { setUserResults([]); return; }
    if (userTimerRef.current) clearTimeout(userTimerRef.current);
    setUserLoading(true);
    userTimerRef.current = setTimeout(() => {
      fsSearchUsers(userQuery.trim())
        .then(r => {
          // Exclude self and users already in an existing DM conversation
          const existingPeerIds = new Set(
            conversations
              .filter(c => c.type !== 'group')
              .map(c => c.participants.find(p => p.id !== currentUserId)?.id)
              .filter(Boolean) as string[]
          );
          setUserResults(r.filter(u => u.id !== currentUserId && !existingPeerIds.has(u.id)));
          setUserLoading(false);
        })
        .catch(() => setUserLoading(false));
    }, 350);
  }, [userQuery, conversations, currentUserId]);

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleUser(user: User) {
    setSelectedUsers(prev => {
      const next = new Map(prev);
      if (next.has(user.id)) next.delete(user.id); else next.set(user.id, user);
      return next;
    });
  }

  const totalSelected = selected.size + selectedUsers.size;

  async function handleSend() {
    if (!totalSelected) return;
    const convIds = Array.from(selected);
    // For new contacts, create or reuse the deterministic DM conversation
    if (selectedUsers.size > 0) {
      const newIds = await Promise.all(
        Array.from(selectedUsers.keys()).map(uid =>
          fsEnsureDMConversation(currentUserId, uid)
        )
      );
      convIds.push(...newIds);
    }
    onSend(convIds);
  }

  const preview =
    msg.type === 'image'     ? '📷 Photo'
    : msg.type === 'video'   ? '🎥 Video'
    : msg.type === 'voice'   ? '🎤 Voice message'
    : msg.type === 'post_share' ? '📌 Shared post'
    : msg.type === 'call'    ? msg.content
    : (msg.editedContent ?? msg.content).slice(0, 80);

  const filtered = query.trim()
    ? conversations.filter(conv => {
        const other = conv.participants.find(p => p.id !== currentUserId) ?? conv.participants[0];
        const name  = conv.type === 'group' ? (conv.name ?? 'Group') : other.displayName;
        const handle = (other as any).handle ?? '';
        const q = query.toLowerCase();
        return name.toLowerCase().includes(q) || handle.toLowerCase().includes(q);
      })
    : conversations;

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[70]" onClick={onClose} />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-[75] bg-black rounded-t-[28px] shadow-2xl flex flex-col"
        style={{ maxHeight: '72vh' }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-[#333]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#1a1a1a] flex-shrink-0">
          <button onClick={onClose} className="p-1.5 hover:bg-[#1a1a1a] rounded-full transition-colors">
            <X size={18} className="text-[#BDBDBD]" />
          </button>
          <span className="font-black text-[16px] text-white">Forward message</span>
          <button
            disabled={totalSelected === 0}
            onClick={() => { void handleSend(); onClose(); }}
            className={cn(
              'text-[14px] font-black transition-colors',
              totalSelected > 0 ? 'text-[#F5C542]' : 'text-[rgba(255,255,255,0.35)]'
            )}
          >
            Send{totalSelected > 0 ? ` (${totalSelected})` : ''}
          </button>
        </div>

        {/* Preview of the message being forwarded */}
        <div className="mx-5 mt-3 mb-2 flex-shrink-0 px-4 py-2.5 bg-[rgba(245,197,66,0.08)] rounded-2xl border border-[rgba(245,197,66,0.2)]">
          <div className="flex items-center gap-2 mb-0.5">
            <Forward size={13} className="text-[#F5C542]" />
            <span className="text-[11px] font-bold text-[#F5C542]">Forwarding</span>
          </div>
          <p className="text-[12.5px] text-[#BDBDBD] truncate">{preview}</p>
        </div>

        {/* Search bar — searches both conversations and all users */}
        <div className="mx-5 mb-2 flex-shrink-0 space-y-2">
          <div className="flex items-center gap-2 bg-[#1a1a1a] rounded-2xl px-4 py-2.5 focus-within:bg-[#111] border border-transparent focus-within:border-[rgba(245,197,66,0.25)] transition-all">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="text-[rgba(255,255,255,0.45)] flex-shrink-0"><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/><path d="M10.5 10.5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search conversations…"
              className="flex-1 bg-transparent text-[14px] text-white placeholder:text-[#555] outline-none"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-[rgba(255,255,255,0.45)] hover:text-[#BDBDBD]">
                <X size={14} />
              </button>
            )}
          </div>
          {/* New contact search */}
          <div className="flex items-center gap-2 bg-[#1a1a1a] rounded-2xl px-4 py-2.5 focus-within:bg-[#111] border border-transparent focus-within:border-[rgba(139,92,246,0.35)] transition-all">
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className="text-violet-400 flex-shrink-0"><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5"/><path d="M10.5 10.5l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            <input
              value={userQuery}
              onChange={e => setUserQuery(e.target.value)}
              placeholder="Find a person to forward to…"
              className="flex-1 bg-transparent text-[14px] text-white placeholder:text-[#555] outline-none"
            />
            {userLoading && <div className="w-3.5 h-3.5 border-2 border-[#333] border-t-violet-400 rounded-full animate-spin" />}
            {userQuery && !userLoading && (
              <button onClick={() => { setUserQuery(''); setUserResults([]); }} className="text-[rgba(255,255,255,0.45)] hover:text-[#BDBDBD]">
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Conversation list + people search results */}
        <div className="overflow-y-auto flex-1 px-4 pb-3 space-y-2">
          {/* People search results — shown when userQuery is active */}
          {userResults.length > 0 && (
            <>
              <p className="text-[11px] font-black text-violet-400 uppercase tracking-wider px-1 pt-1">People</p>
              {userResults.map(user => {
                const sel = selectedUsers.has(user.id);
                return (
                  <motion.button
                    key={user.id}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => toggleUser(user)}
                    className={cn(
                      'w-full flex items-center gap-3.5 px-4 py-3 rounded-[18px] border transition-all text-left',
                      sel ? 'bg-[rgba(139,92,246,0.10)] border-[rgba(139,92,246,0.30)]' : 'bg-[#111] border-[#1a1a1a]'
                    )}
                  >
                    <UserAvatar userId={user.id} fallbackName={user.displayName} fallbackSrc={user.avatarUrl || undefined} size={44} />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-[14.5px] text-white truncate">{user.displayName}</p>
                      <p className="text-[12px] text-[rgba(255,255,255,0.45)] truncate">@{user.handle}</p>
                    </div>
                    <div className={cn(
                      'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all',
                      sel ? 'border-violet-500 bg-violet-500' : 'border-[#333]'
                    )}>
                      {sel && <Check size={11} className="text-white" />}
                    </div>
                  </motion.button>
                );
              })}
              {filtered.length > 0 && <p className="text-[11px] font-black text-[rgba(255,255,255,0.35)] uppercase tracking-wider px-1 pt-1">Conversations</p>}
            </>
          )}

          {filtered.length === 0 && userResults.length === 0 ? (
            <p className="text-center text-[rgba(255,255,255,0.45)] text-[14px] py-10">
              {query || userQuery ? 'No matches found' : 'No conversations yet'}
            </p>
          ) : filtered.map(conv => {
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
                  sel ? 'bg-[rgba(245,197,66,0.08)] border-[rgba(245,197,66,0.25)]' : 'bg-[#111] border-[#1a1a1a]'
                )}
              >
                <UserAvatar
                  userId={other.id}
                  fallbackName={other.displayName}
                  fallbackSrc={(other as any).avatarUrl || undefined}
                  size={44}
                />
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-[14.5px] text-white truncate">{name}</p>
                  <p className="text-[12px] text-[rgba(255,255,255,0.45)] truncate">{conv.lastMessage || 'No messages yet'}</p>
                </div>
                <div className={cn(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all',
                  sel ? 'border-[#F5C542] bg-[#F5C542]' : 'border-[#333]'
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
    subscriptionError, clearSubscriptionError,
    messageActionError, clearMessageActionError,
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

  // Real-time presence for the other participant (1-to-1 chats only).
  // Must be called here — before any early returns — to satisfy the Rules of Hooks.
  // We derive the UID directly from `conversation` rather than from `other`
  // (which is only computed post-guard) so this call is unconditional.
  const _presenceUid = (conversation?.type !== 'group')
    ? (conversation?.participants.find(p => p.id !== currentUser?.id)?.id ?? null)
    : null;
  const otherPresence = useUserPresence(_presenceUid);

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
  const [showReportConfirm, setShowReportConfirm] = useState(false);
  const [isReporting, setIsReporting]     = useState(false);
  const [reportReason, setReportReason]   = useState('');
  const [forwardMsg, setForwardMsg]       = useState<LocalMsg | null>(null);
  const [forwardDone, setForwardDone]     = useState(0); // # convs forwarded to; >0 shows toast
  const [mediaGalleryOpen, setMediaGalleryOpen] = useState(false);
  const [atBottom, setAtBottom]           = useState(true);
  const [newMsgCount, setNewMsgCount]     = useState(0);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [viewingPhoto, setViewingPhoto]   = useState<string | null>(null);
  const [dlState, setDlState]             = useState<'idle'|'loading'|'done'|'error'>('idle');

  const scrollRef          = useRef<HTMLDivElement>(null);
  const bottomRef          = useRef<HTMLDivElement>(null);
  const textareaRef        = useRef<HTMLTextAreaElement>(null);
  const isInitialLoadRef   = useRef(true);
  // Pagination scroll-preservation state
  const isPaginatingRef    = useRef(false);
  const prevScrollHeightRef = useRef(0);
  // Track message count to detect new arrivals vs pagination prepends
  const prevMsgCountRef    = useRef(0);

  // ── Hooks that must run unconditionally (before any early return) ──────────
  const [editText, setEditText] = useState('');

  // ── Pagination scroll preservation (runs synchronously before paint) ────────
  // When older messages are prepended, the scroll height grows by the height of
  // the new content. We restore scrollTop by that delta so the user's view
  // doesn't jump.
  useLayoutEffect(() => {
    if (!isPaginatingRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const delta = el.scrollHeight - prevScrollHeightRef.current;
    if (delta > 0) el.scrollTop += delta;
    // Don't reset isPaginatingRef here — let the useEffect below do it so
    // it can skip the "new message" path for the same messages update.
  }, [messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-scroll on new messages ───────────────────────────────────────────
  // Rules:
  //   • First load → instant jump to bottom
  //   • Own message sent → always smooth-scroll to bottom
  //   • Already at bottom when message arrives → smooth-scroll
  //   • Reading older messages → don't scroll; show "N new" badge instead
  //
  // atBottom is intentionally NOT in the dep array — we only want this to fire
  // when message count or typing indicators change, not on every scroll event.
  useEffect(() => {
    const count = messages.length;
    if (count === 0) return;

    // ── Initial load ──────────────────────────────────────────────────────
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false;
      prevMsgCountRef.current  = count;
      requestAnimationFrame(() => {
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      });
      return;
    }

    // ── Pagination prepend — scroll already restored by useLayoutEffect ───
    if (isPaginatingRef.current) {
      prevMsgCountRef.current = count;
      isPaginatingRef.current = false;
      return;
    }

    // ── New messages appended (subscription) ─────────────────────────────
    if (count > prevMsgCountRef.current) {
      const added     = messages.slice(prevMsgCountRef.current);
      const fromMe    = added.some(m => m.senderId === currentUser?.id);
      const fromOthers = added.filter(m => m.senderId !== currentUser?.id).length;
      prevMsgCountRef.current = count;

      if (atBottom || fromMe) {
        setNewMsgCount(0);
        requestAnimationFrame(() => {
          const el = scrollRef.current;
          // Smooth scroll for new messages so the arrival feels natural;
          // initial load uses instant scroll (handled by the branch above).
          if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        });
      } else if (fromOthers > 0) {
        // User is reading history — show badge, don't scroll
        setNewMsgCount(c => c + fromOthers);
      }
    } else {
      // Typing indicator change only — no new messages
      prevMsgCountRef.current = count;
      if (atBottom) {
        requestAnimationFrame(() => {
          const el = scrollRef.current;
          if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        });
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, typingUserIds.length]);

  // Reset download state whenever the viewer opens a different photo
  useEffect(() => { setDlState('idle'); }, [viewingPhoto]);

  // ── Guard: must be after all hooks ────────────────────────────────────────
  if (!currentUser) return null;
  // Non-null alias so closures below don't require TypeScript re-narrowing
  const cu = currentUser;

  if (!isLoading && !conversation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black">
        <p className="text-[rgba(255,255,255,0.45)]">Conversation not found</p>
        <Link href="/messages" className="mt-3 text-[#F5C542] font-semibold">← Back to Chats</Link>
      </div>
    );
  }

  const other    = conversation?.participants.find(p => p.id !== cu.id) ?? conversation?.participants[0];
  const title    = conversation ? (conversation.type === 'group' ? (conversation.name ?? 'Group') : (other?.displayName ?? '')) : '…';
  const isGroup  = conversation?.type === 'group' ? true : false;
  const isMuted  = !!(conversations.find(c => c.id === convId)?.mutedBy?.includes(cu.id));

  /** Human-readable subtitle for the chat header. */
  const headerSubtitle = isGroup
    ? `${conversation?.participants.length ?? 0} members`
    : otherPresence.isOnline
      ? 'Active now'
      : otherPresence.lastSeen
        ? `Last seen ${formatRelativeTime(otherPresence.lastSeen)}`
        : '';

  // Typing users (resolve to User objects for TypingIndicator)
  const typingUsers = (isFirebaseConfigured ? typingUserIds : (isOtherTyping && other ? [other.id] : []))
    .map(id => conversation?.participants.find(p => p.id === id))
    .filter((u): u is User => !!u);

  // ── Scroll helpers ─────────────────────────────────────────────────────────

  // ── Photo download ─────────────────────────────────────────────────────────
  async function handleDownloadPhoto(url: string) {
    setDlState('loading');
    try {
      await downloadImage(url);
      setDlState('done');
      setTimeout(() => setDlState('idle'), 2500);
    } catch {
      // URL intentionally omitted — may contain Firebase auth tokens
      setDlState('error');
    }
  }

  function scrollToBottom() {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    setAtBottom(true);
    setNewMsgCount(0);
  }

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    // Dismiss any open reaction picker on any scroll — standard mobile behaviour
    if (activePicker) setActivePicker(null);

    const fromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nowAtBottom = fromBottom < 80;
    setAtBottom(nowAtBottom);
    if (nowAtBottom) setNewMsgCount(0);

    // Load older messages when scrolled near the top
    if (el.scrollTop < 60 && hasOlderMessages && !loadingOlder) {
      // Record scroll height before the prepend so useLayoutEffect can restore position
      prevScrollHeightRef.current = el.scrollHeight;
      isPaginatingRef.current     = true;
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
    setAtBottom(true); // own message → always scroll to bottom

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
      try {
        await hookSend(text, 'text', replyOpts);
        // Real message arrives via subscription; remove optimistic copy
        setMessages(prev => prev.filter(m => m.id !== tempId));
      } catch {
        setMessages(prev => prev.map(m =>
          m.id === tempId ? { ...m, pending: false, failed: true } : m
        ));
      }
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
    setAtBottom(true); // own message → always scroll to bottom
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
      setMessages(prev => prev.map(m =>
        m.id === tempId ? { ...m, pending: false, failed: true } : m
      ));
    } finally {
      setUploadingMedia(false);
    }
  }

  async function doSendVoice() {
    const recording = await voiceRecorder.stop();
    if (!recording) return;
    setAtBottom(true); // own message → always scroll to bottom
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
      setMessages(prev => prev.map(m =>
        m.id === tempId ? { ...m, pending: false, failed: true } : m
      ));
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
      // hookToggleReaction is async — apply optimistic update immediately inside
      // the hook; errors are caught there, logged, and reverted automatically.
      // We must not leave the Promise unhandled (causes the Vite overlay), so
      // we explicitly void-cast it (errors are handled inside toggleReaction).
      void hookToggleReaction(msgId, emoji);
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
      try {
        await hookDeleteForMe(msg.id);
      } catch (err) {
        // Error is already logged + messageActionError set inside the hook.
        // Swallow here so the UI doesn't see an unhandled rejection.
        void err;
      }
    } else {
      setMessages(prev => prev.filter(m => m.id !== msg.id));
    }
  }

  async function handleDeleteForEveryone(msg: LocalMsg) {
    if (isFirebaseConfigured) {
      try {
        await hookDeleteForEveryone(msg.id);
      } catch (err) {
        void err;
      }
    } else {
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, deletedForEveryone: true } : m));
    }
  }

  // ── Safety actions ─────────────────────────────────────────────────────────

  async function handleBlock() {
    if (!other) return;
    try {
      if (isFirebaseConfigured) await fsBlockUser(cu.id, other.id);
      setLocation('/messages');
    } catch (err) {
      const e = err as { code?: string; message?: string };
      console.error('[Chat:handleBlock]', { code: e?.code, message: e?.message });
    }
  }

  function handleReport() {
    // Don't perform the report yet — just open the confirmation dialog.
    // The safety sheet stays open so the backdrop doesn't flicker away.
    setShowReportConfirm(true);
  }

  async function confirmReport() {
    if (isReporting || !reportReason) return;
    setIsReporting(true);
    try {
      if (isFirebaseConfigured) {
        const reportedUserId = conversation?.participants.find(p => p.id !== cu.id)?.id ?? null;
        const lastMsgs = messages.slice(-20).map(m => ({
          senderId: m.senderId,
          content:  m.content ?? '',
          type:     m.type    ?? 'text',
          createdAt: m.createdAt instanceof Date ? m.createdAt : null,
        }));
        await fsReport(convId, cu.id, reportReason, {
          reportedUserId,
          lastMessages: lastMsgs,
        });
      }
      setShowReportConfirm(false);
      setReportReason('');
      setSafetySheet(false);
      toast.success('Conversation reported.', {
        description: 'Thank you. Our moderation team will review this report.',
      });
    } catch (err) {
      const e = err as { code?: string; message?: string };
      console.error('[Chat:confirmReport]', { code: e?.code, message: e?.message });
      toast.error("We couldn't submit your report.", {
        description: 'Please try again.',
      });
    } finally {
      setIsReporting(false);
    }
  }

  async function handleLeave() {
    try {
      if (isFirebaseConfigured) await fsLeave(convId, cu.id);
      setLocation('/messages');
    } catch (err) {
      const e = err as { code?: string; message?: string };
      console.error('[Chat:handleLeave]', { code: e?.code, message: e?.message });
    }
  }

  async function handleRetry(msg: LocalMsg) {
    if (!isFirebaseConfigured) return;
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, pending: true, failed: false } : m));
    try {
      await hookSend(msg.content, msg.type ?? 'text', {
        replyToId: msg.replyToId,
        replyToPreview: msg.replyToPreview,
        ...(msg.mediaUrl ? { mediaUrl: msg.mediaUrl, mediaType: msg.mediaType } : {}),
      });
      setMessages(prev => prev.filter(m => m.id !== msg.id));
    } catch {
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, pending: false, failed: true } : m));
    }
  }

  async function handleForwardSend(convIds: string[]) {
    if (!forwardMsg || !convIds.length) return;
    const content =
      forwardMsg.type === 'image'        ? '📷 Photo'
      : forwardMsg.type === 'video'      ? '🎥 Video'
      : forwardMsg.type === 'voice'      ? '🎤 Voice message'
      : forwardMsg.type === 'post_share' ? '📌 Shared post'
      : (forwardMsg.editedContent ?? forwardMsg.content);

    // Resolve sender display name — participant list first, then original forwardedFrom
    // attribution if this is a re-forward, finally fall back to the raw UID.
    const senderName =
      conversation?.participants.find(p => p.id === forwardMsg.senderId)?.displayName
      ?? forwardMsg.forwardedFrom?.senderName
      ?? forwardMsg.senderId;

    const fwdOpts = {
      forwardedFrom: { senderId: forwardMsg.senderId, senderName },
      ...(forwardMsg.mediaUrl   ? { mediaUrl: forwardMsg.mediaUrl, mediaType: forwardMsg.mediaType }   : {}),
      ...(forwardMsg.sharedPost ? { sharedPost: forwardMsg.sharedPost }                                : {}),
      // Preserve voice-message playback metadata so waveform + duration survive the forward
      ...(forwardMsg.voiceDuration   != null ? { voiceDuration: forwardMsg.voiceDuration }             : {}),
      ...(forwardMsg.voiceWaveformData?.length ? { voiceWaveformData: forwardMsg.voiceWaveformData }   : {}),
    };

    if (isFirebaseConfigured) {
      try {
        await Promise.all(convIds.map(cid =>
          fsSendMessage(cid, cu.id, content, forwardMsg.type ?? 'text', fwdOpts)
        ));
      } catch (err) {
        const e = err as { code?: string; message?: string };
        console.error('[Chat:handleForwardSend]', { code: e?.code, message: e?.message });
      }
    } else {
      // Demo mode: inject the forwarded message into mockMessages for each target
      // conversation so it appears when the user navigates there, and update local
      // state immediately if the current conversation is among the targets.
      const tempBase = {
        senderId: cu.id,
        content,
        type: forwardMsg.type ?? 'text',
        reactions: {} as Record<string, string[]>,
        readBy: [cu.id],
        forwardedFrom: { senderId: forwardMsg.senderId, senderName },
        ...(forwardMsg.mediaUrl ? { mediaUrl: forwardMsg.mediaUrl, mediaType: forwardMsg.mediaType } : {}),
        ...(forwardMsg.sharedPost ? { sharedPost: forwardMsg.sharedPost } : {}),
        ...(forwardMsg.voiceDuration   != null ? { voiceDuration: forwardMsg.voiceDuration }          : {}),
        ...(forwardMsg.voiceWaveformData?.length ? { voiceWaveformData: forwardMsg.voiceWaveformData } : {}),
      };
      for (const cid of convIds) {
        const tempMsg: LocalMsg = { ...tempBase, id: `fwd-${Date.now()}-${cid}`, createdAt: new Date() };
        if (!mockMessages[cid]) mockMessages[cid] = [];
        mockMessages[cid].push(tempMsg);
        // If this is the currently open conversation, update live state too
        if (cid === convId) setMessages(prev => [...prev, tempMsg]);
      }
    }

    setForwardMsg(null);
    setForwardDone(convIds.length);
    // Auto-dismiss the toast
    setTimeout(() => setForwardDone(0), 2500);
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

  // Index of the last slot from the current user — "Seen" chip goes here.
  const lastMeSlotIdx = slots.reduce(
    (acc, slot, i) => (slot.type === 'group' && slot.group.senderId === cu?.id ? i : acc),
    -1,
  );

  // Timestamp of the most recently sent (non-pending) message from the current user.
  // Used as a threshold: a recipient's seenBy entry only counts if it is AFTER this
  // timestamp — preventing stale seenBy values (from a previous session before this
  // message was sent) from triggering a false "Seen" on newly sent messages.
  const lastMyMsgAt: number = (() => {
    const myMsgs = visibleMessages.filter(m => m.senderId === cu?.id && !m.pending);
    if (!myMsgs.length) return 0;
    return safeGetTime(myMsgs[myMsgs.length - 1].createdAt);
  })();

  // Show "Seen" only if a recipient's seenBy timestamp is strictly AFTER the current
  // user's last sent message. This prevents the two failure modes:
  //   1. Stale seenBy from a previous conversation visit showing "Seen" on new messages.
  //   2. The sender's own seenBy entry (written when they opened the chat) triggering
  //      "Seen" on their own messages (their uid is excluded, but belt-and-suspenders).
  const seenByOthers = lastMyMsgAt > 0 && Object.entries(conversation?.seenBy ?? {}).some(
    ([uid, seenDate]) => {
      if (uid === cu?.id) return false;                                      // never count own entry
      const seenAt = seenDate instanceof Date ? seenDate.getTime() : 0;
      return seenAt > lastMyMsgAt;                                           // must be AFTER our message
    }
  );

  const inputVal = editingMsg ? editText : inputText;
  const hasText  = inputVal.trim().length > 0;

  return (
    /*
     * Outer container is position:fixed on mobile so it fills the exact
     * viewport and completely escapes AppShell's pt-14 / pb-20 padding.
     * On md+ we switch back to relative + h-dvh so it sits inside the
     * sidebar layout without covering it.
     */
    <div
      className="flex flex-col bg-black fixed inset-0 z-[60] md:relative md:inset-auto md:z-auto"
      style={{ height: '100dvh' } as React.CSSProperties}
    >

      {/* ── Message action error toast ───────────────────────────────────────── */}
      {/* Shown when a reaction, edit, or delete fails — replaces the Vite overlay.
          Auto-dismissed after 5 s so it doesn't linger when the user keeps chatting. */}
      {messageActionError && (
        <div
          className="absolute top-16 left-1/2 -translate-x-1/2 z-50 flex items-start gap-2 px-4 py-2.5 rounded-xl shadow-lg max-w-xs w-[90%]"
          style={{ background: 'rgba(30,10,10,0.97)', border: '1px solid rgba(239,68,68,0.35)' }}
        >
          <span className="text-red-400 flex-shrink-0 mt-0.5 text-[14px]">⚠</span>
          <p className="text-red-300 text-[12px] leading-snug flex-1">{messageActionError}</p>
          <button
            onClick={clearMessageActionError}
            className="text-red-400/60 hover:text-red-300 flex-shrink-0 text-[16px] leading-none -mt-0.5"
            aria-label="Dismiss"
          >×</button>
        </div>
      )}

      {/* ── Subscription error banner ────────────────────────────────────────── */}
      {/* Shown instead of (or alongside) the Vite runtime overlay when Firestore
          returns a permission error. Gives the user an actionable message and
          logs enough context in the console for developers to diagnose. */}
      {subscriptionError && (
        <div
          className="flex-shrink-0 flex items-start gap-3 px-4 py-3 z-20"
          style={{ background: 'rgba(239,68,68,0.12)', borderBottom: '1px solid rgba(239,68,68,0.25)' }}
        >
          <span className="text-red-400 mt-0.5 flex-shrink-0">⚠</span>
          <div className="flex-1 min-w-0">
            <p className="text-red-300 text-[12.5px] font-semibold leading-snug">
              Couldn't load conversation
            </p>
            <p className="text-red-400/70 text-[11px] mt-0.5 leading-snug">
              {subscriptionError.includes('permission-denied')
                ? 'You may not have access to this conversation, or it was removed.'
                : 'A network or permission error occurred. Check the console for details.'}
            </p>
            <p className="text-red-500/50 text-[10px] mt-1 font-mono break-all">
              {subscriptionError}
            </p>
          </div>
          <button
            onClick={clearSubscriptionError}
            className="text-red-400/60 hover:text-red-300 flex-shrink-0 text-[18px] leading-none mt-0.5"
            aria-label="Dismiss error"
          >×</button>
        </div>
      )}

      {/* ── Header — flex-shrink-0 keeps it pinned; no sticky needed ── */}
      <header className="flex-shrink-0 flex items-center gap-3 px-3 py-3 bg-black/95 backdrop-blur-xl border-b border-[#1a1a1a] shadow-sm z-10">
        <Link href="/messages">
          <button className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-[#1a1a1a] transition-colors flex-shrink-0">
            <ArrowLeft size={20} className="text-[#BDBDBD]" />
          </button>
        </Link>

        <div className="relative flex-shrink-0">
          {isGroup ? (
            <div className="relative w-10 h-10">
              {(conversation?.participants.filter(p => p.id !== cu.id) ?? []).slice(0, 2).map((p, i) => (
                <div key={p.id} className="absolute border-2 border-black rounded-full"
                  style={i === 0 ? { bottom: 0, left: 0 } : { top: 0, right: 0 }}>
                  <UserAvatar userId={p.id} fallbackName={p.displayName} fallbackSrc={(p as any).avatarUrl || undefined} size={28} />
                </div>
              ))}
            </div>
          ) : other ? (
            <Link href={`/profile/${other.id}`} className="flex contents">
              <UserAvatar userId={other.id} fallbackName={other.displayName} fallbackSrc={(other as any).avatarUrl || undefined} size={40} />
              {otherPresence.isOnline && (
                <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-400 border-2 border-black" />
              )}
            </Link>
          ) : null}
        </div>

        <div
          className={`flex-1 min-w-0 ${!isGroup && other ? 'cursor-pointer' : ''}`}
          onClick={!isGroup && other ? () => setLocation(`/profile/${other.id}`) : undefined}
        >
          <h2 className="font-black text-[15px] text-white truncate leading-tight">{title}</h2>
          {headerSubtitle && (
            <p className={`text-[12px] font-semibold leading-tight ${otherPresence.isOnline || isGroup ? 'text-green-500' : 'text-[rgba(255,255,255,0.45)]'}`}>
              {headerSubtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          {/* Voice + video only for 1-to-1 chats */}
          {!isGroup && (
            <>
              <button
                data-testid="start-voice-call-btn"
                onClick={() => other && startCall(other.id, other.displayName, other.avatarUrl ?? '', convId, 'voice')}
                className="w-9 h-9 rounded-full flex items-center justify-center text-[rgba(255,255,255,0.45)] hover:bg-[#1a1a1a] hover:text-[#BDBDBD] transition-colors">
                <Phone size={18} />
              </button>
              <button
                data-testid="start-video-call-btn"
                onClick={() => other && startCall(other.id, other.displayName, other.avatarUrl ?? '', convId, 'video')}
                className="w-9 h-9 rounded-full flex items-center justify-center text-[rgba(255,255,255,0.45)] hover:bg-[#1a1a1a] hover:text-[#BDBDBD] transition-colors">
                <Video size={20} />
              </button>
            </>
          )}
          <button
            onClick={() => setMediaGalleryOpen(true)}
            title="Media gallery"
            className="w-9 h-9 rounded-full flex items-center justify-center text-[rgba(255,255,255,0.45)] hover:bg-[#1a1a1a] hover:text-[#BDBDBD] transition-colors">
            <GalleryHorizontal size={18} />
          </button>
          <button onClick={() => setSafetySheet(true)}
            className="w-9 h-9 rounded-full flex items-center justify-center text-[rgba(255,255,255,0.45)] hover:bg-[#1a1a1a] hover:text-[#BDBDBD] transition-colors">
            <MoreHorizontal size={20} />
          </button>
        </div>
      </header>

      {/* ── Messages area ─────────────────────────────────────────────── */}
      {/*
       * THE scroll container. Rules:
       *  • flex:1 + min-h-0  → takes remaining height without overflowing parent
       *  • overflow-y:auto   → only this element scrolls; nothing above or below
       *  • -webkit-overflow-scrolling:touch → momentum scrolling on iOS
       *  • overscroll-behavior-y:contain    → prevents pull-to-refresh while in chat
       * The activePicker overlay (fixed inset-0) has been removed — it blocked
       * touch events and prevented scrolling while any reaction picker was open.
       * Dismissal is now handled by handleScroll (any scroll closes the picker)
       * and by tapping outside a bubble in the message list.
       */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        onClick={() => activePicker && setActivePicker(null)}
        className="flex-1 min-h-0 overflow-y-auto relative"
        style={{
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorY: 'contain',
        } as React.CSSProperties}
      >
        {/* Load-older spinner lives INSIDE the scroll container so it never
            shifts the container's height or causes scroll-position jumps */}
        {loadingOlder && (
          <div className="flex items-center justify-center py-3">
            <Loader2 size={18} className="text-[#F5C542] animate-spin" />
          </div>
        )}
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
                    {/* Avatar links to sender's profile in both DM and group chats */}
                    <Link
                      href={`/profile/${group.senderId}`}
                      aria-label={`View ${senderName}'s profile`}
                      className="block rounded-full"
                    >
                      <UserAvatar userId={group.senderId} fallbackName={senderName} fallbackSrc={sender ? (sender as any).avatarUrl || undefined : undefined} size={30} />
                    </Link>
                  </div>
                )}
                <div className={cn('flex flex-col gap-1 max-w-[72%]', isMe ? 'items-end' : 'items-start')}>
                  {isGroup && !isMe && (
                    <span className="text-[11.5px] font-semibold text-[rgba(255,255,255,0.45)] ml-1 mb-0.5">{senderName}</span>
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
                        onRetry={() => handleRetry(msg)}
                      />
                      <ReactionDisplay
                        reactions={msg.reactions}
                        currentUserId={cu.id}
                        onReact={emoji => handleReact(msg.id, emoji)}
                        isMe={isMe}
                      />
                    </div>
                  ))}
                  <span className="text-[10.5px] text-[rgba(255,255,255,0.45)] mt-0.5 mx-1">
                    {format(group.msgs[group.msgs.length - 1].createdAt, 'h:mm a')}
                  </span>
                  {/* Seen receipt — shown only below the last message group from the current user */}
                  {isMe && si === lastMeSlotIdx && seenByOthers && (
                    <span className="text-[10.5px] text-[#F5C542] mt-0.5 mr-1 flex items-center gap-0.5 self-end">
                      <CheckCheck size={11} className="text-[#F5C542]" /> Seen
                    </span>
                  )}
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
              <ScrollDownBtn onClick={scrollToBottom} newCount={newMsgCount} />
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
          className="sticky bottom-0 z-20 bg-black/95 backdrop-blur-xl border-t border-[#1a1a1a] flex-shrink-0"
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
                attachOpen ? 'text-white shadow-md' : 'text-[rgba(255,255,255,0.45)] hover:text-[#F5C542] hover:bg-[rgba(245,197,66,0.08)]'
              )}
              style={attachOpen ? { background: 'linear-gradient(135deg, #EC4899, #7C3AED, #2563EB)' } : {}}
            >
              {uploadingMedia ? <Loader2 size={20} className="animate-spin" /> : <ImageIcon size={21} />}
            </motion.button>

            {/* Text input */}
            <div className="flex-1 flex items-end bg-[#1a1a1a] rounded-[22px] px-4 py-2.5 gap-2 focus-within:bg-[#111] focus-within:ring-2 focus-within:ring-purple-200 transition-all border border-transparent focus-within:border-[rgba(245,197,66,0.25)]">
              <textarea
                ref={textareaRef}
                value={inputVal}
                onChange={handleInput}
                onKeyDown={handleKeyDown}
                placeholder={editingMsg ? 'Edit message…' : 'Message…'}
                rows={1}
                className="flex-1 bg-transparent outline-none resize-none text-[15px] text-white placeholder:text-[#555] leading-[1.4] max-h-[120px] overflow-y-auto"
                style={{ lineHeight: '1.4' }}
              />
              <motion.button whileTap={{ scale: 0.88 }}
                onClick={() => { setEmojiOpen(v => !v); setAttachOpen(false); }}
                className={cn('flex-shrink-0 text-[rgba(255,255,255,0.45)] hover:text-[#F5C542] transition-colors self-end mb-0.5', emojiOpen && 'text-[#F5C542]')}
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
                  style={{ background: 'linear-gradient(135deg, #EC4899, #7C3AED, #2563EB)', boxShadow: '0 3px 12px rgba(107,115,255,0.40)' }}
                >
                  {editingMsg ? <Check size={18} /> : <Send size={17} className="ml-0.5 -mt-0.5" />}
                </motion.button>
              ) : (
                <motion.button key="mic"
                  initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}
                  whileTap={{ scale: 0.88 }}
                  onClick={voiceRecorder.start}
                  className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-[#1a1a1a] text-[#BDBDBD] hover:bg-[rgba(245,197,66,0.08)] hover:text-[#F5C542] transition-all mb-0.5"
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
            onReact={emoji => { handleReact(actionMsg.id, emoji); }}
            onDownload={
              (actionMsg.type === 'image' && (actionMsg.mediaUrl ?? actionMsg.localMediaUrl))
                ? () => handleDownloadPhoto(actionMsg.mediaUrl ?? actionMsg.localMediaUrl ?? '')
                : undefined
            }
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
        {/* ── Report confirmation dialog ──────────────────────────────────── */}
        {showReportConfirm && (
          <>
            {/* Backdrop — sits above safety sheet */}
            <motion.div
              key="report-bg"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70]"
              onClick={() => { if (!isReporting) { setShowReportConfirm(false); setReportReason(''); } }}
            />
            {/* Dialog */}
            <motion.div
              key="report-dialog"
              initial={{ opacity: 0, scale: 0.94, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 8 }}
              transition={{ type: 'spring', damping: 24, stiffness: 320 }}
              className="fixed inset-x-6 top-1/2 -translate-y-1/2 z-[71] rounded-[22px] overflow-hidden px-6 py-7"
              style={{
                background: 'rgba(14,10,26,0.98)',
                border: '1.5px solid rgba(236,72,153,0.25)',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
              }}
            >
              <div className="flex items-center justify-center w-12 h-12 rounded-full mb-4 mx-auto"
                style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>
                <Flag size={20} className="text-red-400" />
              </div>
              <h2 className="text-white text-[17px] font-black text-center mb-1.5">Report Conversation</h2>
              <p className="text-white/55 text-[13px] text-center leading-relaxed mb-5">
                What's the problem? This helps our moderation team act quickly.
              </p>

              {/* Reason picker */}
              <div className="space-y-2 mb-6">
                {(['Child Safety / CSAM', 'Spam', 'Harassment', 'Hate speech', 'Scam or fraud', 'Other'] as const).map(reason => (
                  <button
                    key={reason}
                    onClick={() => setReportReason(reason)}
                    disabled={isReporting}
                    className={cn(
                      'w-full flex items-center justify-between px-4 py-3 rounded-[14px] text-[14px] font-semibold transition-all text-left',
                      reportReason === reason
                        ? 'text-white'
                        : 'text-white/70'
                    )}
                    style={
                      reportReason === reason
                        ? { background: 'rgba(239,68,68,0.18)', border: '1.5px solid rgba(239,68,68,0.5)' }
                        : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }
                    }
                  >
                    <span>{reason}</span>
                    {reportReason === reason && (
                      <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                        <Check size={11} className="text-white" strokeWidth={3} />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { setShowReportConfirm(false); setReportReason(''); }}
                  disabled={isReporting}
                  className="flex-1 py-3 rounded-[14px] text-[14px] font-bold text-white/70 transition-colors active:bg-white/10 disabled:opacity-50"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmReport}
                  disabled={isReporting || !reportReason}
                  className="flex-1 py-3 rounded-[14px] text-[14px] font-bold text-white transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
                  style={{ background: 'linear-gradient(135deg, #EF4444, #DC2626)' }}
                >
                  {isReporting ? (
                    <><Loader2 size={14} className="animate-spin" /> Reporting…</>
                  ) : 'Report'}
                </button>
              </div>
            </motion.div>
          </>
        )}

        {forwardMsg && cu && (
          <ForwardPickerSheet
            key="forward"
            msg={forwardMsg}
            conversations={conversations.filter(c => c.id !== convId)}
            currentUserId={cu.id}
            currentUser={cu as unknown as User}
            onSend={handleForwardSend}
            onClose={() => setForwardMsg(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Forward success toast ────────────────────────────────────── */}
      <AnimatePresence>
        {forwardDone > 0 && (
          <motion.div
            key="fwd-toast"
            initial={{ opacity: 0, y: 20, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[90] flex items-center gap-2 px-5 py-3 rounded-full shadow-xl text-white text-[13.5px] font-semibold pointer-events-none"
            style={{ background: 'linear-gradient(135deg, #EC4899, #7C3AED, #2563EB)', boxShadow: '0 6px 24px rgba(245,197,66,0.45)' }}
          >
            <CheckCircle size={15} />
            Forwarded to {forwardDone} chat{forwardDone !== 1 ? 's' : ''}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Media gallery overlay ────────────────────────────────────── */}
      <AnimatePresence>
        {mediaGalleryOpen && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[80]"
              onClick={() => setMediaGalleryOpen(false)} />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-[85] bg-black rounded-t-[28px] shadow-2xl flex flex-col"
              style={{ maxHeight: '80vh' }}
            >
              <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
                <div className="w-10 h-1 rounded-full bg-[#333]" />
              </div>
              <div className="flex items-center justify-between px-5 py-3 border-b border-[#1a1a1a] flex-shrink-0">
                <button onClick={() => setMediaGalleryOpen(false)} className="p-1.5 hover:bg-[#1a1a1a] rounded-full transition-colors">
                  <X size={18} className="text-[#BDBDBD]" />
                </button>
                <span className="font-black text-[16px] text-white">Media</span>
                <div className="w-8" />
              </div>
              {(() => {
                const mediaMessages = messages.filter(m =>
                  (m.type === 'image' || m.type === 'video') &&
                  (m.mediaUrl || m.localMediaUrl) &&
                  !m.deletedForEveryone
                );
                if (mediaMessages.length === 0) {
                  return (
                    <div className="flex flex-col items-center justify-center flex-1 py-16 text-center px-6">
                      <GalleryHorizontal size={40} className="text-gray-200 mb-4" />
                      <p className="font-bold text-[15px] text-[#BDBDBD] mb-1">No media yet</p>
                      <p className="text-[13px] text-[rgba(255,255,255,0.45)]">Photos and videos shared in this conversation will appear here.</p>
                    </div>
                  );
                }
                return (
                  <div className="overflow-y-auto flex-1 p-3">
                    <div className="grid grid-cols-3 gap-1">
                      {[...mediaMessages].reverse().map(m => {
                        const url = m.mediaUrl ?? m.localMediaUrl ?? '';
                        return (
                          <motion.button
                            key={m.id}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => { setViewingPhoto(url); setMediaGalleryOpen(false); }}
                            className="relative aspect-square rounded-[12px] overflow-hidden bg-[#1a1a1a]"
                          >
                            {m.type === 'video' ? (
                              <div className="w-full h-full flex items-center justify-center bg-gray-900">
                                <Play size={24} className="text-white" />
                              </div>
                            ) : (
                              <img src={url} alt="" className="w-full h-full object-cover" />
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Full-screen photo viewer */}
      {viewingPhoto && (
        <div
          className="fixed inset-0 z-[120] bg-black/95 flex items-center justify-center"
          onClick={() => setViewingPhoto(null)}
        >
          {/* Close */}
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-[#111]/10 flex items-center justify-center text-white hover:bg-[#111]/20 transition-colors z-10"
            onClick={() => setViewingPhoto(null)}
          >
            ✕
          </button>

          {/* Image */}
          <img
            src={viewingPhoto}
            alt=""
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={e => e.stopPropagation()}
          />

          {/* Download button — bottom centre */}
          <div
            className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
            onClick={e => e.stopPropagation()}
          >
            <AnimatePresence mode="wait">
              {dlState === 'done' ? (
                <motion.div
                  key="done"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex items-center gap-2 px-4 py-2.5 bg-green-500 text-white text-[13px] font-semibold rounded-full shadow-lg"
                >
                  <CheckCircle size={15} />
                  Photo saved
                </motion.div>
              ) : dlState === 'error' ? (
                <motion.div
                  key="error"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex flex-col items-center gap-1.5"
                >
                  <span className="text-[12px] text-red-400 font-semibold">Download failed</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleDownloadPhoto(viewingPhoto)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-[#111]/15 text-white text-[13px] font-semibold rounded-full hover:bg-[#111]/25 transition-colors"
                    >
                      <RefreshCw size={14} />
                      Retry
                    </button>
                    {typeof navigator.share === 'function' && (
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch(viewingPhoto, { mode: 'cors', cache: 'no-store' });
                            const blob = await res.blob();
                            const file = new File([blob], 'noelaven-photo.jpg', { type: blob.type });
                            if (navigator.canShare?.({ files: [file] })) {
                              await navigator.share({ files: [file] });
                            }
                          } catch { /* ignore */ }
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 bg-[#111]/15 text-white text-[13px] font-semibold rounded-full hover:bg-[#111]/25 transition-colors"
                      >
                        <Share2 size={14} />
                        Share
                      </button>
                    )}
                  </div>
                </motion.div>
              ) : (
                <motion.button
                  key="download"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => handleDownloadPhoto(viewingPhoto)}
                  disabled={dlState === 'loading'}
                  className="flex items-center gap-2 px-5 py-2.5 bg-[#111]/15 text-white text-[13px] font-semibold rounded-full hover:bg-[#111]/25 active:scale-95 transition-all disabled:opacity-60"
                >
                  {dlState === 'loading' ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Download size={15} />
                  )}
                  {dlState === 'loading' ? 'Saving…' : 'Download'}
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
