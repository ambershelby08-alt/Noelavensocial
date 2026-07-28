import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { isFirebaseConfigured } from '@/lib/firebase';
import {
  subscribeNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  deleteNotification as fsDeleteNotification,
  subscribeUnreadNotificationCount,
} from '@/lib/firestore';
import { mockNotifications } from '@/lib/mockData';
import type { Notification, NotificationType, NotificationPrefs } from '@/lib/mockData';
import { demoGetUserNotifs, demoMarkRead, demoMarkAllRead, demoClearNotif } from '@/lib/notifications';
import type { RawDemoNotif } from '@/lib/notifications';

// ─── Grouped notification type ────────────────────────────────────────────────

export interface GroupedNotification {
  id: string;
  ids: string[];
  type: NotificationType;
  actorId: string;
  actor: Notification['actor'];
  extraActors: Array<{ id: string; displayName: string; avatarUrl?: string }>;
  groupCount: number;
  postId?: string;
  communityId?: string;
  targetId?: string;
  commentId?: string;
  storyId?: string;
  convId?: string;
  emoji?: string;
  targetPreview?: string;
  message: string;
  read: boolean;
  createdAt: Date;
}

// ─── Notification prefs ───────────────────────────────────────────────────────

export const NOTIF_PREFS_KEY = 'nlv_notif_prefs';
const PAGE_SIZE = 25;

type FullPrefs = NotificationPrefs & { likes?: boolean; followers?: boolean; email?: boolean };

function defaultPrefs(): FullPrefs {
  return {
    reactions: true, comments: true, replies: true, follows: true,
    messages: true, mentions: true, storyReplies: true,
    dailySpark: true, communityInvites: true,
    likes: true, followers: true, email: false,
  };
}

export function loadNotifPrefs(): FullPrefs {
  try {
    const raw = localStorage.getItem(NOTIF_PREFS_KEY);
    return raw ? { ...defaultPrefs(), ...JSON.parse(raw) } : defaultPrefs();
  } catch { return defaultPrefs(); }
}

function typeMatchesPref(type: NotificationType, p: FullPrefs): boolean {
  switch (type) {
    case 'reaction': case 'like': case 'spark_reaction': case 'story_reaction': case 'like_comment':
      return (p.reactions ?? true) && (p.likes ?? true);
    case 'comment':     return p.comments ?? true;
    case 'reply':       return (p.replies ?? true) && (p.comments ?? true);
    case 'follow':      return (p.follows ?? true) && (p.followers ?? true);
    case 'message':     return p.messages ?? true;
    case 'mention':     return p.mentions ?? true;
    case 'story_reply': return p.storyReplies ?? true;
    case 'story_view':  return (p as unknown as Record<string, boolean>).storyViews ?? true;
    case 'daily_spark': return p.dailySpark ?? true;
    case 'community_invite': return p.communityInvites ?? true;
    default: return true;
  }
}

// ─── Grouping logic ───────────────────────────────────────────────────────────

function groupKey(n: Notification): string | null {
  switch (n.type) {
    case 'reaction': case 'like':
      return n.postId ? `react:${n.postId}` : null;
    case 'spark_reaction':
      return n.postId ? `spark_react:${n.postId}` : null;
    case 'story_reaction':
      return n.storyId ? `story_react:${n.storyId}` : null;
    case 'like_comment':
      return `lc:${n.postId ?? ''}:${n.commentId ?? ''}`;
    case 'follow':
      return 'follow:batch';
    default:
      return null;
  }
}

function buildGroupMessage(type: NotificationType, names: string[], emoji?: string, targetPreview?: string): string {
  const [a, b] = names;
  const rest = names.length - 2;
  const tail = rest > 0 ? ` and ${rest} ${rest === 1 ? 'other' : 'others'}` : '';

  if (type === 'follow') {
    if (names.length === 1) return `${a} started following you`;
    if (names.length === 2) return `${a} and ${b} started following you`;
    return `${a}, ${b}${tail} started following you`;
  }
  const target =
    type === 'story_reaction' ? 'your story' :
    type === 'spark_reaction' ? 'your Daily Spark' : 'your post';
  const ej = emoji ? ` ${emoji}` : '';
  if (names.length === 1) return `${a}${ej} reacted to ${target}${targetPreview ? `: "${targetPreview.slice(0, 50)}"` : ''}`;
  if (names.length === 2) return `${a} and ${b} reacted to ${target}`;
  return `${a}, ${b}${tail} reacted to ${target}`;
}

function groupNotifications(notifs: Notification[]): GroupedNotification[] {
  const buckets = new Map<string, Notification[]>();
  const order: string[] = [];

  for (const n of notifs) {
    const key = groupKey(n) ?? n.id;
    if (!buckets.has(key)) { buckets.set(key, []); order.push(key); }
    buckets.get(key)!.push(n);
  }

  return order.map(key => {
    const group = buckets.get(key)!;
    const primary = group[0];

    // Deduplicate actors within this group
    const seen = new Set<string>();
    const uniqueActors: Notification['actor'][] = [];
    for (const n of group) {
      if (!seen.has(n.actorId)) { seen.add(n.actorId); uniqueActors.push(n.actor); }
    }

    const names = uniqueActors.map(a => a.displayName);
    const extraActors = uniqueActors.slice(1).map(a => ({
      id: a.id, displayName: a.displayName, avatarUrl: a.avatarUrl,
    }));

    const message = uniqueActors.length > 1
      ? buildGroupMessage(primary.type, names, primary.emoji, primary.targetPreview)
      : primary.message;

    return {
      id: primary.id,
      ids: group.map(n => n.id),
      type: primary.type,
      actorId: primary.actorId,
      actor: primary.actor,
      extraActors,
      groupCount: uniqueActors.length,
      postId: primary.postId,
      communityId: primary.communityId,
      targetId: primary.targetId,
      commentId: primary.commentId,
      storyId: primary.storyId,
      convId: primary.convId,
      emoji: primary.emoji,
      targetPreview: primary.targetPreview,
      message,
      read: group.every(n => n.read),
      createdAt: primary.createdAt,
    };
  });
}

// ─── Demo → Notification converter ───────────────────────────────────────────

function fromDemo(d: RawDemoNotif): Notification {
  return {
    id: d.id,
    type: d.type,
    actorId: d.actorId,
    actor: {
      id: d.actorId, displayName: d.actorName, handle: d.actorHandle,
      avatarUrl: d.actorAvatar, bio: '', coverUrl: '',
      interests: [], followers: 0, following: 0, postCount: 0, badges: [], joinedAt: new Date(),
    },
    postId: d.postId, commentId: d.commentId, storyId: d.storyId,
    convId: d.convId, communityId: d.communityId, emoji: d.emoji,
    targetPreview: d.targetPreview, message: d.message,
    read: d.read, createdAt: new Date(d.createdAt),
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNotifications() {
  const { currentUser } = useAuth();
  const [rawNotifs, setRawNotifs] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [prefs, setPrefs] = useState<FullPrefs>(loadNotifPrefs);
  const [unreadBadgeCount, setUnreadBadgeCount] = useState(0);

  // Subscribe to live notifications
  useEffect(() => {
    if (!currentUser) { setIsLoading(false); return; }

    if (isFirebaseConfigured) {
      setIsLoading(true);
      const unsub = subscribeNotifications(currentUser.id, notifs => {
        setRawNotifs(notifs);
        setIsLoading(false);
      });
      return unsub;
    } else {
      // Demo mode: merge localStorage demo-written notifs with mock data
      const demoNotifs = demoGetUserNotifs(currentUser.id).map(fromDemo);
      setRawNotifs([...demoNotifs, ...mockNotifications]);
      setIsLoading(false);
      return undefined;
    }
  }, [currentUser?.id]);

  // Subscribe to unread badge count (Firestore only — demo derived from rawNotifs)
  useEffect(() => {
    if (!isFirebaseConfigured || !currentUser) return;
    const unsub = subscribeUnreadNotificationCount(currentUser.id, setUnreadBadgeCount);
    return unsub;
  }, [currentUser?.id]);

  // For demo mode, derive badge count from rawNotifs
  useEffect(() => {
    if (!isFirebaseConfigured) {
      setUnreadBadgeCount(rawNotifs.filter(n => !n.read).length);
    }
  }, [rawNotifs]);

  // Filter by prefs
  const filtered = useMemo(
    () => rawNotifs.filter(n => typeMatchesPref(n.type, prefs)),
    [rawNotifs, prefs]
  );

  // Group
  const grouped = useMemo(() => groupNotifications(filtered), [filtered]);

  // Paginate (client-side — Firebase already returns latest 50)
  const paginatedCount = page * PAGE_SIZE;
  const notifications = useMemo(() => grouped.slice(0, paginatedCount), [grouped, paginatedCount]);
  const hasMore = grouped.length > paginatedCount;
  const unreadCount = grouped.filter(n => !n.read).length;

  // ── Actions ──────────────────────────────────────────────────────────────────

  const markAllRead = useCallback(async () => {
    setRawNotifs(prev => prev.map(n => ({ ...n, read: true })));
    if (isFirebaseConfigured && currentUser) {
      await markAllNotificationsRead(currentUser.id).catch(console.error);
    } else if (currentUser) {
      demoMarkAllRead(currentUser.id);
    }
  }, [currentUser]);

  const markOneRead = useCallback(async (notifId: string) => {
    setRawNotifs(prev => prev.map(n => n.id === notifId ? { ...n, read: true } : n));
    if (isFirebaseConfigured) {
      await markNotificationRead(notifId).catch(console.error);
    } else {
      demoMarkRead(notifId);
    }
  }, []);

  const markGroupRead = useCallback(async (ids: string[]) => {
    setRawNotifs(prev => prev.map(n => ids.includes(n.id) ? { ...n, read: true } : n));
    if (isFirebaseConfigured) {
      await Promise.all(ids.map(id => markNotificationRead(id))).catch(console.error);
    } else {
      ids.forEach(id => demoMarkRead(id));
    }
  }, []);

  const deleteNotif = useCallback(async (ids: string[]) => {
    setRawNotifs(prev => prev.filter(n => !ids.includes(n.id)));
    if (isFirebaseConfigured) {
      await Promise.all(ids.map(id => fsDeleteNotification(id))).catch(console.error);
    } else {
      ids.forEach(id => demoClearNotif(id));
    }
  }, []);

  const loadMore = useCallback(() => setPage(p => p + 1), []);

  const refreshPrefs = useCallback(() => setPrefs(loadNotifPrefs()), []);

  return {
    notifications,
    grouped,
    isLoading,
    unreadCount,
    unreadBadgeCount,
    hasMore,
    markAllRead,
    markOneRead,
    markGroupRead,
    deleteNotif,
    loadMore,
    refreshPrefs,
    prefs,
  };
}
