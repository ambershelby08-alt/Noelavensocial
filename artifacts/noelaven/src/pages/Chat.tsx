import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useRoute, Link } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Phone, Video, MoreHorizontal, Image as ImageIcon,
  Smile, Mic, Send, X, Camera, File, MapPin, ChevronDown,
  Check, CheckCheck,
} from 'lucide-react';
import { mockMessages } from '@/lib/mockData';
import type { Message, User } from '@/lib/mockData';
import { useMessages } from '@/hooks/useMessages';
import { isFirebaseConfigured } from '@/lib/firebase';
import { GradientAvatar } from '@/components/ui/GradientAvatar';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday, isSameDay } from 'date-fns';

// ─── Constants ────────────────────────────────────────────────────────────────

const QUICK_REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥', '🎉', '✨'];

const EMOJI_CATS = [
  {
    icon: '⭐', label: 'Popular',
    emojis: ['❤️', '😂', '😮', '😢', '👍', '🔥', '🎉', '✨', '😍', '🥰', '😊', '😎', '🤩', '😄', '🙌', '💯', '🫶', '💜', '🤣', '😅'],
  },
  {
    icon: '😊', label: 'Faces',
    emojis: ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '🙂', '😉', '😌', '😍', '🥰', '🤩', '😎', '🤓', '🧐', '😏', '🥹', '🤗', '😴', '🥳', '😈', '🤔', '😶', '🫡', '🤭', '😬', '🫠', '🥺'],
  },
  {
    icon: '👋', label: 'Gestures',
    emojis: ['👍', '👎', '👊', '✊', '🤛', '🤜', '🤞', '✌️', '🤟', '🤙', '👋', '🤚', '✋', '💪', '🫶', '👏', '🙌', '🤝', '🫂', '🙏', '💅', '🤳', '💪', '🖖'],
  },
  {
    icon: '🌟', label: 'More',
    emojis: ['✨', '🌟', '💫', '⭐', '🔥', '💥', '🎉', '🎊', '🎈', '🎁', '🏆', '💯', '🎯', '🌈', '⚡', '🌊', '🍕', '🎵', '📷', '💻', '📚', '💡', '🚀', '🌸', '🦋', '🌺'],
  },
];

const CANNED_REPLIES: Record<string, string[]> = {
  'conv-1': [
    "That's such a good point! 🙌",
    "Haha yes exactly!! I was thinking the same",
    "Omg love that idea!!",
    "Wait really?? Tell me more ✨",
    "I was literally just thinking about this 😅",
    "The vibes are immaculate rn",
    "Say less, I'm on it 🎨",
    "This is giving me so many ideas",
    "Ugh yes we NEED to collab on this 💜",
    "Ok I'm obsessed with this direction",
  ],
  'conv-2': [
    "Yeah that makes sense actually",
    "Haha true, classic dev life 😅",
    "Have you tried the new dev tools? Game changer",
    "Wait that's actually really smart",
    "Let me check that real quick",
    "LGTM 👍",
    "Okay that's pretty clean ngl",
    "Ship it 🚀",
    "Did you run the tests?",
    "Nice catch!",
  ],
  'conv-3': [
    "Sounds good! 🚀",
    "On it! Will update you soon",
    "Great work everyone! 💜",
    "Let's sync tomorrow to review",
    "This is looking really good",
    "I'll handle that!",
    "Pushing the changes now",
    "Done! Let me know if anything else comes up",
  ],
};

function getCannedReply(convId: string): string {
  const arr = CANNED_REPLIES[convId] ?? CANNED_REPLIES['conv-1'];
  return arr[Math.floor(Math.random() * arr.length)];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: Date): string {
  if (isToday(d))     return 'Today';
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'EEEE, MMMM d');
}

// ─── Local message type ───────────────────────────────────────────────────────

interface LocalMsg extends Message {
  pending?: boolean;
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
            <motion.div
              key={i}
              className="w-2 h-2 rounded-full bg-gray-400"
              animate={{ y: [0, -5, 0] }}
              transition={{ repeat: Infinity, duration: 0.7, delay: i * 0.18, ease: 'easeInOut' }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Image placeholder ────────────────────────────────────────────────────────

function ImagePlaceholder({ isMe }: { isMe: boolean }) {
  return (
    <div
      className="relative overflow-hidden rounded-[18px] w-52 h-44 flex flex-col items-center justify-center gap-2"
      style={{
        background: isMe
          ? 'linear-gradient(135deg, rgba(107,115,255,0.35) 0%, rgba(255,107,157,0.35) 100%)'
          : 'linear-gradient(135deg, #F3F0FF 0%, #FFF0F6 100%)',
      }}
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{ background: isMe ? 'rgba(255,255,255,0.25)' : 'rgba(107,115,255,0.12)' }}
      >
        <ImageIcon size={22} className={isMe ? 'text-white' : 'text-purple-400'} />
      </div>
      <p className={cn('text-[13px] font-medium', isMe ? 'text-white/80' : 'text-gray-400')}>Photo</p>
      {/* Simulated shimmer bar */}
      <div className={cn('absolute bottom-3 left-4 right-4 h-1 rounded-full opacity-30', isMe ? 'bg-white' : 'bg-purple-300')} />
    </div>
  );
}

// ─── Reaction display ─────────────────────────────────────────────────────────

function ReactionDisplay({
  reactions, currentUserId, onReact, isMe,
}: {
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
          <motion.button
            key={emoji}
            whileTap={{ scale: 0.88 }}
            onClick={() => onReact(emoji)}
            className={cn(
              'flex items-center gap-1 px-2.5 py-[3px] rounded-full text-[12.5px] font-semibold border transition-all',
              active
                ? 'bg-purple-100 border-purple-200 text-purple-700'
                : 'bg-white border-black/[0.06] text-gray-600 hover:bg-gray-50'
            )}
          >
            <span>{emoji}</span>
            <span>{users.length}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

// ─── Quick reaction picker ────────────────────────────────────────────────────

function ReactionPicker({
  isMe, reactions, currentUserId, onReact,
}: {
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
          <motion.button
            key={emoji}
            whileHover={{ scale: 1.3, y: -3 }}
            whileTap={{ scale: 0.85 }}
            onClick={() => onReact(emoji)}
            className={cn(
              'w-9 h-9 rounded-full flex items-center justify-center text-[18px] transition-colors',
              active ? 'bg-purple-100' : 'hover:bg-gray-100'
            )}
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
  onReact: (emoji: string) => void;
}

function MessageBubble({
  msg, isMe, isFirst, isLast, isGroup, participants,
  currentUserId, showPicker, onActivate, onReact,
}: BubbleProps) {
  const isImage = msg.type === 'image';
  const readByOthers = msg.readBy.filter(id => id !== currentUserId);

  const bubbleRadius = isMe
    ? cn('rounded-[22px]', isFirst ? 'rounded-tr-md' : '', isLast ? 'rounded-br-md' : '')
    : cn('rounded-[22px]', isFirst ? 'rounded-tl-md' : '', isLast ? 'rounded-bl-md' : '');

  return (
    <div className="relative">
      {/* Reaction picker */}
      <AnimatePresence>
        {showPicker && (
          <ReactionPicker
            isMe={isMe}
            reactions={msg.reactions}
            currentUserId={currentUserId}
            onReact={onReact}
          />
        )}
      </AnimatePresence>

      {/* Bubble */}
      <motion.div
        whileTap={{ scale: 0.97 }}
        onClick={onActivate}
        className={cn(
          'cursor-pointer relative overflow-visible',
          bubbleRadius,
          isImage ? '' : (
            isMe
              ? 'px-4 py-2.5 text-white'
              : 'px-4 py-2.5 bg-white border border-black/[0.06] text-gray-800 shadow-sm'
          )
        )}
        style={!isImage && isMe ? {
          background: 'linear-gradient(135deg, #6B73FF 0%, #9B59B6 50%, #FF6B9D 100%)',
          boxShadow: '0 3px 14px rgba(107,115,255,0.30)',
        } : {}}
      >
        {isImage ? (
          <ImagePlaceholder isMe={isMe} />
        ) : (
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
        )}
      </motion.div>

      {/* Read receipts (last sent message only) */}
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

      {/* Delivery state for pending */}
      {isMe && isLast && !readByOthers.length && (
        <div className="flex items-center justify-end mt-0.5">
          {msg.pending
            ? <span className="text-[10px] text-gray-400">Sending…</span>
            : <CheckCheck size={12} className="text-purple-400" />
          }
        </div>
      )}
    </div>
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
      {/* Category tabs */}
      <div className="flex items-center gap-1 px-4 pt-3 pb-2">
        {EMOJI_CATS.map((cat, i) => (
          <button
            key={cat.label}
            onClick={() => setActiveCat(i)}
            className={cn(
              'px-3 py-1.5 rounded-xl text-[18px] transition-colors',
              activeCat === i ? 'bg-purple-100' : 'hover:bg-gray-100'
            )}
          >
            {cat.icon}
          </button>
        ))}
        <button onClick={onClose} className="ml-auto p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
          <X size={16} className="text-gray-400" />
        </button>
      </div>
      {/* Emoji grid */}
      <div className="px-3 overflow-y-auto" style={{ maxHeight: 196 }}>
        <div className="grid grid-cols-8 gap-0.5">
          {EMOJI_CATS[activeCat].emojis.map(emoji => (
            <button
              key={emoji}
              onClick={() => onSelect(emoji)}
              className="w-10 h-10 flex items-center justify-center text-[20px] hover:bg-gray-100 rounded-xl transition-colors"
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Attachment sheet ─────────────────────────────────────────────────────────

function AttachmentSheet({ onSelect, onClose }: { onSelect: (type: string) => void; onClose: () => void }) {
  const options = [
    { icon: Camera,   label: 'Camera',   color: '#6B73FF', action: 'camera' },
    { icon: ImageIcon, label: 'Gallery', color: '#FF6B9D', action: 'gallery' },
    { icon: File,     label: 'File',     color: '#3CC2A8', action: 'file' },
    { icon: MapPin,   label: 'Location', color: '#FF8C42', action: 'location' },
  ];
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 20, opacity: 0 }}
      className="bg-white border-t border-black/[0.06] px-6 py-4 flex-shrink-0"
    >
      <div className="grid grid-cols-4 gap-4">
        {options.map(opt => (
          <button
            key={opt.action}
            onClick={() => { onSelect(opt.action); onClose(); }}
            className="flex flex-col items-center gap-2"
          >
            <div
              className="w-14 h-14 rounded-[18px] flex items-center justify-center"
              style={{ background: `${opt.color}22` }}
            >
              <opt.icon size={24} style={{ color: opt.color }} />
            </div>
            <span className="text-[12px] font-semibold text-gray-600">{opt.label}</span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

// ─── Scroll-to-bottom button ──────────────────────────────────────────────────

function ScrollDownBtn({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      onClick={onClick}
      className="absolute bottom-4 right-4 w-10 h-10 rounded-full bg-white shadow-lg border border-black/[0.08] flex items-center justify-center z-10"
    >
      <ChevronDown size={18} className="text-gray-600" />
    </motion.button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Chat() {
  const [, params]      = useRoute('/messages/:id');
  const { currentUser } = useAuth();
  const convId          = params?.id ?? '';

  const { conversation: hookConv, messages: hookMessages, sendMessage: hookSend } = useMessages(convId);
  // In demo mode, seed local messages from mockMessages; in Firebase mode they come from the hook
  const initMsgs = isFirebaseConfigured ? [] : (mockMessages[convId] ?? []) as LocalMsg[];
  const [messages, setMessages] = useState<LocalMsg[]>(initMsgs);

  // Sync from Firestore listener
  useEffect(() => {
    if (isFirebaseConfigured && hookMessages.length >= 0) {
      setMessages(hookMessages as LocalMsg[]);
    }
  }, [hookMessages]);

  const conversation = isFirebaseConfigured ? hookConv : (
    // Demo fallback: build a minimal conversation object from hookConv or return null
    hookConv
  );
  const [inputText, setInputText]       = useState('');
  const [isOtherTyping, setOtherTyping] = useState(false);
  const [emojiOpen, setEmojiOpen]       = useState(false);
  const [attachOpen, setAttachOpen]     = useState(false);
  const [activePicker, setActivePicker] = useState<string | null>(null);
  const [atBottom, setAtBottom]         = useState(true);

  const scrollRef   = useRef<HTMLDivElement>(null);
  const bottomRef   = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  if (!conversation || !currentUser) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#FDF9F6]">
        <p className="text-gray-400">Conversation not found</p>
        <Link href="/messages" className="mt-3 text-purple-500 font-semibold">← Back to Chats</Link>
      </div>
    );
  }

  const other   = conversation.participants.find(p => p.id !== currentUser.id) ?? conversation.participants[0];
  const title   = conversation.type === 'group' ? (conversation.name ?? 'Group') : other.displayName;
  const isGroup = conversation.type === 'group';

  // ── Scroll helpers ─────────────────────────────────────────────────────────

  function scrollToBottom(behavior: ScrollBehavior = 'smooth') {
    bottomRef.current?.scrollIntoView({ behavior });
  }

  useEffect(() => {
    if (atBottom) scrollToBottom('smooth');
  }, [messages, isOtherTyping]);

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    const fromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAtBottom(fromBottom < 80);
  }

  // ── Textarea auto-resize ────────────────────────────────────────────────────

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInputText(e.target.value);
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
    }
  }

  // ── Send message ───────────────────────────────────────────────────────────

  async function sendMessage(content: string, type: 'text' | 'image' | 'voice' = 'text') {
    if (!content.trim() && type === 'text') return;
    const uid = currentUser!.id;

    setInputText('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
    setEmojiOpen(false);
    setAttachOpen(false);

    if (isFirebaseConfigured) {
      // Optimistic pending bubble; onSnapshot will replace it with the real doc
      const tempId = `pending-${Date.now()}`;
      const msg: LocalMsg = {
        id: tempId, senderId: uid, content, type,
        reactions: {}, readBy: [uid], createdAt: new Date(), pending: true,
      };
      setMessages(prev => [...prev, msg]);
      await hookSend(content, type);
    } else {
      // Demo mode — local state + simulated canned reply
      const msg: LocalMsg = {
        id: `live-${Date.now()}`, senderId: uid, content, type,
        reactions: {}, readBy: [], createdAt: new Date(), pending: true,
      };
      setMessages(prev => [...prev, msg]);
      setTimeout(() => {
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, pending: false } : m));
      }, 400);
      const typingDelay = 900 + Math.random() * 400;
      const replyDelay  = typingDelay + 1200 + Math.random() * 800;
      setTimeout(() => setOtherTyping(true), typingDelay);
      setTimeout(() => {
        setOtherTyping(false);
        setMessages(prev => [...prev, {
          id: `reply-${Date.now()}`, senderId: other.id,
          content: getCannedReply(convId), type: 'text',
          reactions: {}, readBy: [currentUser!.id], createdAt: new Date(),
        }]);
      }, replyDelay);
    }
  }

  function handleSend() {
    sendMessage(inputText);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  // ── Emoji insert ───────────────────────────────────────────────────────────

  function insertEmoji(emoji: string) {
    setInputText(prev => prev + emoji);
    textareaRef.current?.focus();
  }

  // ── Attachment handler ─────────────────────────────────────────────────────

  function handleAttachment(type: string) {
    sendMessage(type, 'image');
  }

  // ── Reactions ──────────────────────────────────────────────────────────────

  const toggleReaction = useCallback((msgId: string, emoji: string) => {
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId) return m;
      const r = { ...m.reactions };
      const users = r[emoji] ?? [];
      if (users.includes(currentUser.id)) {
        r[emoji] = users.filter(u => u !== currentUser.id);
        if (!r[emoji].length) delete r[emoji];
      } else {
        r[emoji] = [...users, currentUser.id];
      }
      return { ...m, reactions: r };
    }));
    setActivePicker(null);
  }, [currentUser.id]);

  // ── Group messages by sender + time ────────────────────────────────────────

  interface MsgGroup { senderId: string; msgs: LocalMsg[] }
  const groups: MsgGroup[] = [];
  for (const msg of messages) {
    const last = groups[groups.length - 1];
    const prevMsg = last?.msgs[last.msgs.length - 1];
    const sameWindow = prevMsg && (msg.createdAt.getTime() - prevMsg.createdAt.getTime() < 5 * 60_000);
    if (last && last.senderId === msg.senderId && sameWindow) {
      last.msgs.push(msg);
    } else {
      groups.push({ senderId: msg.senderId, msgs: [msg] });
    }
  }

  // ── Date separator logic ───────────────────────────────────────────────────

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
              {conversation.participants.filter(p => p.id !== currentUser.id).slice(0, 2).map((p, i) => (
                <div
                  key={p.id}
                  className="absolute border-2 border-white rounded-full"
                  style={i === 0 ? { bottom: 0, left: 0 } : { top: 0, right: 0 }}
                >
                  <UserAvatar userId={p.id} fallbackName={p.displayName} fallbackSrc={(p as any).avatarUrl || undefined} size={28} />
                </div>
              ))}
            </div>
          ) : (
            <UserAvatar userId={other.id} fallbackName={other.displayName} fallbackSrc={(other as any).avatarUrl || undefined} size={40} />
          )}
          <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-400 border-2 border-white" />
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="font-black text-[15px] text-gray-900 truncate leading-tight">{title}</h2>
          <p className="text-[12px] text-green-500 font-semibold leading-tight">
            {isGroup ? `${conversation.participants.length} members · Active now` : 'Active now'}
          </p>
        </div>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
            <Phone size={18} />
          </button>
          <button className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
            <Video size={20} />
          </button>
          <button className="w-9 h-9 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
            <MoreHorizontal size={20} />
          </button>
        </div>
      </header>

      {/* ── Messages area ───────────────────────────────────────────── */}
      {/* Backdrop: close picker when tapping outside bubble */}
      {activePicker && (
        <div className="fixed inset-0 z-10" onClick={() => setActivePicker(null)} />
      )}

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto relative"
        style={{ overscrollBehavior: 'contain' }}
      >
        <div className="py-4 space-y-1">
          {slots.map((slot, si) => {
            if (slot.type === 'sep') {
              return <DateSeparator key={`sep-${si}`} date={slot.date} />;
            }

            const { group } = slot;
            const isMe = group.senderId === currentUser.id;
            const sender = conversation.participants.find(p => p.id === group.senderId);
            const senderName = sender?.displayName ?? 'Unknown';

            return (
              <div key={`grp-${si}`} className={cn('flex gap-2.5 px-4 my-3', isMe ? 'justify-end' : 'justify-start')}>
                {/* Avatar for others (shown once per group, at top) */}
                {!isMe && (
                  <div className="flex-shrink-0 self-end mb-6">
                    <UserAvatar userId={group.senderId} fallbackName={senderName} fallbackSrc={sender ? (sender as any).avatarUrl || undefined : undefined} size={30} />
                  </div>
                )}

                <div className={cn('flex flex-col gap-1 max-w-[72%]', isMe ? 'items-end' : 'items-start')}>
                  {/* Sender name for group chats */}
                  {isGroup && !isMe && (
                    <span className="text-[11.5px] font-semibold text-gray-400 ml-1 mb-0.5">{senderName}</span>
                  )}

                  {/* Bubbles */}
                  {group.msgs.map((msg, mi) => (
                    <div key={msg.id} className={cn('flex flex-col', isMe ? 'items-end' : 'items-start')}>
                      <MessageBubble
                        msg={msg}
                        isMe={isMe}
                        isFirst={mi === 0}
                        isLast={mi === group.msgs.length - 1}
                        isGroup={isGroup}
                        participants={conversation.participants}
                        currentUserId={currentUser.id}
                        showPicker={activePicker === msg.id}
                        onActivate={() => setActivePicker(p => p === msg.id ? null : msg.id)}
                        onReact={(emoji) => toggleReaction(msg.id, emoji)}
                      />
                      <ReactionDisplay
                        reactions={msg.reactions}
                        currentUserId={currentUser.id}
                        onReact={(emoji) => toggleReaction(msg.id, emoji)}
                        isMe={isMe}
                      />
                    </div>
                  ))}

                  {/* Group timestamp */}
                  <span className="text-[10.5px] text-gray-400 mt-0.5 mx-1">
                    {format(group.msgs[group.msgs.length - 1].createdAt, 'h:mm a')}
                  </span>
                </div>
              </div>
            );
          })}

          {/* Typing indicator */}
          <AnimatePresence>
            {isOtherTyping && <TypingIndicator key="typing" user={other} />}
          </AnimatePresence>

          {/* Bottom anchor */}
          <div ref={bottomRef} className="h-1" />
        </div>

        {/* Scroll-to-bottom button */}
        <AnimatePresence>
          {!atBottom && (
            <div className="sticky bottom-4 flex justify-end pr-4">
              <ScrollDownBtn onClick={() => scrollToBottom()} />
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Emoji panel ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {emojiOpen && (
          <EmojiPanel key="emoji" onSelect={insertEmoji} onClose={() => setEmojiOpen(false)} />
        )}
      </AnimatePresence>

      {/* ── Attachment sheet ─────────────────────────────────────────── */}
      <AnimatePresence>
        {attachOpen && (
          <AttachmentSheet key="attach" onSelect={handleAttachment} onClose={() => setAttachOpen(false)} />
        )}
      </AnimatePresence>

      {/* ── Input bar ───────────────────────────────────────────────── */}
      <div className="sticky bottom-0 z-20 bg-white/95 backdrop-blur-xl border-t border-black/[0.05] px-3 py-3 flex-shrink-0">
        <div className="flex items-end gap-2">
          {/* Attach */}
          <motion.button
            whileTap={{ scale: 0.88 }}
            onClick={() => { setAttachOpen(v => !v); setEmojiOpen(false); }}
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all mb-0.5',
              attachOpen
                ? 'text-white shadow-md'
                : 'text-gray-400 hover:text-purple-500 hover:bg-purple-50'
            )}
            style={attachOpen ? { background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)' } : {}}
          >
            <ImageIcon size={21} />
          </motion.button>

          {/* Text input */}
          <div className="flex-1 flex items-end bg-gray-100 rounded-[22px] px-4 py-2.5 gap-2 focus-within:bg-white focus-within:ring-2 focus-within:ring-purple-200 transition-all border border-transparent focus-within:border-purple-200">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="Message…"
              rows={1}
              className="flex-1 bg-transparent outline-none resize-none text-[15px] text-gray-900 placeholder:text-gray-400 leading-[1.4] max-h-[120px] overflow-y-auto"
              style={{ lineHeight: '1.4' }}
            />
            <motion.button
              whileTap={{ scale: 0.88 }}
              onClick={() => { setEmojiOpen(v => !v); setAttachOpen(false); }}
              className={cn(
                'flex-shrink-0 text-gray-400 hover:text-purple-500 transition-colors self-end mb-0.5',
                emojiOpen && 'text-purple-500'
              )}
            >
              <Smile size={20} />
            </motion.button>
          </div>

          {/* Send or Mic */}
          <AnimatePresence mode="wait">
            {inputText.trim() ? (
              <motion.button
                key="send"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                whileTap={{ scale: 0.88 }}
                onClick={handleSend}
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-md mb-0.5 text-white"
                style={{ background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)', boxShadow: '0 3px 12px rgba(107,115,255,0.40)' }}
              >
                <Send size={17} className="ml-0.5 -mt-0.5" />
              </motion.button>
            ) : (
              <motion.button
                key="mic"
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.5, opacity: 0 }}
                whileTap={{ scale: 0.88 }}
                onClick={() => sendMessage('🎤 Voice message', 'voice')}
                className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-gray-100 text-gray-500 hover:bg-purple-50 hover:text-purple-500 transition-all mb-0.5"
              >
                <Mic size={19} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}
