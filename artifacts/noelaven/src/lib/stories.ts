/**
 * Firestore service layer for Stories.
 * Stories live in the top-level `stories` collection and expire after 24 h.
 */

import {
  collection, doc, addDoc, updateDoc, query,
  where, orderBy, onSnapshot, arrayUnion,
  Timestamp, type DocumentData, type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type { User } from './mockData';
import type { EditorLayer, CropData, TrimData } from '@/components/stories/editor/types';

// ─── Re-export editor types so callers can import from one place ──────────────
export type { EditorLayer, CropData, TrimData } from '@/components/stories/editor/types';

// ─── Story types ──────────────────────────────────────────────────────────────

export type StoryMediaType = 'image' | 'video';

export interface Story {
  id: string;
  authorId: string;
  authorName: string;
  authorHandle: string;
  authorAvatarUrl: string;
  mediaUrl: string;
  mediaType: StoryMediaType;
  /** The first text layer's content, or '' — kept for backward compat */
  caption: string;
  createdAt: Date;
  expiresAt: Date;
  viewerIds: string[];
  /** Text / sticker layers created in the editor */
  layers: EditorLayer[];
  /** CSS clip region, 0–100 % — null means no crop */
  cropData: CropData | null;
  /** Trim start/end in seconds — null means no trim */
  trimData: TrimData | null;
}

export interface StoryGroup {
  authorId: string;
  authorName: string;
  authorHandle: string;
  authorAvatarUrl: string;
  /** Stories sorted oldest → newest (natural viewing order) */
  stories: Story[];
  hasUnseen: boolean;
  isOwn: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDate(v: Timestamp | undefined): Date {
  return v instanceof Timestamp ? v.toDate() : new Date();
}

function docToStory(id: string, d: DocumentData): Story {
  return {
    id,
    authorId:      d.authorId ?? '',
    authorName:    d.authorName ?? '',
    authorHandle:  d.authorHandle ?? '',
    authorAvatarUrl: d.authorAvatarUrl ?? '',
    mediaUrl:      d.mediaUrl ?? '',
    mediaType:     (d.mediaType as StoryMediaType) ?? 'image',
    caption:       d.caption ?? '',
    createdAt:     toDate(d.createdAt),
    expiresAt:     toDate(d.expiresAt),
    viewerIds:     Array.isArray(d.viewerIds) ? d.viewerIds : [],
    layers:        Array.isArray(d.layers) ? d.layers : [],
    cropData:      d.cropData ?? null,
    trimData:      d.trimData ?? null,
  };
}

// ─── Firestore operations ─────────────────────────────────────────────────────

/** Create a new story that expires 24 h from now. */
export async function createStory(
  author: User,
  mediaUrl: string,
  mediaType: StoryMediaType,
  caption: string,
  layers: EditorLayer[] = [],
  cropData: CropData | null = null,
  trimData: TrimData | null = null,
): Promise<string> {
  if (!db) throw new Error('Firebase not configured');
  const now       = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const ref = await addDoc(collection(db, 'stories'), {
    authorId:      author.id,
    authorName:    author.displayName,
    authorHandle:  author.handle,
    authorAvatarUrl: author.avatarUrl ?? '',
    mediaUrl,
    mediaType,
    caption,
    layers,
    cropData:   cropData  ?? null,
    trimData:   trimData  ?? null,
    createdAt:  Timestamp.fromDate(now),
    expiresAt:  Timestamp.fromDate(expiresAt),
    viewerIds:  [],
  });
  return ref.id;
}

/** Subscribe to all non-expired stories ordered by expiry ascending. */
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
  await updateDoc(doc(db, 'stories', storyId), { viewerIds: arrayUnion(userId) });
}

// ─── Client-side grouping ─────────────────────────────────────────────────────

/** Group flat story list by author; own group first, then unseen. */
export function groupStories(stories: Story[], currentUserId?: string): StoryGroup[] {
  const map = new Map<string, StoryGroup>();

  for (const story of stories) {
    if (!map.has(story.authorId)) {
      map.set(story.authorId, {
        authorId:       story.authorId,
        authorName:     story.authorName,
        authorHandle:   story.authorHandle,
        authorAvatarUrl: story.authorAvatarUrl,
        stories:    [],
        hasUnseen:  false,
        isOwn:      story.authorId === currentUserId,
      });
    }
    const g = map.get(story.authorId)!;
    g.stories.push(story);
    if (currentUserId && !story.viewerIds.includes(currentUserId)) {
      g.hasUnseen = true;
    }
  }

  for (const g of map.values()) {
    g.stories.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.isOwn !== b.isOwn) return a.isOwn ? -1 : 1;
    if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1;
    const aLatest = Math.max(...a.stories.map((s) => s.createdAt.getTime()));
    const bLatest = Math.max(...b.stories.map((s) => s.createdAt.getTime()));
    return bLatest - aLatest;
  });
}
