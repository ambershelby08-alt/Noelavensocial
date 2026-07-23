/**
 * Firestore service layer for Stories.
 * Stories live in the top-level `stories` collection and expire after 24 h.
 * Expiry is enforced via a `where('expiresAt', '>', now)` filter in queries
 * (no Cloud Functions needed for simple client-only use).
 */

import {
  collection, doc, addDoc, updateDoc, query,
  where, orderBy, onSnapshot, arrayUnion,
  Timestamp, type DocumentData, type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type { User } from './mockData';

// ─── Types ────────────────────────────────────────────────────────────────────

export type StoryMediaType = 'image' | 'video';

export interface Story {
  id: string;
  authorId: string;
  authorName: string;
  authorHandle: string;
  authorAvatarUrl: string;
  mediaUrl: string;
  mediaType: StoryMediaType;
  caption: string;
  createdAt: Date;
  expiresAt: Date;
  /** IDs of users who have viewed this story. */
  viewerIds: string[];
}

export interface StoryGroup {
  authorId: string;
  authorName: string;
  authorHandle: string;
  authorAvatarUrl: string;
  /** Stories sorted oldest → newest so progress bars feel natural. */
  stories: Story[];
  /** True if the current user has at least one unseen story in this group. */
  hasUnseen: boolean;
  isOwn: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function docToStory(id: string, d: DocumentData): Story {
  const ts = (v: Timestamp | undefined) =>
    v instanceof Timestamp ? v.toDate() : new Date();
  return {
    id,
    authorId: d.authorId ?? '',
    authorName: d.authorName ?? '',
    authorHandle: d.authorHandle ?? '',
    authorAvatarUrl: d.authorAvatarUrl ?? '',
    mediaUrl: d.mediaUrl ?? '',
    mediaType: (d.mediaType as StoryMediaType) ?? 'image',
    caption: d.caption ?? '',
    createdAt: ts(d.createdAt),
    expiresAt: ts(d.expiresAt),
    viewerIds: Array.isArray(d.viewerIds) ? d.viewerIds : [],
  };
}

// ─── Firestore operations ─────────────────────────────────────────────────────

/** Create a new story that expires 24 h from now. */
export async function createStory(
  author: User,
  mediaUrl: string,
  mediaType: StoryMediaType,
  caption: string,
): Promise<string> {
  if (!db) throw new Error('Firebase not configured');
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const ref = await addDoc(collection(db, 'stories'), {
    authorId: author.id,
    authorName: author.displayName,
    authorHandle: author.handle,
    authorAvatarUrl: author.avatarUrl ?? '',
    mediaUrl,
    mediaType,
    caption,
    createdAt: Timestamp.fromDate(now),
    expiresAt: Timestamp.fromDate(expiresAt),
    viewerIds: [],
  });
  return ref.id;
}

/**
 * Subscribe to all non-expired stories, ordered by expiry ascending.
 * The listener fires immediately with the current snapshot, then on changes.
 */
export function subscribeStories(onData: (stories: Story[]) => void): Unsubscribe {
  if (!db) return () => {};
  const now = Timestamp.now();
  const q = query(
    collection(db, 'stories'),
    where('expiresAt', '>', now),
    orderBy('expiresAt', 'asc'),
  );
  return onSnapshot(q, (snap) => {
    onData(snap.docs.map((d) => docToStory(d.id, d.data())));
  });
}

/** Record that `userId` has seen this story. */
export async function markStoryViewed(storyId: string, userId: string): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'stories', storyId), {
    viewerIds: arrayUnion(userId),
  });
}

// ─── Client-side grouping ─────────────────────────────────────────────────────

/**
 * Group a flat list of stories by author.
 * Within each group, stories are sorted oldest → newest (natural viewing order).
 * Groups are sorted: own group first, then unseen groups, then seen groups.
 */
export function groupStories(stories: Story[], currentUserId?: string): StoryGroup[] {
  const map = new Map<string, StoryGroup>();

  for (const story of stories) {
    if (!map.has(story.authorId)) {
      map.set(story.authorId, {
        authorId: story.authorId,
        authorName: story.authorName,
        authorHandle: story.authorHandle,
        authorAvatarUrl: story.authorAvatarUrl,
        stories: [],
        hasUnseen: false,
        isOwn: story.authorId === currentUserId,
      });
    }
    const g = map.get(story.authorId)!;
    g.stories.push(story);
    if (currentUserId && !story.viewerIds.includes(currentUserId)) {
      g.hasUnseen = true;
    }
  }

  // Sort stories within each group oldest → newest
  for (const g of map.values()) {
    g.stories.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.isOwn && !b.isOwn) return -1;
    if (!a.isOwn && b.isOwn) return 1;
    if (a.hasUnseen && !b.hasUnseen) return -1;
    if (!a.hasUnseen && b.hasUnseen) return 1;
    // Fallback: more recent first (latest story in group)
    const aLatest = Math.max(...a.stories.map((s) => s.createdAt.getTime()));
    const bLatest = Math.max(...b.stories.map((s) => s.createdAt.getTime()));
    return bLatest - aLatest;
  });
}
