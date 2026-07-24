import React, { useState, useEffect } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import { MessageCircle, UserPlus, Users, Sparkles, CheckCheck, Reply } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link, useLocation } from 'wouter';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { UserAvatar } from '@/components/ui/UserAvatar';

const FILTERS = ['All', 'Reactions', 'Comments', 'Follows'] as const;
type Filter = typeof FILTERS[number];

/** Extract the reaction emoji from a notification message like "Ashley 🌊 Vibed your post" */
function extractReactionEmoji(message: string): string {
  // Second word is the emoji
  const parts = message.trim().split(/\s+/);
  return parts[1] ?? '🌊';
}

function getIcon(type: string, message = '') {
  switch (type) {
    case 'reaction':
    case 'like':
      return <span className="text-[13px] leading-none">{extractReactionEmoji(message)}</span>;
    case 'like_comment':
      return <span className="text-[13px] leading-none">🌊</span>;
    case 'comment':          return <MessageCircle size={15} className="text-purple-500 fill-purple-100" />;
    case 'reply':            return <Reply size={15} className="text-purple-400" />;
    case 'follow':           return <UserPlus size={15} className="text-blue-500" />;
    case 'community_invite': return <Users size={15} className="text-indigo-500" />;
    case 'daily_spark':      return <Sparkles size={15} className="text-yellow-500 fill-yellow-400" />;
    default:                 return <span className="text-[13px]">🌊</span>;
  }
}

function matchesFilter(type: string, filter: Filter): boolean {
  if (filter === 'All') return true;
  if (filter === 'Reactions') return type === 'reaction' || type === 'like' || type === 'like_comment';
  if (filter === 'Comments') return type === 'comment' || type === 'reply';
  if (filter === 'Follows') return type === 'follow' || type === 'community_invite';
  return false;
}

function linkForNotif(notif: { type: string; postId?: string; communityId?: string; actorId?: string; targetId?: string }): string | null {
  const { type, postId, communityId, actorId, targetId } = notif;
  if (type === 'reaction' || type === 'like' || type === 'comment' || type === 'reply' || type === 'like_comment') {
    const id = postId || targetId;
    return id ? `/post/${id}` : null;
  }
  if (type === 'follow') return actorId ? `/profile/${actorId}` : null;
  if (type === 'community_invite') { const id = communityId || targetId; return id ? `/communities/${id}` : null; }
  if (type === 'daily_spark') return '/?spark=1';
  return null;
}

export default function Notifications() {
  const [filter, setFilter] = useState<Filter>('All');
  const [, setLocation] = useLocation();
  const { notifications, markAllRead, markOneRead } = useNotifications();

  // Auto-mark all read after a brief delay so the user sees the unread state first
  useEffect(() => {
    const t = setTimeout(() => { markAllRead(); }, 4000);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = notifications.filter(n => matchesFilter(n.type, filter));
  const unreadCount = notifications.filter(n => !n.read).length;

  function handleNotifClick(notif: { id: string; type: string; postId?: string; communityId?: string; actorId?: string; targetId?: string }) {
    markOneRead(notif.id);
    const dest = linkForNotif(notif);
    if (dest) setLocation(dest);
  }

  return (
    <div className="pb-28 pt-4 md:pt-8 min-h-screen px-4 md:px-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-[26px] font-black text-gray-900 tracking-tight">Notifications</h1>
          {unreadCount > 0 && (
            <p className="text-[12.5px] text-purple-500 font-semibold mt-0.5">{unreadCount} unread</p>
          )}
        </div>
        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={markAllRead}
          className="p-2.5 hover:bg-purple-50 rounded-full transition-colors group"
          title="Mark all as read"
        >
          <CheckCheck size={20} className="text-gray-400 group-hover:text-purple-500 transition-colors" />
        </motion.button>
      </div>

      {/* Filter chips */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-none">
        {FILTERS.map(f => (
          <motion.button
            key={f}
            whileTap={{ scale: 0.93 }}
            onClick={() => setFilter(f)}
            className={cn(
              'whitespace-nowrap px-4 py-1.5 rounded-full text-[13px] font-bold transition-all',
              filter === f
                ? 'text-white shadow-sm'
                : 'bg-white border border-black/[0.07] text-gray-500 hover:border-purple-300 hover:text-purple-600'
            )}
            style={filter === f ? { background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)' } : {}}
          >
            {f}
          </motion.button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {filtered.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center py-24 text-center"
            >
              <div className="w-16 h-16 rounded-[22px] bg-gray-100 flex items-center justify-center mb-4">
                <Sparkles size={28} className="text-gray-300" />
              </div>
              <h3 className="font-black text-[17px] text-gray-700 mb-1.5">All quiet here</h3>
              <p className="text-[14px] text-gray-400 max-w-[220px] leading-relaxed">
                When people like, comment, or follow you — it'll show up here.
              </p>
            </motion.div>
          ) : filtered.map((notif, i) => (
            <motion.div
              key={notif.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => handleNotifClick(notif)}
              className={cn(
                'flex gap-3.5 p-4 rounded-[20px] transition-all cursor-pointer relative group',
                !notif.read
                  ? 'bg-purple-50 border border-purple-100 hover:bg-purple-100/60'
                  : 'bg-white border border-black/[0.05] shadow-sm hover:shadow-md'
              )}
            >
              {/* Unread dot */}
              {!notif.read && (
                <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-purple-500" />
              )}

              {/* Avatar / spark icon */}
              <div className="relative flex-shrink-0">
                {notif.type === 'daily_spark' ? (
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white shadow-md"
                    style={{ background: 'linear-gradient(135deg, #6B73FF, #9B59B6, #FF6B9D)' }}>
                    <Sparkles size={22} />
                  </div>
                ) : (
                  <div onClick={e => { e.stopPropagation(); }}> 
                    <Link href={`/profile/${notif.actorId}`}>
                      <UserAvatar
                        userId={notif.actorId}
                        fallbackName={notif.actor.displayName}
                        fallbackSrc={notif.actor.avatarUrl || undefined}
                        size={48}
                        className="cursor-pointer hover:opacity-90 transition-opacity"
                      />
                    </Link>
                  </div>
                )}
                {/* Type badge */}
                <div className="absolute -bottom-1 -right-1 w-[22px] h-[22px] bg-white rounded-full flex items-center justify-center border border-black/[0.06] shadow-sm">
                  {getIcon(notif.type)}
                </div>
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0 pt-0.5">
                <p className={cn('text-[14px] leading-snug pr-4', !notif.read ? 'font-semibold text-gray-900' : 'text-gray-700')}>
                  {notif.message}
                </p>
                <span className="text-[11.5px] text-gray-400 mt-1 block">
                  {formatDistanceToNow(notif.createdAt, { addSuffix: true })}
                </span>
              </div>

              {/* Respond CTA for daily_spark */}
              {notif.type === 'daily_spark' && (
                <div className="flex-shrink-0 self-center">
                  <motion.span
                    whileTap={{ scale: 0.92 }}
                    className="inline-flex items-center gap-1 px-3.5 py-1.5 text-white rounded-full text-[12px] font-black shadow-md"
                    style={{ background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)' }}
                  >
                    <Sparkles size={11} />
                    Respond
                  </motion.span>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
