import React, { useState } from 'react';
import { useNotifications } from '@/hooks/useNotifications';
import type { GroupedNotification } from '@/hooks/useNotifications';
import { useLocation } from 'wouter';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { cn } from '@/lib/utils';
import {
  MessageCircle, UserPlus, Users, Sparkles, CheckCheck,
  Reply, Bell, MessageSquare, AtSign, Trash2,
} from 'lucide-react';
import type { NotificationType } from '@/lib/mockData';

// ─── Filters ──────────────────────────────────────────────────────────────────

const FILTERS = ['All', 'Reactions', 'Comments', 'Follows', 'Messages', 'Mentions'] as const;
type Filter = typeof FILTERS[number];

function matchesFilter(type: NotificationType, filter: Filter): boolean {
  if (filter === 'All') return true;
  if (filter === 'Reactions')
    return ['reaction', 'like', 'like_comment', 'spark_reaction', 'story_reaction'].includes(type);
  if (filter === 'Comments')
    return ['comment', 'reply', 'story_reply'].includes(type);
  if (filter === 'Follows')
    return ['follow', 'community_invite'].includes(type);
  if (filter === 'Messages') return type === 'message';
  if (filter === 'Mentions') return type === 'mention';
  return false;
}

function linkForNotif(n: GroupedNotification): string | null {
  const { type, postId, communityId, actorId, targetId, convId } = n;
  if (['reaction', 'like', 'comment', 'reply', 'like_comment', 'mention', 'spark_reaction'].includes(type)) {
    const id = postId ?? targetId;
    return id ? `/post/${id}` : null;
  }
  if (type === 'follow') return actorId ? `/profile/${actorId}` : null;
  if (type === 'community_invite') return communityId ? `/communities/${communityId}` : null;
  if (type === 'daily_spark') return '/?spark=1';
  if (type === 'message') return convId ? `/messages/${convId}` : '/messages';
  return null;
}

// ─── Icon ─────────────────────────────────────────────────────────────────────

function TypeIcon({ type, emoji }: { type: NotificationType; emoji?: string }) {
  switch (type) {
    case 'reaction': case 'like': case 'spark_reaction': case 'story_reaction':
      return <span className="text-[12px] leading-none">{emoji ?? '🌊'}</span>;
    case 'like_comment':
      return <span className="text-[12px] leading-none">🌊</span>;
    case 'comment': case 'story_reply':
      return <MessageCircle size={12} className="text-purple-500 fill-purple-100" />;
    case 'reply':
      return <Reply size={12} className="text-purple-400" />;
    case 'follow':
      return <UserPlus size={12} className="text-blue-500" />;
    case 'community_invite':
      return <Users size={12} className="text-indigo-500" />;
    case 'daily_spark':
      return <Sparkles size={12} className="text-yellow-500 fill-yellow-400" />;
    case 'message':
      return <MessageSquare size={12} className="text-pink-500" />;
    case 'mention':
      return <AtSign size={12} className="text-orange-500" />;
    default:
      return <span className="text-[12px] leading-none">🌊</span>;
  }
}

// ─── Avatar stack ─────────────────────────────────────────────────────────────

function AvatarStack({ notif }: { notif: GroupedNotification }) {
  const { actor, extraActors, groupCount } = notif;

  if (groupCount <= 1) {
    return (
      <div className="relative flex-shrink-0" style={{ width: 50, height: 50 }}>
        <UserAvatar
          userId={actor.id}
          fallbackName={actor.displayName}
          fallbackSrc={actor.avatarUrl || undefined}
          size={50}
        />
        <div className="absolute -bottom-0.5 -right-0.5 w-[22px] h-[22px] bg-white rounded-full flex items-center justify-center border border-black/[0.06] shadow-sm">
          <TypeIcon type={notif.type} emoji={notif.emoji} />
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex-shrink-0" style={{ width: 60, height: 52 }}>
      {/* Second actor (behind, right) */}
      {extraActors[0] && (
        <div className="absolute right-0 top-0">
          <UserAvatar
            userId={extraActors[0].id}
            fallbackName={extraActors[0].displayName}
            fallbackSrc={extraActors[0].avatarUrl || undefined}
            size={38}
            className="ring-2 ring-white"
          />
        </div>
      )}
      {/* Primary actor (front, left) */}
      <div className="absolute left-0 bottom-0">
        <UserAvatar
          userId={actor.id}
          fallbackName={actor.displayName}
          fallbackSrc={actor.avatarUrl || undefined}
          size={44}
          className="ring-2 ring-white"
        />
      </div>
      {/* Overflow count bubble */}
      {groupCount > 2 && (
        <div
          className="absolute right-0 bottom-0 min-w-[20px] h-5 rounded-full bg-purple-500 ring-2 ring-white flex items-center justify-center text-[9px] font-black text-white px-1"
          style={{ transform: 'translate(4px, 4px)' }}
        >
          +{Math.min(groupCount - 2, 99)}
        </div>
      )}
      {/* Type badge */}
      <div className="absolute left-7 bottom-0 w-[20px] h-[20px] bg-white rounded-full flex items-center justify-center border border-black/[0.06] shadow-sm">
        <TypeIcon type={notif.type} emoji={notif.emoji} />
      </div>
    </div>
  );
}

// ─── Notification item ────────────────────────────────────────────────────────

function NotifItem({
  notif, onTap, onDelete,
}: {
  notif: GroupedNotification;
  onTap: () => void;
  onDelete: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -60, height: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onTap}
      className={cn(
        'flex items-start gap-3.5 px-4 py-3.5 cursor-pointer active:bg-gray-100 transition-colors rounded-2xl relative group',
        !notif.read ? 'bg-purple-50/60' : 'hover:bg-gray-50/70'
      )}
    >
      {/* Unread dot */}
      {!notif.read && (
        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-purple-500" />
      )}

      <AvatarStack notif={notif} />

      <div className="flex-1 min-w-0 pt-0.5">
        <p className={cn(
          'text-[13.5px] leading-snug pr-7',
          !notif.read ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'
        )}>
          {notif.message}
        </p>
        {notif.targetPreview && (
          <p className="text-[12px] text-gray-400 mt-0.5 line-clamp-1 pr-7">
            "{notif.targetPreview}"
          </p>
        )}
        <span className="text-[11.5px] text-gray-400 mt-1 block">
          {formatDistanceToNow(notif.createdAt, { addSuffix: true })}
        </span>
      </div>

      {/* Spark CTA */}
      {notif.type === 'daily_spark' && (
        <motion.span
          whileTap={{ scale: 0.92 }}
          className="flex-shrink-0 self-center inline-flex items-center gap-1 px-3 py-1.5 text-white rounded-full text-[11.5px] font-black shadow-md"
          style={{ background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)' }}
        >
          <Sparkles size={11} />
          Respond
        </motion.span>
      )}

      {/* Delete */}
      <button
        onClick={e => { e.stopPropagation(); onDelete(); }}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full hover:bg-gray-200 active:bg-gray-300"
      >
        <Trash2 size={13} className="text-gray-400" />
      </button>
    </motion.div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-0.5 px-2">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="flex items-center gap-3.5 px-4 py-3.5 animate-pulse">
          <div className="w-[50px] h-[50px] rounded-full bg-gray-100 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 bg-gray-100 rounded-full" style={{ width: `${55 + (i % 3) * 15}%` }} />
            <div className="h-3 bg-gray-100 rounded-full w-1/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function Empty({ filter }: { filter: Filter }) {
  const msgs: Record<Filter, { title: string; desc: string }> = {
    All: { title: 'All caught up!', desc: 'When people interact with you, it shows here.' },
    Reactions: { title: 'No reactions yet', desc: 'When someone reacts to your posts, you\'ll see it here.' },
    Comments: { title: 'No comments yet', desc: 'Comments and replies on your posts will appear here.' },
    Follows: { title: 'No new followers', desc: 'When someone follows you, you\'ll be notified.' },
    Messages: { title: 'No message alerts', desc: 'New message notifications will appear here.' },
    Mentions: { title: 'No mentions yet', desc: 'When someone mentions you, you\'ll see it here.' },
  };
  const { title, desc } = msgs[filter];
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4 px-6">
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, #EDE9FE, #FCE7F3)' }}
      >
        <Bell size={32} className="text-purple-300" />
      </div>
      <div className="text-center">
        <p className="font-bold text-[17px] text-gray-900 mb-1">{title}</p>
        <p className="text-[13.5px] text-gray-400 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Notifications() {
  const [filter, setFilter] = useState<Filter>('All');
  const [, setLocation] = useLocation();
  const {
    notifications, isLoading, unreadCount, hasMore,
    markAllRead, markGroupRead, deleteNotif, loadMore,
  } = useNotifications();

  const filtered = notifications.filter(n => matchesFilter(n.type, filter));
  const filteredUnread = filtered.filter(n => !n.read).length;

  function handleTap(notif: GroupedNotification) {
    if (!notif.read) markGroupRead(notif.ids);
    const dest = linkForNotif(notif);
    if (dest) setLocation(dest);
  }

  return (
    <div className="pb-28 pt-4 md:pt-8 min-h-screen">

      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-4">
        <div>
          <h1 className="text-[26px] font-black text-gray-900 tracking-tight">Notifications</h1>
          {filteredUnread > 0 && (
            <p className="text-[13px] text-purple-500 font-semibold mt-0.5">
              {filteredUnread} new
            </p>
          )}
        </div>
        {unreadCount > 0 && (
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={markAllRead}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[12.5px] font-bold text-purple-600 bg-purple-50 hover:bg-purple-100 transition-colors border border-purple-100"
          >
            <CheckCheck size={14} />
            Mark all read
          </motion.button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto px-4 pb-3 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {FILTERS.map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              'flex-shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-semibold transition-all',
              filter === f
                ? 'text-white shadow-sm'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            )}
            style={filter === f ? { background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)' } : {}}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="px-2">
        {isLoading ? (
          <Skeleton />
        ) : filtered.length === 0 ? (
          <Empty filter={filter} />
        ) : (
          <AnimatePresence mode="popLayout">
            {filtered.map(notif => (
              <NotifItem
                key={notif.id}
                notif={notif}
                onTap={() => handleTap(notif)}
                onDelete={() => deleteNotif(notif.ids)}
              />
            ))}
          </AnimatePresence>
        )}

        {/* Load more */}
        {hasMore && !isLoading && (
          <div className="flex justify-center py-6">
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={loadMore}
              className="px-6 py-2.5 rounded-2xl bg-gray-100 text-gray-600 font-semibold text-[13.5px] hover:bg-gray-200 transition-colors"
            >
              Show older notifications
            </motion.button>
          </div>
        )}
      </div>
    </div>
  );
}
