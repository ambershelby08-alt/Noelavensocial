import React, { useState, useRef, useMemo } from 'react';
import { Link, useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, PenSquare, X, MessageCircle,
  Pin, Archive, BellOff, Bell, Trash2, ChevronDown, ChevronUp,
  Filter, Phone, SlidersHorizontal,
} from 'lucide-react';
import type { Conversation, User } from '@/lib/mockData';
import { useConversations } from '@/hooks/useConversations';
import { useActiveNow, type OnlineUser } from '@/hooks/useActiveNow';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday } from 'date-fns';
import { normalizeDate } from '@/lib/timestamp';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(raw: unknown): string {
  // Use normalizeDate so Firestore Timestamps, plain Dates, and epoch numbers
  // all resolve safely — avoids .getTime() on an unresolved server timestamp.
  const d = normalizeDate(raw) ?? new Date(0);
  if (isToday(d))     return format(d, 'h:mm a');
  if (isYesterday(d)) return 'Yesterday';
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days < 7) return format(d, 'EEE');
  return format(d, 'MMM d');
}

function lastMsgLabel(conv: Conversation): string {
  switch (conv.lastMessageType) {
    case 'image':      return '📷 Photo';
    case 'video':      return '🎥 Video';
    case 'voice':      return '🎤 Voice message';
    case 'post_share': return '📌 Shared a post';
    default:           return conv.lastMessage;
  }
}

// ─── Backdrop ─────────────────────────────────────────────────────────────────

function Backdrop({ onClose }: { onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
      onClick={onClose}
    />
  );
}

// ─── Active Now row — real Firestore presence data ────────────────────────────
//
// IMPORTANT: this component never receives mock or demo users.
// Story-style contact row: "My Note" first, then active contacts with rainbow rings.
function ActiveUsersRow({ users, currentUser: me }: { users: OnlineUser[]; currentUser: import('@/lib/mockData').User | null }) {
  const { currentUser } = useAuth();

  return (
    <div className="mb-4">
      <div className="flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-none">
        {/* My Note / own avatar */}
        <Link href="/profile">
          <motion.div whileTap={{ scale: 0.93 }} className="flex flex-col items-center gap-1.5 cursor-pointer flex-shrink-0">
            <div className="relative">
              {/* Rainbow ring */}
              <div className="p-[2.5px] rounded-full" style={{ background: 'linear-gradient(135deg, #EC4899, #7C3AED, #2563EB)' }}>
                <div className="p-[2px] rounded-full bg-black">
                  <UserAvatar
                    userId={currentUser?.id ?? ''}
                    fallbackName={currentUser?.displayName ?? 'Me'}
                    fallbackSrc={currentUser?.avatarUrl || undefined}
                    size={52}
                  />
                </div>
              </div>
              {/* + badge */}
              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2 border-black text-white text-[11px] font-black"
                style={{ background: '#EC4899' }}>+</div>
            </div>
            <span className="text-[11px] text-[#BDBDBD] font-medium truncate max-w-[56px] text-center">My Note</span>
          </motion.div>
        </Link>

        {/* Active contacts */}
        {users.map(user => (
          <Link key={user.id} href={`/profile/${user.id}`}>
            <motion.div whileTap={{ scale: 0.93 }} className="flex flex-col items-center gap-1.5 cursor-pointer flex-shrink-0">
              <div className="relative">
                <div className="p-[2.5px] rounded-full" style={{ background: 'linear-gradient(135deg, #EC4899, #7C3AED, #2563EB)' }}>
                  <div className="p-[2px] rounded-full bg-black">
                    <UserAvatar
                      userId={user.id}
                      fallbackName={user.displayName}
                      fallbackSrc={user.avatarUrl || undefined}
                      size={52}
                    />
                  </div>
                </div>
                {/* Green online dot */}
                <div className="absolute bottom-1 right-1 w-3 h-3 rounded-full bg-green-400 border-2 border-black" />
              </div>
              <span className="text-[11px] text-[#BDBDBD] font-medium truncate max-w-[56px] text-center">
                {user.displayName.split(' ')[0]}
              </span>
            </motion.div>
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Group avatar ─────────────────────────────────────────────────────────────

function GroupAvatar({ participants }: { participants: User[] }) {
  const others = participants.filter(p => p.id !== 'demo-user').slice(0, 2);
  return (
    <div className="relative w-[52px] h-[52px] flex-shrink-0">
      {others.map((u, i) => (
        <div
          key={u.id}
          className="absolute border-[2.5px] border-white rounded-full"
          style={i === 0 ? { bottom: 0, left: 0 } : { top: 0, right: 0 }}
        >
          <UserAvatar userId={u.id} fallbackName={u.displayName} fallbackSrc={u.avatarUrl || undefined} size={34} />
        </div>
      ))}
    </div>
  );
}

// ─── Conv action sheet ────────────────────────────────────────────────────────

interface ConvAction {
  id: 'pin' | 'archive' | 'mute' | 'delete';
  label: string;
  icon: React.ReactNode;
  danger?: boolean;
}

function ConvActionSheet({
  conv,
  currentUserId,
  onPin,
  onArchive,
  onMute,
  onClose,
}: {
  conv: Conversation;
  currentUserId: string;
  onPin: () => void;
  onArchive: () => void;
  onMute: () => void;
  onClose: () => void;
}) {
  const isPinned   = conv.pinnedBy?.includes(currentUserId);
  const isArchived = conv.archivedBy?.includes(currentUserId);
  const isMuted    = conv.mutedBy?.includes(currentUserId);

  const actions: ConvAction[] = [
    { id: 'pin',     label: isPinned   ? 'Unpin'   : 'Pin to top',         icon: <Pin size={18} /> },
    { id: 'archive', label: isArchived ? 'Unarchive' : 'Archive',          icon: <Archive size={18} /> },
    { id: 'mute',    label: isMuted    ? 'Unmute'  : 'Mute notifications', icon: isMuted ? <Bell size={18} /> : <BellOff size={18} /> },
    { id: 'delete',  label: 'Delete conversation', icon: <Trash2 size={18} />, danger: true },
  ];

  function handle(id: ConvAction['id']) {
    if (id === 'pin')     onPin();
    if (id === 'archive') onArchive();
    if (id === 'mute')    onMute();
    onClose();
  }

  return (
    <>
      <Backdrop onClose={onClose} />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-50 bg-black rounded-t-[28px] shadow-2xl pb-8"
      >
        <div className="flex justify-center pt-3 pb-4">
          <div className="w-10 h-1 rounded-full bg-[#333]" />
        </div>
        <div className="px-5 space-y-1">
          {actions.map(a => (
            <button
              key={a.id}
              onClick={() => handle(a.id)}
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

// ─── Conversation item ────────────────────────────────────────────────────────

function ConvItem({
  conv,
  onLongPress,
  onlineIds,
}: {
  conv:       Conversation;
  onLongPress: () => void;
  /** Set of UIDs currently online — derived from useActiveNow. */
  onlineIds:  Set<string>;
}) {
  const { currentUser } = useAuth();
  const other    = conv.participants.find(p => p.id !== currentUser?.id) ?? conv.participants[0];
  const name     = conv.type === 'group' ? (conv.name ?? 'Group') : other.displayName;
  // Real presence: only green when this participant is actually online in Firestore.
  const isOnline = conv.type === 'direct' && onlineIds.has(other.id);
  const unread   = conv.unreadCount > 0;
  const uid      = currentUser?.id ?? '';
  const isPinned = conv.pinnedBy?.includes(uid);
  const isMuted  = conv.mutedBy?.includes(uid);

  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function startPress() {
    longPressTimer.current = setTimeout(() => { onLongPress(); }, 500);
  }
  function endPress() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }

  return (
    <Link href={`/messages/${conv.id}`}>
      <motion.div
        whileTap={{ scale: 0.98 }}
        onTouchStart={startPress}
        onTouchEnd={endPress}
        onMouseDown={startPress}
        onMouseUp={endPress}
        onMouseLeave={endPress}
        className="flex items-center gap-3.5 px-4 py-3 border-b border-[#111] transition-all cursor-pointer"
      >
        {/* Avatar with rainbow ring */}
        <div className="relative flex-shrink-0">
          {conv.type === 'group' ? (
            <GroupAvatar participants={conv.participants} />
          ) : (
            <>
              <Link
                href={`/profile/${other.id}`}
                onClick={e => e.stopPropagation()}
                className="block"
                aria-label={`View ${other.displayName}'s profile`}
              >
                <div className="p-[2.5px] rounded-full" style={{ background: 'linear-gradient(135deg, #EC4899, #7C3AED, #2563EB)' }}>
                  <div className="p-[2px] rounded-full bg-black">
                    <UserAvatar userId={other.id} fallbackName={other.displayName} fallbackSrc={other.avatarUrl || undefined} size={50} />
                  </div>
                </div>
              </Link>
              {isOnline && (
                <div className="absolute bottom-1 right-1 w-3.5 h-3.5 rounded-full bg-green-400 border-2 border-black" />
              )}
            </>
          )}
          {unread && (
            <div
              className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-black text-white px-1"
              style={{ background: '#EC4899' }}
            >
              {conv.unreadCount}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2 mb-0.5">
            <div className="flex items-center gap-1.5 min-w-0">
              {isPinned && <Pin size={11} className="text-[#F5C542] flex-shrink-0" />}
              <span className={cn('text-[15px] truncate', unread ? 'font-black text-white' : 'font-semibold text-white')}>
                {name}
              </span>
              {isMuted && <BellOff size={11} className="text-[rgba(255,255,255,0.35)] flex-shrink-0" />}
            </div>
            <span className={cn('text-[11.5px] flex-shrink-0', unread ? 'text-white font-bold' : 'text-[rgba(255,255,255,0.45)]')}>
              {fmtTime(conv.lastMessageAt)}
            </span>
          </div>
          <p className={cn('text-[13.5px] truncate', unread ? 'font-semibold text-[#BDBDBD]' : 'text-[rgba(255,255,255,0.45)]')}>
            {lastMsgLabel(conv)}
          </p>
        </div>

        {/* Unread dot */}
        {unread && !isMuted && (
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: '#EC4899' }} />
        )}
      </motion.div>
    </Link>
  );
}

// ─── Compose drawer ───────────────────────────────────────────────────────────

function ComposeDrawer({
  onClose,
  openDirect,
  composeUsers,
  onlineIds,
}: {
  onClose:      () => void;
  openDirect:   (userId: string) => Promise<string | null>;
  composeUsers: User[];
  /** Set of UIDs currently online — derived from useActiveNow. */
  onlineIds:    Set<string>;
}) {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState('');
  const filtered = search
    ? composeUsers.filter(u =>
        u.displayName.toLowerCase().includes(search.toLowerCase()) ||
        u.handle.toLowerCase().includes(search.toLowerCase())
      )
    : composeUsers;

  async function handleSelect(user: User) {
    const convId = await openDirect(user.id);
    if (convId) setLocation(`/messages/${convId}`);
    onClose();
  }

  return (
    <>
      <Backdrop onClose={onClose} />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-[75] bg-black rounded-t-[28px] shadow-2xl flex flex-col"
        style={{ maxHeight: '80vh' }}
      >
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-[#333]" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#1a1a1a] flex-shrink-0">
          <button onClick={onClose} className="p-1.5 hover:bg-[#1a1a1a] rounded-full transition-colors">
            <X size={18} className="text-[#BDBDBD]" />
          </button>
          <span className="font-black text-[16px] text-white">New Message</span>
          <div className="w-8" />
        </div>
        <div className="px-5 pt-3 pb-2 flex-shrink-0">
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[rgba(255,255,255,0.45)]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search people…"
              autoFocus
              className="w-full bg-[#111] border border-[#2a2a2a] rounded-xl pl-9 pr-4 py-2.5 text-[14px] placeholder:text-[#555] outline-none focus:border-[#7C3AED] focus:ring-2 focus:ring-[rgba(124,58,237,0.2)] transition-all"
            />
          </div>
        </div>
        <div
          className="overflow-y-auto flex-1 px-5"
          style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 24px)' }}
        >
          {filtered.length === 0 && (
            <p className="text-center text-[14px] text-[rgba(255,255,255,0.45)] py-8">No people found</p>
          )}
          {filtered.map((user, i) => (
            <motion.button
              key={user.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              onClick={() => handleSelect(user)}
              className="w-full flex items-center gap-3 py-3 hover:bg-[#111] rounded-xl px-2 transition-colors"
            >
              <div className="relative">
                <UserAvatar userId={user.id} fallbackName={user.displayName} fallbackSrc={user.avatarUrl || undefined} size={46} />
                {/* Green dot reflects real presence — not mock data */}
                {onlineIds.has(user.id) && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-400 border-2 border-white" />
                )}
              </div>
              <div className="flex-1 text-left">
                <p className="font-bold text-[14.5px] text-white">{user.displayName}</p>
                <p className="text-[12.5px] text-[rgba(255,255,255,0.45)]">@{user.handle}</p>
              </div>
              <span
                className="flex-shrink-0 px-3 py-1.5 rounded-full text-[12px] font-bold text-white"
                style={{ background: 'linear-gradient(135deg, #EC4899, #7C3AED, #2563EB)' }}
              >
                Start Chat
              </span>
            </motion.button>
          ))}
        </div>
      </motion.div>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Messages() {
  const [, setLocation] = useLocation();
  const [search, setSearch]         = useState('');
  const [composeOpen, setCompose]   = useState(false);
  const [actionConv, setActionConv] = useState<Conversation | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [msgTab, setMsgTab]         = useState<'primary' | 'requests' | 'groups' | 'calls'>('primary');

  const {
    conversations, openDirectConversation, getComposeUsers,
    pinConversation, archiveConversation, muteConversation,
  } = useConversations();

  const { currentUser } = useAuth();
  const uid = currentUser?.id ?? '';

  // ── Real presence: subscribe to online contacts (following + conv partners) ──
  const activeNow = useActiveNow(currentUser?.id);
  const onlineIds = useMemo(() => new Set(activeNow.map(u => u.id)), [activeNow]);

  // Separate pinned / active / archived
  const allFiltered = search
    ? conversations.filter(c => {
        const other = c.participants.find(p => p.id !== uid);
        const name  = c.type === 'group' ? c.name ?? '' : other?.displayName ?? '';
        return (
          name.toLowerCase().includes(search.toLowerCase()) ||
          c.lastMessage.toLowerCase().includes(search.toLowerCase())
        );
      })
    : conversations;

  const archived  = allFiltered.filter(c => c.archivedBy?.includes(uid));
  const active    = allFiltered.filter(c => !c.archivedBy?.includes(uid));
  // Tab-filtered active list
  const tabFiltered = active.filter(c =>
    msgTab === 'groups' ? c.type === 'group' :
    msgTab === 'requests' ? false :           // future: message requests
    c.type !== 'group'                         // primary: DMs only
  );
  const pinned    = tabFiltered.filter(c => c.pinnedBy?.includes(uid));
  const unpinned  = tabFiltered.filter(c => !c.pinnedBy?.includes(uid));
  const sorted    = [...pinned, ...unpinned];

  const totalUnread = conversations
    .filter(c => !c.archivedBy?.includes(uid))
    .reduce((n, c) => n + c.unreadCount, 0);

  return (
    <div className="min-h-screen bg-black pb-36">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-black border-b border-[#1a1a1a] px-4 pt-4 pb-3">
        {/* Top row: compose | logo+name | filter+... */}
        <div className="flex items-center justify-between mb-3">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setCompose(true)}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: '#111', border: '1px solid #2a2a2a' }}
          >
            <PenSquare size={16} className="text-white" />
          </motion.button>

          {/* Center: logo + wordmark */}
          <div className="flex items-center gap-2">
            <img src="/noelaven-logo.png" alt="Noelaven" className="w-7 h-7 object-contain" />
            <span className="text-[17px] font-black text-white tracking-tight">Messages</span>
            {totalUnread > 0 && (
              <span className="text-[10px] font-black text-white px-1.5 py-0.5 rounded-full leading-none"
                style={{ background: '#EC4899' }}>
                {totalUnread}
              </span>
            )}
          </div>

          {/* Right: filter + more */}
          <div className="flex items-center gap-1.5">
            <motion.button whileTap={{ scale: 0.9 }}
              onClick={() => setLocation('/settings')}
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: '#111', border: '1px solid #2a2a2a' }}>
              <SlidersHorizontal size={15} className="text-white" />
            </motion.button>
          </div>
        </div>

        {/* Search bar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[rgba(255,255,255,0.4)]" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full bg-[#111] border border-[#1a1a1a] rounded-full pl-9 pr-4 py-2.5 text-[14px] text-white placeholder:text-[#555] outline-none focus:border-[#EC4899]/50 transition-all"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X size={13} className="text-[rgba(255,255,255,0.45)]" />
              </button>
            )}
          </div>
          {/* Pink + compose button */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => setCompose(true)}
            className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white font-black text-[18px]"
            style={{ background: '#EC4899' }}
          >
            +
          </motion.button>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────── */}
      {!search && (
        <div className="flex overflow-x-auto scrollbar-none border-b border-[#1a1a1a]">
          {([
            { key: 'primary', label: 'Primary' },
            { key: 'requests', label: 'Requests' },
            { key: 'groups', label: 'Groups' },
            { key: 'calls', label: 'Calls' },
          ] as const).map(({ key, label }) => {
            const active = msgTab === key;
            const badge = key === 'primary' && totalUnread > 0 ? totalUnread : 0;
            return (
              <button
                key={key}
                onClick={() => setMsgTab(key)}
                className="relative flex items-center gap-1.5 px-5 py-3 text-[14px] font-semibold whitespace-nowrap flex-shrink-0 transition-colors"
                style={{ color: active ? '#EC4899' : 'rgba(255,255,255,0.45)' }}
              >
                {label}
                {badge > 0 && (
                  <span className="text-[10px] font-black text-white px-1.5 py-0.5 rounded-full leading-none"
                    style={{ background: '#EC4899' }}>{badge}</span>
                )}
                {active && (
                  <div className="absolute bottom-0 left-3 right-3 h-[2.5px] rounded-full" style={{ background: '#EC4899' }} />
                )}
              </button>
            );
          })}
        </div>
      )}

      <div className="pt-4">
        {/* Story-style contact row */}
        {!search && msgTab === 'primary' && <ActiveUsersRow users={activeNow} currentUser={currentUser} />}

        {/* Conversations */}
        <div className="px-4 space-y-2">
          {search && (
            <p className="text-[13px] text-[rgba(255,255,255,0.45)] font-medium mb-3">
              {sorted.length} result{sorted.length !== 1 ? 's' : ''} for "<span className="text-[#BDBDBD]">{search}</span>"
            </p>
          )}

          {sorted.length === 0 && archived.length === 0 ? (
            <div className="flex flex-col items-center py-24 text-center">
              <div className="w-16 h-16 rounded-[22px] flex items-center justify-center mb-4"
                style={{ background: 'linear-gradient(135deg, #6B73FF22, #FF6B9D22)' }}>
                <MessageCircle size={28} className="text-[#EC4899]" />
              </div>
              <h3 className="font-black text-[17px] text-white mb-1.5">No conversations</h3>
              <p className="text-[14px] text-[rgba(255,255,255,0.45)] max-w-[200px] leading-relaxed">
                {search ? 'Try a different search.' : 'Start a conversation with someone!'}
              </p>
              {!search && (
                <button
                  onClick={() => setCompose(true)}
                  className="mt-6 px-6 py-3 rounded-full text-[14px] font-black text-white"
                  style={{ background: 'linear-gradient(135deg, #EC4899, #7C3AED, #2563EB)' }}
                >
                  + New Message
                </button>
              )}
            </div>
          ) : (
            sorted.map((conv, i) => (
              <motion.div
                key={conv.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <ConvItem
                  conv={conv}
                  onlineIds={onlineIds}
                  onLongPress={() => setActionConv(conv)}
                />
              </motion.div>
            ))
          )}

          {/* Archived section */}
          {archived.length > 0 && !search && (
            <div className="mt-4">
              <button
                onClick={() => setShowArchived(v => !v)}
                className="w-full flex items-center justify-between px-2 py-3 text-[#BDBDBD] hover:text-[#BDBDBD] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <Archive size={16} />
                  <span className="text-[13.5px] font-semibold">Archived ({archived.length})</span>
                </div>
                {showArchived ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              <AnimatePresence>
                {showArchived && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="space-y-2 overflow-hidden"
                  >
                    {archived.map(conv => (
                      <ConvItem
                        key={conv.id}
                        conv={conv}
                        onlineIds={onlineIds}
                        onLongPress={() => setActionConv(conv)}
                      />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      {/* ── Overlays ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {composeOpen && (
          <ComposeDrawer
            key="compose"
            onClose={() => setCompose(false)}
            openDirect={openDirectConversation}
            composeUsers={getComposeUsers()}
            onlineIds={onlineIds}
          />
        )}
        {actionConv && (
          <ConvActionSheet
            key="conv-action"
            conv={actionConv}
            currentUserId={uid}
            onPin={() => pinConversation(actionConv.id, !actionConv.pinnedBy?.includes(uid))}
            onArchive={() => archiveConversation(actionConv.id, !actionConv.archivedBy?.includes(uid))}
            onMute={() => muteConversation(actionConv.id, !actionConv.mutedBy?.includes(uid))}
            onClose={() => setActionConv(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
