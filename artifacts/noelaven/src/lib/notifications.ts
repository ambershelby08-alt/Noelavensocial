/**
 * High-level notification writing helpers.
 * Wraps Firestore writes + provides a demo-mode localStorage fallback.
 * All functions guard against self-notifications (actor === recipient).
 */

import { isFirebaseConfigured } from './firebase';
import { writeNotification } from './firestore';
import type { User, NotificationType } from './mockData';

// ─── Demo-mode storage ────────────────────────────────────────────────────────

const DEMO_NOTIFS_KEY = 'nlv_demo_notifications';

export interface RawDemoNotif {
  id: string;
  userId: string;
  type: NotificationType;
  actorId: string;
  actorName: string;
  actorHandle: string;
  actorAvatar: string;
  postId?: string;
  commentId?: string;
  storyId?: string;
  convId?: string;
  communityId?: string;
  emoji?: string;
  targetPreview?: string;
  message: string;
  read: boolean;
  createdAt: string; // ISO string
}

function demoGetAll(): RawDemoNotif[] {
  try {
    const raw = localStorage.getItem(DEMO_NOTIFS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function demoSave(notifs: RawDemoNotif[]) {
  try { localStorage.setItem(DEMO_NOTIFS_KEY, JSON.stringify(notifs)); } catch {}
}

function demoWrite(userId: string, type: NotificationType, actor: User, fields: Partial<RawDemoNotif>) {
  if (userId === actor.id) return; // no self-notifications
  const notif: RawDemoNotif = {
    id: `demo-notif-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    userId,
    type,
    actorId: actor.id,
    actorName: actor.displayName,
    actorHandle: actor.handle,
    actorAvatar: actor.avatarUrl ?? '',
    message: fields.message ?? '',
    read: false,
    createdAt: new Date().toISOString(),
    ...fields,
  };
  const existing = demoGetAll();
  demoSave([notif, ...existing].slice(0, 200));
}

export function demoGetUserNotifs(userId: string): RawDemoNotif[] {
  return demoGetAll().filter(n => n.userId === userId);
}

export function demoClearNotif(notifId: string) {
  demoSave(demoGetAll().filter(n => n.id !== notifId));
}

export function demoMarkRead(notifId: string) {
  demoSave(demoGetAll().map(n => n.id === notifId ? { ...n, read: true } : n));
}

export function demoMarkAllRead(userId: string) {
  demoSave(demoGetAll().map(n => n.userId === userId ? { ...n, read: true } : n));
}

// ─── Internal write helper ────────────────────────────────────────────────────

async function write(
  userId: string,
  type: NotificationType,
  actor: User,
  opts: {
    postId?: string; commentId?: string; storyId?: string;
    convId?: string; communityId?: string; emoji?: string;
    targetPreview?: string; message: string;
  }
) {
  if (isFirebaseConfigured) {
    await writeNotification(userId, type, actor, opts);
  } else {
    demoWrite(userId, type, actor, opts);
  }
}

// ─── Public notification writers ──────────────────────────────────────────────

export async function notifyFollow(recipientId: string, actor: User) {
  await write(recipientId, 'follow', actor, {
    message: `${actor.displayName} started following you`,
  });
}

export async function notifyReaction(
  postOwnerId: string,
  actor: User,
  emoji: string,
  postId: string,
  postPreview?: string,
) {
  await write(postOwnerId, 'reaction', actor, {
    postId,
    emoji,
    targetPreview: postPreview?.slice(0, 120),
    message: `${actor.displayName} ${emoji} reacted to your post`,
  });
}

export async function notifySparkReaction(
  postOwnerId: string,
  actor: User,
  emoji: string,
  postId: string,
) {
  await write(postOwnerId, 'spark_reaction', actor, {
    postId,
    emoji,
    message: `${actor.displayName} ${emoji} reacted to your Daily Spark`,
  });
}

export async function notifyComment(
  postOwnerId: string,
  actor: User,
  postId: string,
  commentPreview: string,
) {
  await write(postOwnerId, 'comment', actor, {
    postId,
    targetPreview: commentPreview.slice(0, 120),
    message: `${actor.displayName} commented: "${commentPreview.slice(0, 80)}"`,
  });
}

export async function notifyReply(
  commentOwnerId: string,
  actor: User,
  postId: string,
  commentId: string,
  replyPreview: string,
) {
  await write(commentOwnerId, 'reply', actor, {
    postId,
    commentId,
    targetPreview: replyPreview.slice(0, 120),
    message: `${actor.displayName} replied to your comment: "${replyPreview.slice(0, 80)}"`,
  });
}

export async function notifyMention(
  mentionedUserId: string,
  actor: User,
  postId: string,
  context: string,
) {
  await write(mentionedUserId, 'mention', actor, {
    postId,
    targetPreview: context.slice(0, 120),
    message: `${actor.displayName} mentioned you: "${context.slice(0, 80)}"`,
  });
}

export async function notifyMessage(
  recipientId: string,
  actor: User,
  convId: string,
  preview: string,
) {
  await write(recipientId, 'message', actor, {
    convId,
    targetPreview: preview.slice(0, 120),
    message: `${actor.displayName}: "${preview.slice(0, 80)}"`,
  });
}

export async function notifyStoryReaction(
  storyOwnerId: string,
  actor: User,
  storyId: string,
  emoji: string,
) {
  await write(storyOwnerId, 'story_reaction', actor, {
    storyId,
    emoji,
    message: `${actor.displayName} reacted ${emoji} to your story`,
  });
}

export async function notifyStoryReply(
  storyOwnerId: string,
  actor: User,
  storyId: string,
  replyPreview: string,
) {
  await write(storyOwnerId, 'story_reply', actor, {
    storyId,
    targetPreview: replyPreview.slice(0, 120),
    message: `${actor.displayName} replied to your story: "${replyPreview.slice(0, 80)}"`,
  });
}

export async function notifyCommentLike(
  commentOwnerId: string,
  actor: User,
  postId: string,
  commentId: string,
  commentPreview?: string,
) {
  await write(commentOwnerId, 'like_comment', actor, {
    postId,
    commentId,
    targetPreview: commentPreview?.slice(0, 120),
    message: `${actor.displayName} liked your comment${commentPreview ? `: "${commentPreview.slice(0, 60)}"` : ''}`,
  });
}
