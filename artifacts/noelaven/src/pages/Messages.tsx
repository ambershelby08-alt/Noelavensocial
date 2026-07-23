import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, PenSquare, X, Check, ChevronRight, MessageCircle,
} from 'lucide-react';
import { mockUsers } from '@/lib/mockData';
import type { Conversation, User } from '@/lib/mockData';
import { useConversations } from '@/hooks/useConversations';
import { GradientAvatar, getGradientPair } from '@/components/ui/GradientAvatar';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday } from 'date-fns';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(d: Date): string {
  if (isToday(d))     return format(d, 'h:mm a');
  if (isYesterday(d)) return 'Yesterday';
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days < 7) return format(d, 'EEE');
  return format(d, 'MMM d');
}

// Simulated online status
const ONLINE_IDS = new Set(['user-1', 'user-5']);
const AWAY_IDS   = new Set(['user-2']);

function onlineStatus(id: string) {
  if (ONLINE_IDS.has(id)) return 'online';
  if (AWAY_IDS.has(id))   return 'away';
  return 'offline';
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

// ─── Active users row ─────────────────────────────────────────────────────────

const ACTIVE_USERS = mockUsers.filter(u => ONLINE_IDS.has(u.id) || AWAY_IDS.has(u.id));

function ActiveUsersRow() {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-1.5 mb-3 px-4">
        <div className="w-2 h-2 rounded-full bg-green-400" />
        <span className="text-[12.5px] font-bold text-gray-500 uppercase tracking-wider">Active Now</span>
      </div>
      <div className="flex gap-4 overflow-x-auto px-4 pb-1 scrollbar-none">
        {ACTIVE_USERS.map((user) => {
          const status = onlineStatus(user.id);
          return (
            <Link key={user.id} href={`/profile/${user.id}`}>
              <motion.div
                whileTap={{ scale: 0.93 }}
                className="flex flex-col items-center gap-1.5 cursor-pointer flex-shrink-0"
              >
                <div className="relative">
                  <UserAvatar userId={user.id} fallbackName={user.displayName} fallbackSrc={user.avatarUrl || undefined} size={52} />
                  <div
                    className={cn(
                      'absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full border-2 border-white',
                      status === 'online' ? 'bg-green-400' : 'bg-yellow-400'
                    )}
                  />
                </div>
                <span className="text-[11.5px] text-gray-600 font-medium truncate max-w-[52px] text-center">
                  {user.displayName.split(' ')[0]}
                </span>
              </motion.div>
            </Link>
          );
        })}
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

// ─── Conversation item ────────────────────────────────────────────────────────

function ConvItem({ conv }: { conv: Conversation }) {
  const { currentUser } = useAuth();
  const other = conv.participants.find(p => p.id !== currentUser?.id) ?? conv.participants[0];
  const name  = conv.type === 'group' ? (conv.name ?? 'Group') : other.displayName;
  const isOnline = conv.type === 'direct' && onlineStatus(other.id) === 'online';
  const unread = conv.unreadCount > 0;

  return (
    <Link href={`/messages/${conv.id}`}>
      <motion.div
        whileTap={{ scale: 0.98 }}
        className="flex items-center gap-3.5 px-4 py-3.5 bg-white rounded-[22px] border border-black/[0.04] shadow-sm hover:shadow-md transition-all cursor-pointer"
      >
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          {conv.type === 'group' ? (
            <GroupAvatar participants={conv.participants} />
          ) : (
            <>
              <UserAvatar userId={other.id} fallbackName={other.displayName} fallbackSrc={(other as any).avatarUrl || undefined} size={52} />
              {isOnline && (
                <div className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-green-400 border-2 border-white" />
              )}
            </>
          )}
          {/* Unread badge */}
          {unread && (
            <div
              className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full border-2 border-white flex items-center justify-center text-[9px] font-black text-white px-1"
              style={{ background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)' }}
            >
              {conv.unreadCount}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline justify-between gap-2 mb-0.5">
            <span className={cn('text-[15px] truncate', unread ? 'font-black text-gray-900' : 'font-semibold text-gray-800')}>
              {name}
            </span>
            <span className={cn('text-[11.5px] flex-shrink-0', unread ? 'text-purple-500 font-bold' : 'text-gray-400')}>
              {fmtTime(conv.lastMessageAt)}
            </span>
          </div>
          <p className={cn('text-[13.5px] truncate', unread ? 'font-semibold text-gray-700' : 'text-gray-400')}>
            {conv.lastMessage}
          </p>
        </div>

        {/* Unread dot */}
        {unread && (
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)' }} />
        )}
      </motion.div>
    </Link>
  );
}

// ─── Compose drawer ───────────────────────────────────────────────────────────

function ComposeDrawer({ onClose, openDirect, composeUsers }: {
  onClose: () => void;
  openDirect: (userId: string) => Promise<string | null>;
  composeUsers: User[];
}) {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState('');
  const users = composeUsers;
  const filtered = search
    ? users.filter(u => u.displayName.toLowerCase().includes(search.toLowerCase()) || u.handle.toLowerCase().includes(search.toLowerCase()))
    : users;

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
        className="fixed inset-x-0 bottom-0 z-50 bg-[#FDF9F6] rounded-t-[28px] shadow-2xl flex flex-col"
        style={{ maxHeight: '75vh' }}
      >
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-black/[0.06] flex-shrink-0">
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full transition-colors">
            <X size={18} className="text-gray-500" />
          </button>
          <span className="font-black text-[16px] text-gray-900">New Message</span>
          <div className="w-8" />
        </div>
        <div className="px-5 pt-3 pb-2 flex-shrink-0">
          <div className="relative">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search people…"
              autoFocus
              className="w-full bg-white border border-black/[0.08] rounded-xl pl-9 pr-4 py-2.5 text-[14px] placeholder:text-gray-400 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all"
            />
          </div>
        </div>
        <div className="overflow-y-auto flex-1 px-5 pb-6">
          {filtered.map((user, i) => (
            <motion.button
              key={user.id}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              onClick={() => handleSelect(user)}
              className="w-full flex items-center gap-3 py-3 hover:bg-white rounded-xl px-2 transition-colors"
            >
              <div className="relative">
                <UserAvatar userId={user.id} fallbackName={user.displayName} fallbackSrc={user.avatarUrl || undefined} size={46} />
                {onlineStatus(user.id) === 'online' && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-400 border-2 border-white" />
                )}
              </div>
              <div className="flex-1 text-left">
                <p className="font-bold text-[14.5px] text-gray-900">{user.displayName}</p>
                <p className="text-[12.5px] text-gray-400">@{user.handle}</p>
              </div>
              <ChevronRight size={16} className="text-gray-300" />
            </motion.button>
          ))}
        </div>
      </motion.div>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Messages() {
  const [search, setSearch]         = useState('');
  const [composeOpen, setCompose]   = useState(false);
  const { conversations, openDirectConversation, getComposeUsers } = useConversations();

  const { currentUser: _cu } = useAuth();
  const filtered = search
    ? conversations.filter(c => {
        const other = c.participants.find(p => p.id !== (_cu?.id ?? 'demo-user'));
        const name = c.type === 'group' ? c.name ?? '' : other?.displayName ?? '';
        return name.toLowerCase().includes(search.toLowerCase()) || c.lastMessage.toLowerCase().includes(search.toLowerCase());
      })
    : conversations;

  const totalUnread = conversations.reduce((n, c) => n + c.unreadCount, 0);

  return (
    <div className="min-h-screen bg-[#FDF9F6] pb-36">

      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-[#FDF9F6]/95 backdrop-blur-md border-b border-black/[0.05] px-4 pt-5 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[26px] font-black text-gray-900 tracking-tight flex items-center gap-2">
              Chats
              {totalUnread > 0 && (
                <span
                  className="text-[11px] font-black text-white px-2 py-0.5 rounded-full"
                  style={{ background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)' }}
                >
                  {totalUnread}
                </span>
              )}
            </h1>
            <p className="text-[13px] text-gray-400 font-medium">Your conversations</p>
          </div>
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => setCompose(true)}
            className="w-11 h-11 rounded-full flex items-center justify-center shadow-md text-white"
            style={{ background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)', boxShadow: '0 3px 12px rgba(107,115,255,0.35)' }}
          >
            <PenSquare size={18} />
          </motion.button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search conversations…"
            className="w-full bg-white border border-black/[0.06] rounded-2xl pl-10 pr-10 py-3 text-[14px] text-gray-800 placeholder:text-gray-400 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all shadow-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X size={15} className="text-gray-400" />
            </button>
          )}
        </div>
      </div>

      <div className="pt-5">
        {/* Active Now */}
        {!search && <ActiveUsersRow />}

        {/* Conversations */}
        <div className="px-4 space-y-2">
          {search && (
            <p className="text-[13px] text-gray-400 font-medium mb-3">
              {filtered.length} result{filtered.length !== 1 ? 's' : ''} for "<span className="text-gray-700">{search}</span>"
            </p>
          )}

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center py-24 text-center">
              <div className="w-16 h-16 rounded-[22px] flex items-center justify-center mb-4"
                style={{ background: 'linear-gradient(135deg, #6B73FF22, #FF6B9D22)' }}>
                <MessageCircle size={28} className="text-purple-400" />
              </div>
              <h3 className="font-black text-[17px] text-gray-800 mb-1.5">No conversations</h3>
              <p className="text-[14px] text-gray-400 max-w-[200px] leading-relaxed">
                {search ? 'Try a different search.' : 'Start a conversation with someone!'}
              </p>
              {!search && (
                <button
                  onClick={() => setCompose(true)}
                  className="mt-6 px-6 py-3 rounded-full text-[14px] font-black text-white"
                  style={{ background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)' }}
                >
                  + New Message
                </button>
              )}
            </div>
          ) : (
            filtered.map((conv, i) => (
              <motion.div
                key={conv.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <ConvItem conv={conv} />
              </motion.div>
            ))
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
          />
        )}
      </AnimatePresence>
    </div>
  );
}
