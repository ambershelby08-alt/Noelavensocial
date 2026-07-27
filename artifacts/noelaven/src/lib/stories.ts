/**
 * Firestore service layer for Stories.
 * Stories live in the top-level `stories` collection and expire after 24 h.
 */

import {
  collection, doc, addDoc, updateDoc, deleteDoc, query,
  where, orderBy, onSnapshot, arrayUnion,
  Timestamp, type DocumentData, type Unsubscribe,
} from 'firebase/firestore';
import { safeGetTime } from '@/lib/timestamp';
import { db } from './firebase';
import type { User } from './mockData';
import type { EditorLayer, CropData, TrimData } from '@/components/stories/editor/types';
import type { FilterPreset } from '@/components/stories/editor/filters';

// Re-export editor types so callers can import from one place
export type { EditorLayer, CropData, TrimData } from '@/components/stories/editor/types';
export type { FilterPreset } from '@/components/stories/editor/filters';

// ─── Story types ──────────────────────────────────────────────────────────────

export type StoryMediaType = 'image' | 'video';

export interface Story {
  id: string;
  authorId: string;
  authorName: string;
  authorHandle: string;
  authorAvatarUrl: string;
  mediaUrl: string;
  publicId?: string;        // Cloudinary public_id (set on new uploads; absent on old stories)
  mediaType: StoryMediaType;
  caption: string;
  createdAt: Date;
  expiresAt: Date;
  viewerIds: string[];
  layers: EditorLayer[];
  cropData: CropData | null;
  trimData: TrimData | null;
  /** CSS filter preset applied to this story in the viewer. */
  filterName: FilterPreset;
}

export interface StoryGroup {
  authorId: string;
  authorName: string;
  authorHandle: string;
  authorAvatarUrl: string;
  stories: Story[];
  hasUnseen: boolean;
  isOwn: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDate(v: unknown): Date {
  // Duck-type instead of instanceof so this works across split-bundle monorepos
  // where the same Timestamp class may be imported from different module paths.
  return (v as { toDate?: () => Date })?.toDate?.() ?? new Date();
}

function docToStory(id: string, d: DocumentData): Story {
  return {
    id,
    authorId:        d.authorId       ?? '',
    authorName:      d.authorName     ?? '',
    authorHandle:    d.authorHandle   ?? '',
    authorAvatarUrl: d.authorAvatarUrl ?? '',
    mediaUrl:        d.mediaUrl       ?? '',
    publicId:        d.publicId       ?? undefined,
    mediaType:       (d.mediaType as StoryMediaType) ?? 'image',
    caption:         d.caption        ?? '',
    createdAt:       toDate(d.createdAt),
    expiresAt:       toDate(d.expiresAt),
    viewerIds:       Array.isArray(d.viewerIds) ? d.viewerIds : [],
    layers:          Array.isArray(d.layers)    ? d.layers    : [],
    cropData:        d.cropData  ?? null,
    trimData:        d.trimData  ?? null,
    filterName:      (d.filterName as FilterPreset) ?? 'normal',
  };
}

// ─── Firestore operations ─────────────────────────────────────────────────────

export async function createStory(
  author:     User,
  mediaUrl:   string,
  mediaType:  StoryMediaType,
  caption:    string,
  layers:     EditorLayer[]  = [],
  cropData:   CropData | null  = null,
  trimData:   TrimData | null  = null,
  filterName: FilterPreset     = 'normal',
  publicId?:  string,
  /** Canonical SparkAudience value; defaults to 'public'. */
  audience:   string = 'public',
): Promise<string> {
  if (!db) throw new Error('Firebase not configured');
  const now       = new Date();
  const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const ref = await addDoc(collection(db, 'stories'), {
    authorId:        author.id,
    authorName:      author.displayName,
    authorHandle:    author.handle,
    authorAvatarUrl: author.avatarUrl ?? '',
    mediaUrl,
    ...(publicId ? { publicId } : {}),
    mediaType,
    caption,
    layers,
    cropData:      cropData   ?? null,
    trimData:      trimData   ?? null,
    filterName:    filterName ?? 'normal',
    storyAudience: audience,
    createdAt:     Timestamp.fromDate(now),
    expiresAt:     Timestamp.fromDate(expiresAt),
    viewerIds:     [],
  });
  return ref.id;
}

export function subscribeStories(onData: (stories: Story[]) => void): Unsubscribe {
  if (!db) return () => {};
  const now = Timestamp.now();
  const q = query(
    collection(db, 'stories'),
    where('expiresAt', '>', now),
    orderBy('expiresAt', 'asc'),
  );
  return onSnapshot(q, snap => {
    onData(snap.docs.map(d => docToStory(d.id, d.data())));
  }, err => console.error('[subscribeStories]', err.code, err.message));
}

export async function markStoryViewed(storyId: string, userId: string): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'stories', storyId), { viewerIds: arrayUnion(userId) });
}

/**
 * Delete a story from Firestore.
 * The Cloudinary media file is NOT deleted here — that requires admin credentials
 * (CLOUDINARY_API_KEY + CLOUDINARY_API_SECRET) which are server-side secrets.
 * Cloudinary stories expire naturally after 24 h.
 * To add Cloudinary deletion, store the publicId here and call the API server.
 */
export async function deleteStory(storyId: string): Promise<void> {
  if (!db) throw new Error('Firebase not configured');
  await deleteDoc(doc(db, 'stories', storyId));
}

// ─── Client-side grouping ─────────────────────────────────────────────────────

export function groupStories(stories: Story[], currentUserId?: string): StoryGroup[] {
  const map = new Map<string, StoryGroup>();

  for (const story of stories) {
    if (!map.has(story.authorId)) {
      map.set(story.authorId, {
        authorId:        story.authorId,
        authorName:      story.authorName,
        authorHandle:    story.authorHandle,
        authorAvatarUrl: story.authorAvatarUrl,
        stories:   [],
        hasUnseen: false,
        isOwn:     story.authorId === currentUserId,
      });
    }
    const g = map.get(story.authorId)!;
    g.stories.push(story);
    if (currentUserId && !story.viewerIds.includes(currentUserId)) g.hasUnseen = true;
  }

  for (const g of map.values()) {
    g.stories.sort((a, b) => safeGetTime(a.createdAt) - safeGetTime(b.createdAt));
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.isOwn !== b.isOwn) return a.isOwn ? -1 : 1;
    if (a.hasUnseen !== b.hasUnseen) return a.hasUnseen ? -1 : 1;
    const aL = Math.max(...a.stories.map(s => safeGetTime(s.createdAt)));
    const bL = Math.max(...b.stories.map(s => safeGetTime(s.createdAt)));
    return bL - aL;
  });
}
