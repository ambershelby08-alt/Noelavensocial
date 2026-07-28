/**
 * Firestore service layer for Stories.
 * Stories live in the top-level `stories` collection and expire after 24 h.
 */

import {
  collection, doc, addDoc, updateDoc, deleteDoc, setDoc, getDoc, query,
  where, orderBy, onSnapshot, arrayUnion, serverTimestamp,
  Timestamp, type DocumentData, type Unsubscribe,
} from 'firebase/firestore';
import { safeGetTime } from '@/lib/timestamp';
import { db } from './firebase';
import type { User, SparkAudience } from './mockData';
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
  /** Who can see this story. Defaults to 'public' for legacy docs without the field. */
  storyAudience: SparkAudience;
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

/** Map any legacy / unknown audience string to a canonical SparkAudience value. */
function normalizeStoryAudience(raw: unknown): SparkAudience {
  switch (raw) {
    case 'mutuals': return 'mutuals';
    case 'private': return 'private';
    case 'onlyMe':
    case 'only_me': return 'onlyMe';
    default:        return 'public';
  }
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
    storyAudience:   normalizeStoryAudience(d.storyAudience),
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

// ─── Story reactions ──────────────────────────────────────────────────────────

/** One reaction per user per story; stored in stories/{storyId}/reactions/{userId}. */
export interface StoryReaction {
  userId: string;
  reactionType: string; // emoji character
  createdAt: Date;
}

/**
 * Toggle a reaction for a user on a story.
 * If the user already has the same emoji selected → remove it (toggle off).
 * If the user has a different emoji → replace it.
 * If no reaction yet → add it.
 */
export async function toggleStoryReaction(
  storyId: string,
  userId: string,
  reactionType: string,
): Promise<void> {
  if (!db) throw new Error('Firebase not configured');
  const ref = doc(db, 'stories', storyId, 'reactions', userId);
  const snap = await getDoc(ref);
  if (snap.exists() && snap.data().reactionType === reactionType) {
    // Same emoji tapped again → remove
    await deleteDoc(ref);
  } else {
    // New or changed reaction → upsert
    await setDoc(ref, { userId, reactionType, createdAt: serverTimestamp() });
  }
}

/** Real-time listener for all reactions on a story. */
export function subscribeStoryReactions(
  storyId: string,
  onData: (reactions: StoryReaction[]) => void,
): Unsubscribe {
  if (!db) return () => {};
  return onSnapshot(
    collection(db, 'stories', storyId, 'reactions'),
    snap => onData(snap.docs.map(d => ({
      userId:       d.data().userId       ?? d.id,
      reactionType: d.data().reactionType ?? '🌊',
      createdAt:    toDate(d.data().createdAt),
    }))),
    err => console.error('[subscribeStoryReactions]', err.code, err.message),
  );
}

// ─── Story comments ───────────────────────────────────────────────────────────

/**
 * A comment/reply left on a story.
 * Private by default — only the story author sees all comments in the activity panel.
 * The commenter sees their own comment immediately in the viewer.
 * Stored in stories/{storyId}/comments/{commentId}.
 */
export interface StoryComment {
  id: string;
  authorId: string;
  authorName: string;
  authorAvatarUrl: string;
  text: string;
  createdAt: Date;
}

/** Add a comment to a story. Returns the new document ID. */
export async function addStoryComment(
  storyId: string,
  author: { id: string; displayName: string; avatarUrl?: string | null },
  text: string,
): Promise<string> {
  if (!db) throw new Error('Firebase not configured');
  const ref = await addDoc(collection(db, 'stories', storyId, 'comments'), {
    authorId:        author.id,
    authorName:      author.displayName,
    authorAvatarUrl: author.avatarUrl ?? '',
    text,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Real-time listener for story comments, ordered oldest-first.
 *
 * Security model:
 *  - The story author can read ALL comments (rule: authorId on story == viewer uid).
 *  - Any other viewer can only read their OWN comments (rule: comment.authorId == viewer uid).
 *
 * To avoid a permission-denied error on the collection query, non-authors must
 * filter to only their own documents.  Passing isStoryAuthor=true skips the
 * filter so the owner sees everyone's comments in the activity panel.
 */
export function subscribeStoryComments(
  storyId: string,
  viewerUid: string,
  isStoryAuthor: boolean,
  onData: (comments: StoryComment[]) => void,
): Unsubscribe {
  if (!db) return () => {};

  const baseCol = collection(db, 'stories', storyId, 'comments');
  // Owner query: all comments ordered by time — uses a single-field index (always available).
  // Non-owner query: only their own comment(s). orderBy is omitted intentionally —
  // combining where(authorId) + orderBy(createdAt) needs a composite index that isn't
  // guaranteed to exist, and non-owners have at most one comment so ordering is irrelevant.
  const q = isStoryAuthor
    ? query(baseCol, orderBy('createdAt', 'asc'))
    : query(baseCol, where('authorId', '==', viewerUid));

  return onSnapshot(
    q,
    snap => onData(snap.docs.map(d => ({
      id:              d.id,
      authorId:        d.data().authorId        ?? '',
      authorName:      d.data().authorName      ?? '',
      authorAvatarUrl: d.data().authorAvatarUrl ?? '',
      text:            d.data().text            ?? '',
      createdAt:       toDate(d.data().createdAt),
    }))),
    err => console.error('[subscribeStoryComments]', err.code, err.message),
  );
}

// ─── Client-side grouping ─────────────────────────────────────────────────────

/**
 * Returns true if the viewer should see a story with the given audience.
 * Own stories are always visible.
 * 'public'  → everyone.
 * 'private' → "Followers-only": viewer must follow the author (one-way follow sufficient).
 * 'mutuals' → viewer must follow the author AND the author must follow the viewer back.
 * 'onlyMe'  → author only (no one else).
 */
function storyVisibleTo(
  story: Story,
  viewerId: string | undefined,
  followingIds: Set<string>,
  followerIds: Set<string>,
): boolean {
  if (story.authorId === viewerId) return true;   // always own
  switch (story.storyAudience) {
    case 'public':  return true;
    case 'private': return followingIds.has(story.authorId);
    case 'mutuals': return followingIds.has(story.authorId) && followerIds.has(story.authorId);
    case 'onlyMe':  return false;
    default:        return true;
  }
}

export function groupStories(
  stories: Story[],
  currentUserId?: string,
  followingIds: Set<string> = new Set(),
  followerIds: Set<string> = new Set(),
): StoryGroup[] {
  const map = new Map<string, StoryGroup>();

  for (const story of stories) {
    if (!storyVisibleTo(story, currentUserId, followingIds, followerIds)) continue;
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
