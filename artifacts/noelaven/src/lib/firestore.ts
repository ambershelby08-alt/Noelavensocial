/**
 * Firestore service layer — all reads/writes to Firebase go through here.
 * Every exported function checks `db` is available before touching Firestore,
 * so callers never need to guard individually.
 */

import {
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc,
  deleteDoc, query, where, orderBy, limit, startAfter, onSnapshot,
  serverTimestamp, increment, arrayUnion, arrayRemove, Timestamp,
  runTransaction,
  type DocumentData, type Unsubscribe, type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from './firebase';
import type { User, Post, Community, Message, Conversation, Notification, NotificationType } from './mockData';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Converts a Firestore Timestamp, plain Date, or undefined to a Date.
 *
 * Uses duck-typing (`typeof v.toDate === 'function'`) instead of
 * `instanceof Timestamp`.  In monorepo / split-bundle environments the
 * Firebase SDK can be instantiated from more than one module path, which
 * makes `instanceof` checks unreliable — an object from bundle A fails the
 * check against the class from bundle B.  Checking for the method avoids
 * this problem entirely.
 */
function ts(v: unknown): Date {
  if (!v && v !== 0) return new Date();
  if (v instanceof Date) return isNaN(v.getTime()) ? new Date() : v;
  if (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as { toDate?: unknown }).toDate === 'function'
  ) {
    try {
      const d = (v as { toDate: () => Date }).toDate();
      return d instanceof Date && !isNaN(d.getTime()) ? d : new Date();
    } catch { return new Date(); }
  }
  if (typeof v === 'string' || typeof v === 'number') {
    const d = new Date(v as string | number);
    return isNaN(d.getTime()) ? new Date() : d;
  }
  return new Date();
}

/**
 * Returns the start of the current day (00:00:00.000) in America/New_York as
 * a UTC Date. Works correctly during both EST (UTC-5) and EDT (UTC-4).
 */
function getETDayStart(): Date {
  const etDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
  const [y, m, d] = etDate.split('-').map(Number);
  // Try UTC-4 (EDT) then UTC-5 (EST) — use whichever produces ET hour 0
  for (const offsetH of [4, 5]) {
    const candidate = new Date(Date.UTC(y, m - 1, d, offsetH, 0, 0));
    const etHour = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      hour12: false,
    }).format(candidate);
    if (etHour === '0' || etHour === '00' || etHour === '24') return candidate;
  }
  return new Date(Date.UTC(y, m - 1, d, 5, 0, 0)); // safe fallback
}

// ─── User documents ───────────────────────────────────────────────────────────

export async function getUserDoc(uid: string): Promise<User | null> {
  if (!db) return null;
  const snap = await getDoc(doc(db, 'users', uid));
  if (!snap.exists()) return null;
  return docToUser(snap.id, snap.data());
}

function docToUser(id: string, d: DocumentData): User {
  return {
    id,
    displayName: d.displayName ?? '',
    handle: d.handle ?? '',
    bio: d.bio ?? '',
    avatarUrl: d.avatarUrl ?? '',
    coverUrl: d.coverUrl ?? '',
    coverPosition: d.coverPosition
      ? { x: d.coverPosition.x ?? 50, y: d.coverPosition.y ?? 50, zoom: d.coverPosition.zoom ?? 1 }
      : { x: 50, y: 50, zoom: 1 },
    interests: d.interests ?? [],
    followers: d.followers ?? 0,
    following: d.following ?? 0,
    postCount: d.postCount ?? 0,
    badges: d.badges ?? [],
    joinedAt: ts(d.joinedAt),
  };
}

export async function createUserDoc(
  uid: string,
  data: { displayName: string; handle: string; bio?: string; interests?: string[]; email?: string; avatarUrl?: string }
): Promise<void> {
  if (!db) return;
  await setDoc(doc(db, 'users', uid), {
    displayName: data.displayName,
    handle: data.handle,
    bio: data.bio ?? '',
    avatarUrl: data.avatarUrl ?? '',
    coverUrl: '',
    interests: data.interests ?? [],
    followers: 0,
    following: 0,
    postCount: 0,
    badges: ['New Member'],
    email: data.email ?? '',
    joinedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateUserDoc(uid: string, updates: Partial<User>): Promise<void> {
  if (!db) return;
  const { id: _id, joinedAt: _jat, ...rest } = updates as Partial<User> & { id?: string };
  await updateDoc(doc(db, 'users', uid), { ...rest, updatedAt: serverTimestamp() });
}

/**
 * Upsert base identity fields for a social/OAuth sign-in.
 * Uses merge:true so any existing handle, bio, interests, etc. are preserved.
 * joinedAt is intentionally omitted here — createUserDoc sets it when the
 * user completes their profile for the first time.
 */
export async function upsertUserBaseDoc(
  uid: string,
  data: { displayName: string; email: string; avatarUrl?: string }
): Promise<void> {
  if (!db) return;
  await setDoc(doc(db, 'users', uid), {
    displayName: data.displayName,
    email: data.email,
    avatarUrl: data.avatarUrl ?? '',
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// Search users by handle prefix (simple prefix search)
export async function searchUsers(q: string): Promise<User[]> {
  if (!db) return [];
  const snap = await getDocs(
    query(collection(db, 'users'), orderBy('handle'), limit(50))
  );
  const all = snap.docs.map(d => docToUser(d.id, d.data()));
  if (!q) return all;
  const lower = q.toLowerCase();
  return all.filter(u =>
    u.handle.toLowerCase().includes(lower) ||
    u.displayName.toLowerCase().includes(lower)
  );
}

/** Fetch all registered users (for ComposeDrawer / people picker). */
export async function getAllUsers(pageSize = 50): Promise<User[]> {
  if (!db) return [];
  const snap = await getDocs(
    query(collection(db, 'users'), orderBy('displayName'), limit(pageSize))
  );
  return snap.docs.map(d => docToUser(d.id, d.data()));
}

// ─── Posts ────────────────────────────────────────────────────────────────────

function docToPost(id: string, d: DocumentData): Post {
  return {
    id,
    authorId: d.authorId,
    author: {
      id: d.authorId,
      displayName: d.authorName ?? '',
      handle: d.authorHandle ?? '',
      bio: '', avatarUrl: '', coverUrl: '',
      interests: [], followers: 0, following: 0,
      postCount: 0, badges: [], joinedAt: new Date(),
    },
    content: d.content ?? '',
    imageUrl: d.imageUrl ?? undefined,
    imagePublicId: d.imagePublicId ?? undefined,
    communityId: d.communityId ?? undefined,
    sparkPrompt: d.sparkPrompt ?? undefined,
    sparkAudience: d.sparkAudience ?? undefined,
    likes: d.likes ?? 0,
    comments: d.comments ?? 0,
    shares: d.shares ?? 0,
    liked: false,
    saved: false,
    reactions: (d.reactions as Record<string, string[]>) ?? {},
    myReaction: null,
    mood: d.mood ?? undefined,
    commentsDisabled: d.commentsDisabled ?? false,
    createdAt: ts(d.createdAt),
  };
}

export async function createPost(
  author: User,
  content: string,
  opts: { imageUrl?: string; imagePublicId?: string; communityId?: string; mood?: string; sparkPrompt?: string; sparkAudience?: string } = {}
): Promise<string> {
  if (!db) throw new Error('Firestore not available');
  const ref = await addDoc(collection(db, 'posts'), {
    authorId: author.id,
    authorName: author.displayName,
    authorHandle: author.handle,
    content,
    imageUrl: opts.imageUrl ?? null,
    imagePublicId: opts.imagePublicId ?? null,
    communityId: opts.communityId ?? null,
    mood: opts.mood ?? null,
    sparkPrompt: opts.sparkPrompt ?? null,
    sparkAudience: opts.sparkAudience ?? null,
    commentsDisabled: false,
    likes: 0,
    comments: 0,
    shares: 0,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'users', author.id), { postCount: increment(1) });
  return ref.id;
}

/**
 * Subscribe to community spark responses for today's prompt.
 *
 * NOTE: We do NOT filter by createdAt here. The `sparkPrompt` field equals
 * today's AI-generated question, which changes every day. Prompt-equality
 * already scopes the query to today's posts — no date filter needed.
 *
 * Adding `where('createdAt', '>=', dayStart)` caused a `failed-precondition`
 * error when the required composite index was not yet deployed, which silently
 * timed out the feed because onSnapshot errors were not being caught.
 *
 * Supported by the existing composite index: (sparkPrompt ASC, createdAt DESC)
 */
export function subscribeCommunitySparkPosts(
  prompt: string,
  onData: (posts: Post[]) => void,
  pageSize = 10,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!db) return () => {};

  const q = query(
    collection(db, 'posts'),
    where('sparkPrompt', '==', prompt),
    orderBy('createdAt', 'desc'),
    limit(pageSize)
  );

  if (import.meta.env.DEV) {
    console.info(
      `[Firestore] subscribeCommunitySparkPosts — sparkPrompt="${prompt.slice(0, 40)}" pageSize=${pageSize}`
    );
  }

  return onSnapshot(
    q,
    (snap) => {
      if (import.meta.env.DEV) {
        console.info(
          `[Firestore] subscribeCommunitySparkPosts ✓ — ${snap.docs.length} docs, fromCache=${snap.metadata.fromCache}`
        );
      }
      // Client-side: only pass through PUBLIC spark posts.
      //
      // "Everyone" tab must show public posts to any authenticated viewer.
      // "friends"-audience posts are intentionally excluded here — they would
      // appear to people who are not the author's friends, which violates privacy.
      // The "Following" / "Friends" sort tabs apply additional client-side
      // filters (by following list) on top of this public-only set.
      const posts = snap.docs
        .map(d => docToPost(d.id, d.data()))
        .filter(p => p.sparkAudience === 'public');
      onData(posts);
    },
    (err) => {
      console.error(
        `[Firestore] subscribeCommunitySparkPosts ✗ — ${err.code}: ${err.message}`
      );
      onError?.(err);
    }
  );
}

/**
 * Returns the postId of a spark post the user has already submitted today
 * for the given prompt, or null if none found.
 * Used to enforce the one-response-per-day rule server-side.
 */
export async function checkTodaySparkAnswer(userId: string, sparkPrompt: string): Promise<string | null> {
  if (!db || !userId || !sparkPrompt) return null;
  try {
    const dayStart = getETDayStart(); // use ET midnight, not local midnight
    const q = query(
      collection(db, 'posts'),
      where('authorId', '==', userId),
      where('sparkPrompt', '==', sparkPrompt),
      where('createdAt', '>=', Timestamp.fromDate(dayStart)),
      limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return snap.docs[0].id;
  } catch {
    return null;
  }
}

export async function updatePostSparkAudience(postId: string, audience: string): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'posts', postId), { sparkAudience: audience });
}

export async function deletePost(postId: string, authorId: string): Promise<void> {
  if (!db) return;
  await Promise.all([
    deleteDoc(doc(db, 'posts', postId)),
    updateDoc(doc(db, 'users', authorId), { postCount: increment(-1) }),
  ]);
}

export async function updatePost(
  postId: string,
  updates: { content?: string; imageUrl?: string | null; imagePublicId?: string | null }
): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'posts', postId), { ...updates, updatedAt: serverTimestamp() });
}

export async function reportPost(postId: string, reporterId: string, reason: string): Promise<void> {
  if (!db) return;
  await addDoc(collection(db, 'reports'), {
    postId,
    reporterId,
    reason,
    createdAt: serverTimestamp(),
  });
}

export async function toggleCommentsDisabled(postId: string, disabled: boolean): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'posts', postId), { commentsDisabled: disabled });
}

export async function followUser(
  currentUserId: string,
  targetUserId: string,
  actor?: User
): Promise<void> {
  if (!db) return;
  await Promise.all([
    setDoc(doc(db, 'users', currentUserId, 'following', targetUserId), { createdAt: serverTimestamp() }),
    setDoc(doc(db, 'users', targetUserId, 'followers', currentUserId), { createdAt: serverTimestamp() }),
    updateDoc(doc(db, 'users', currentUserId), { following: increment(1) }).catch(() => {}),
    updateDoc(doc(db, 'users', targetUserId), { followers: increment(1) }).catch(() => {}),
  ]);
  // Notify the target user that someone followed them (fire-and-forget)
  if (actor) {
    writeNotification(targetUserId, 'follow', actor, {
      message: `${actor.displayName} started following you`,
    }).catch(console.error);
  }
}

export async function unfollowUser(currentUserId: string, targetUserId: string): Promise<void> {
  if (!db) return;
  await Promise.all([
    deleteDoc(doc(db, 'users', currentUserId, 'following', targetUserId)).catch(() => {}),
    deleteDoc(doc(db, 'users', targetUserId, 'followers', currentUserId)).catch(() => {}),
    updateDoc(doc(db, 'users', currentUserId), { following: increment(-1) }).catch(() => {}),
    updateDoc(doc(db, 'users', targetUserId), { followers: increment(-1) }).catch(() => {}),
  ]);
}

export function subscribeFeed(
  onData: (posts: Post[]) => void,
  currentUserId?: string,
  pageSize = 30
): Unsubscribe {
  if (!db) return () => {};
  const q = query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(pageSize));

  return onSnapshot(q, async snap => {
    const posts = snap.docs.map(d => docToPost(d.id, d.data()));

    if (currentUserId && db) {
      const savedSnap = await getDocs(collection(db, 'users', currentUserId, 'saved_posts'));
      const savedIds = new Set(savedSnap.docs.map(d => d.id));
      posts.forEach(p => {
        // Derive myReaction from the reactions map embedded in the post doc
        let myReaction: string | null = null;
        for (const [emoji, users] of Object.entries(p.reactions ?? {})) {
          if ((users as string[]).includes(currentUserId)) { myReaction = emoji; break; }
        }
        p.myReaction = myReaction;
        p.liked = myReaction !== null;
        p.saved = savedIds.has(p.id);
      });
    }
    onData(posts);
  }, err => console.error('[subscribeFeed]', err.code, err.message));
}

export function subscribeUserPosts(userId: string, onData: (posts: Post[]) => void): Unsubscribe {
  if (!db) return () => {};
  const q = query(
    collection(db, 'posts'),
    where('authorId', '==', userId),
    orderBy('createdAt', 'desc')
  );
  return onSnapshot(q, snap => {
    onData(snap.docs.map(d => docToPost(d.id, d.data())));
  }, err => console.error('[subscribeUserPosts]', err.code, err.message));
}

export async function togglePostLike(postId: string, userId: string, currentlyLiked: boolean): Promise<void> {
  if (!db) return;
  const postRef = doc(db, 'posts', postId);
  const likeRef = doc(db, 'users', userId, 'liked_posts', postId);
  if (currentlyLiked) {
    await Promise.all([updateDoc(postRef, { likes: increment(-1) }), deleteDoc(likeRef)]);
  } else {
    await Promise.all([updateDoc(postRef, { likes: increment(1) }), setDoc(likeRef, { likedAt: serverTimestamp() })]);
  }
}

/**
 * Toggle a Noelaven reaction on a post.
 * - Same emoji → remove (toggle off)
 * - Different emoji → switch (remove old, add new, count unchanged)
 * - No previous → add new (count +1)
 */
export async function togglePostReaction(
  postId: string,
  userId: string,
  emoji: string,
  actorProfile?: User
): Promise<void> {
  if (!db) return;
  const postRef = doc(db, 'posts', postId);
  let postAuthorId: string | null = null;
  let isNewReaction = false;

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(postRef);
    if (!snap.exists()) return;
    postAuthorId = snap.data().authorId ?? null;
    const currentReactions: Record<string, string[]> = (snap.data().reactions as Record<string, string[]>) ?? {};

    // Find user's existing reaction
    let prevEmoji: string | null = null;
    for (const [e, users] of Object.entries(currentReactions)) {
      if ((users as string[]).includes(userId)) { prevEmoji = e; break; }
    }

    const toggledOff = prevEmoji === emoji;
    const updates: Record<string, unknown> = {};

    if (toggledOff) {
      // Remove: filter userId out of this emoji's array
      updates[`reactions.${emoji}`] = (currentReactions[emoji] ?? []).filter((id: string) => id !== userId);
      updates.likes = increment(-1);
      isNewReaction = false;
    } else {
      if (prevEmoji) {
        // Switch: remove from previous
        updates[`reactions.${prevEmoji}`] = (currentReactions[prevEmoji] ?? []).filter((id: string) => id !== userId);
        // likes count unchanged when switching
        isNewReaction = false; // switching emoji, not a new reaction event
      } else {
        // Brand new reaction
        updates.likes = increment(1);
        isNewReaction = true;
      }
      // Add to new emoji (deduped)
      updates[`reactions.${emoji}`] = [
        ...(currentReactions[emoji] ?? []).filter((id: string) => id !== userId),
        userId,
      ];
    }

    tx.update(postRef, updates);
  });

  // Notify the post's author of a new reaction (fire-and-forget; no-op if self)
  if (isNewReaction && postAuthorId && actorProfile) {
    writeNotification(postAuthorId, 'reaction', actorProfile, {
      postId,
      emoji,
      message: `${actorProfile.displayName} reacted ${emoji} to your post`,
    }).catch(console.error);
  }
}

export async function togglePostSave(postId: string, userId: string, currentlySaved: boolean): Promise<void> {
  if (!db) return;
  const saveRef = doc(db, 'users', userId, 'saved_posts', postId);
  if (currentlySaved) {
    await deleteDoc(saveRef);
  } else {
    await setDoc(saveRef, { savedAt: serverTimestamp() });
  }
}

export async function incrementPostComments(postId: string): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'posts', postId), { comments: increment(1) });
}

// ─── Communities ──────────────────────────────────────────────────────────────

function docToCommunity(id: string, d: DocumentData, joinedIds?: Set<string>): Community {
  return {
    id,
    name: d.name ?? '',
    description: d.description ?? '',
    bannerUrl: d.bannerUrl ?? '',
    emoji: d.emoji ?? '✨',
    memberCount: d.memberCount ?? 0,
    postCount: d.postCount ?? 0,
    onlineCount: d.onlineCount ?? 0,
    category: d.category ?? 'General',
    rules: d.rules ?? [],
    moderatorIds: d.moderatorIds ?? [],
    isJoined: joinedIds ? joinedIds.has(id) : false,
    isPrivate: d.isPrivate ?? false,
    createdAt: ts(d.createdAt),
  };
}

export function subscribeCommunities(
  currentUserId: string | undefined,
  onData: (communities: Community[]) => void
): Unsubscribe {
  if (!db) return () => {};
  const q = query(collection(db, 'communities'), orderBy('memberCount', 'desc'), limit(50));

  return onSnapshot(q, async snap => {
    let joinedIds = new Set<string>();
    if (currentUserId && db) {
      const joinedSnap = await getDocs(collection(db, 'users', currentUserId, 'joined_communities'));
      joinedIds = new Set(joinedSnap.docs.map(d => d.id));
    }
    onData(snap.docs.map(d => docToCommunity(d.id, d.data(), joinedIds)));
  }, err => console.error('[subscribeCommunities]', err.code, err.message));
}

export async function toggleCommunityMembership(
  communityId: string,
  userId: string,
  currentlyJoined: boolean
): Promise<void> {
  if (!db) return;
  const commRef = doc(db, 'communities', communityId);
  const memberRef = doc(db, 'users', userId, 'joined_communities', communityId);
  if (currentlyJoined) {
    await Promise.all([updateDoc(commRef, { memberCount: increment(-1) }), deleteDoc(memberRef)]);
  } else {
    await Promise.all([updateDoc(commRef, { memberCount: increment(1) }), setDoc(memberRef, { joinedAt: serverTimestamp() })]);
  }
}

export async function createCommunity(
  data: { name: string; description: string; category: string; isPrivate: boolean; rules: string[] },
  creatorId: string,
  emoji: string
): Promise<string> {
  if (!db) throw new Error('Firestore not available');
  const ref = await addDoc(collection(db, 'communities'), {
    name: data.name,
    description: data.description,
    bannerUrl: '',
    emoji,
    memberCount: 1,
    postCount: 0,
    onlineCount: 1,
    category: data.category,
    rules: data.rules,
    moderatorIds: [creatorId],
    isPrivate: data.isPrivate,
    createdAt: serverTimestamp(),
  });
  await setDoc(doc(db, 'users', creatorId, 'joined_communities', ref.id), { joinedAt: serverTimestamp() });
  return ref.id;
}

// ─── Conversations ────────────────────────────────────────────────────────────

function docToConversation(id: string, d: DocumentData, currentUserId?: string): Conversation {
  return {
    id,
    type: d.type ?? 'direct',
    name: d.name ?? undefined,
    participants: (d.participants ?? []).map((p: DocumentData) => docToUser(p.id ?? '', p)),
    lastMessage: d.lastMessage ?? '',
    lastMessageType: d.lastMessageType ?? 'text',
    lastSenderId: d.lastSenderId ?? undefined,
    lastMessageAt: ts(d.lastMessageAt),
    unreadCount: (d.unreadCounts ?? {})[currentUserId ?? ''] ?? 0,
    pinnedBy: d.pinnedBy ?? [],
    archivedBy: d.archivedBy ?? [],
    mutedBy: d.mutedBy ?? [],
  };
}

function docToMessage(id: string, data: DocumentData): Message {
  return {
    id,
    senderId: data.senderId ?? '',
    content: data.content ?? '',
    type: (data.type ?? 'text') as Message['type'],
    reactions: data.reactions ?? {},
    readBy: data.readBy ?? [],
    deliveredTo: data.deliveredTo ?? [],
    replyToId: data.replyToId ?? undefined,
    replyToPreview: data.replyToPreview ?? undefined,
    editedAt: data.editedAt ? ts(data.editedAt) : undefined,
    editedContent: data.editedContent ?? undefined,
    deletedFor: data.deletedFor ?? [],
    deletedForEveryone: data.deletedForEveryone ?? false,
    mediaUrl: data.mediaUrl ?? undefined,
    mediaType: data.mediaType ?? undefined,
    voiceDuration: data.voiceDuration ?? undefined,
    voiceWaveformData: data.voiceWaveformData ?? undefined,
    forwardedFrom: data.forwardedFrom ?? undefined,
    sharedPost: data.sharedPost ?? undefined,
    createdAt: ts(data.createdAt),
  };
}

export function subscribeConversations(userId: string, onData: (convs: Conversation[]) => void): Unsubscribe {
  if (!db) return () => {};
  const q = query(
    collection(db, 'conversations'),
    where('participantIds', 'array-contains', userId),
    orderBy('lastMessageAt', 'desc')
  );
  return onSnapshot(q, snap => {
    onData(snap.docs.map(d => docToConversation(d.id, d.data(), userId)));
  }, err => console.error('[subscribeConversations]', err.code, err.message));
}

/**
 * Subscribe to the most recent `pageSize` messages in a conversation.
 * Uses desc order + limit so that real-time arrivals (newest timestamps)
 * always fall inside the query window. Results are reversed before delivery
 * so the UI sees chronological (asc) order.
 *
 * `oldestDoc` is the Firestore snapshot of the oldest document in the current
 * window — used as a cursor to page further back in time.
 */
export function subscribeMessages(
  convId: string,
  onData: (msgs: Message[], oldestDoc?: QueryDocumentSnapshot) => void,
  pageSize = 50
): Unsubscribe {
  if (!db) return () => {};
  const q = query(
    collection(db, 'conversations', convId, 'messages'),
    orderBy('createdAt', 'desc'),  // newest first → new messages never fall outside the window
    limit(pageSize)
  );
  return onSnapshot(q, snap => {
    // Reverse so the UI sees oldest → newest (asc) order
    const msgs = snap.docs.map(d => docToMessage(d.id, d.data())).reverse();
    // The oldest document is the last in the desc-sorted snapshot
    const oldestDoc = snap.docs.length >= pageSize ? snap.docs[snap.docs.length - 1] : undefined;
    onData(msgs, oldestDoc);
  }, err => console.error('[subscribeMessages]', err.code, err.message));
}

/**
 * Fetch a page of messages older than `olderThanDoc`.
 * Uses the same desc ordering so cursors are consistent with subscribeMessages.
 * Results are reversed (asc) for prepending to the UI list.
 */
export async function fetchOlderMessages(
  convId: string,
  olderThanDoc: QueryDocumentSnapshot,
  pageSize = 30
): Promise<{ messages: Message[]; oldestDoc?: QueryDocumentSnapshot }> {
  if (!db) return { messages: [] };
  const q = query(
    collection(db, 'conversations', convId, 'messages'),
    orderBy('createdAt', 'desc'),
    startAfter(olderThanDoc),      // messages with createdAt < olderThanDoc's createdAt
    limit(pageSize)
  );
  const snap = await getDocs(q);
  return {
    messages: snap.docs.map(d => docToMessage(d.id, d.data())).reverse(), // asc for prepend
    oldestDoc: snap.docs.length >= pageSize ? snap.docs[snap.docs.length - 1] : undefined,
  };
}

/** Send a message with full extended fields. Returns the new message id. */
export async function sendMessage(
  convId: string,
  senderId: string,
  content: string,
  type: Message['type'] = 'text',
  opts: {
    replyToId?: string;
    replyToPreview?: Message['replyToPreview'];
    mediaUrl?: string;
    mediaType?: string;
    voiceDuration?: number;
    voiceWaveformData?: number[];
    sharedPost?: Message['sharedPost'];
    forwardedFrom?: Message['forwardedFrom'];
  } = {},
  senderProfile?: User
): Promise<string> {
  if (!db) return '';
  const ref = await addDoc(collection(db, 'conversations', convId, 'messages'), {
    senderId,
    content,
    type,
    reactions: {},
    readBy: [senderId],
    deliveredTo: [],
    deletedFor: [],
    deletedForEveryone: false,
    editedAt: null,
    editedContent: null,
    replyToId: opts.replyToId ?? null,
    replyToPreview: opts.replyToPreview ?? null,
    mediaUrl: opts.mediaUrl ?? null,
    mediaType: opts.mediaType ?? null,
    voiceDuration: opts.voiceDuration ?? null,
    voiceWaveformData: opts.voiceWaveformData ?? null,
    sharedPost: opts.sharedPost ?? null,
    forwardedFrom: opts.forwardedFrom ?? null,
    createdAt: serverTimestamp(),
  });

  // Preview text for conversation list
  const preview =
    type === 'image' ? '📷 Photo'
    : type === 'video' ? '🎥 Video'
    : type === 'voice' ? '🎤 Voice message'
    : type === 'post_share' ? '📌 Shared a post'
    : content;

  // Increment unread counts for all other participants
  const convSnap = await getDoc(doc(db, 'conversations', convId));
  const unreadUpdates: Record<string, ReturnType<typeof increment>> = {};
  if (convSnap.exists()) {
    const pids = (convSnap.data().participantIds ?? []) as string[];
    for (const pid of pids) {
      if (pid !== senderId) unreadUpdates[`unreadCounts.${pid}`] = increment(1);
    }
  }
  await updateDoc(doc(db, 'conversations', convId), {
    lastMessage: preview,
    lastMessageType: type,
    lastSenderId: senderId,
    lastMessageAt: serverTimestamp(),
    ...unreadUpdates,
  });

  // Write a `type:'message'` notification for every participant except the sender.
  // Fire-and-forget — don't block the UI on notification delivery.
  if (senderProfile && convSnap.exists()) {
    const pids = (convSnap.data().participantIds ?? []) as string[];
    for (const pid of pids) {
      if (pid !== senderId) {
        const notifMessage = type === 'image'
          ? `${senderProfile.displayName} sent you a photo`
          : type === 'voice'
          ? `${senderProfile.displayName} sent you a voice message`
          : type === 'video'
          ? `${senderProfile.displayName} sent you a video`
          : `${senderProfile.displayName}: ${content.slice(0, 80)}`;
        writeNotification(pid, 'message', senderProfile, {
          convId,
          message: notifMessage,
          targetPreview: preview.length > 80 ? preview.slice(0, 80) : preview,
        }).catch(console.error);
      }
    }
  }

  return ref.id;
}

export async function markConversationRead(convId: string, userId: string): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'conversations', convId), {
    [`unreadCounts.${userId}`]: 0,
  });
}


export async function subscribeConversation(
  convId: string,
  onData: (conv: Conversation | null) => void,
  currentUserId?: string
): Promise<Unsubscribe> {
  if (!db) return () => {};
  return onSnapshot(doc(db, 'conversations', convId), snap => {
    if (!snap.exists()) { onData(null); return; }
    onData(docToConversation(snap.id, snap.data(), currentUserId));
  }, err => console.error('[subscribeConversation]', err.code, err.message));
}

export async function getOrCreateDirectConversation(
  userId: string,
  otherUserId: string,
  currentUser: User,
  otherUser: User
): Promise<string> {
  if (!db) throw new Error('Firestore not available');
  const q = query(
    collection(db, 'conversations'),
    where('type', '==', 'direct'),
    where('participantIds', 'array-contains', userId)
  );
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    if ((d.data().participantIds as string[]).includes(otherUserId)) return d.id;
  }
  const ref = await addDoc(collection(db, 'conversations'), {
    type: 'direct',
    participantIds: [userId, otherUserId],
    participants: [
      { id: currentUser.id, displayName: currentUser.displayName, handle: currentUser.handle },
      { id: otherUser.id, displayName: otherUser.displayName, handle: otherUser.handle },
    ],
    lastMessage: '',
    lastMessageAt: serverTimestamp(),
    unreadCounts: { [userId]: 0, [otherUserId]: 0 },
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

// ─── Message actions ──────────────────────────────────────────────────────────

export async function editMessage(
  convId: string, msgId: string, newContent: string
): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'conversations', convId, 'messages', msgId), {
    editedContent: newContent,
    editedAt: serverTimestamp(),
  });
}

export async function deleteMessageForMe(
  convId: string, msgId: string, userId: string
): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'conversations', convId, 'messages', msgId), {
    deletedFor: arrayUnion(userId),
  });
}

export async function deleteMessageForEveryone(
  convId: string, msgId: string
): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'conversations', convId, 'messages', msgId), {
    deletedForEveryone: true,
    editedContent: null,
    mediaUrl: null,
  });
}

export async function toggleMessageReaction(
  convId: string, msgId: string, userId: string, emoji: string
): Promise<void> {
  if (!db) return;
  const msgRef = doc(db, 'conversations', convId, 'messages', msgId);
  const snap = await getDoc(msgRef);
  if (!snap.exists()) return;
  const reactions: Record<string, string[]> = snap.data().reactions ?? {};
  const users = reactions[emoji] ?? [];
  if (users.includes(userId)) {
    const next = users.filter(u => u !== userId);
    if (next.length === 0) {
      const { [emoji]: _removed, ...rest } = reactions;
      await updateDoc(msgRef, { reactions: rest });
    } else {
      await updateDoc(msgRef, { [`reactions.${emoji}`]: next });
    }
  } else {
    await updateDoc(msgRef, { [`reactions.${emoji}`]: arrayUnion(userId) });
  }
}

export async function markMessageDelivered(
  convId: string, msgId: string, userId: string
): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'conversations', convId, 'messages', msgId), {
    deliveredTo: arrayUnion(userId),
  });
}

// ─── Conversation management ──────────────────────────────────────────────────

export async function pinConversation(
  convId: string, userId: string, pin: boolean
): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'conversations', convId), {
    pinnedBy: pin ? arrayUnion(userId) : arrayRemove(userId),
  });
}

export async function archiveConversation(
  convId: string, userId: string, archive: boolean
): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'conversations', convId), {
    archivedBy: archive ? arrayUnion(userId) : arrayRemove(userId),
  });
}

export async function muteConversation(
  convId: string, userId: string, mute: boolean
): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'conversations', convId), {
    mutedBy: mute ? arrayUnion(userId) : arrayRemove(userId),
  });
}

export async function leaveGroupConversation(
  convId: string, userId: string
): Promise<void> {
  if (!db) return;
  const convRef = doc(db, 'conversations', convId);
  const snap = await getDoc(convRef);
  if (!snap.exists()) return;
  const d = snap.data();
  const participants = (d.participants ?? []).filter((p: DocumentData) => p.id !== userId);
  const participantIds = (d.participantIds ?? []).filter((id: string) => id !== userId);
  await updateDoc(convRef, { participants, participantIds });
}

export async function blockUser(
  currentUserId: string, targetUserId: string
): Promise<void> {
  if (!db) return;
  await setDoc(doc(db, 'users', currentUserId, 'blocked', targetUserId), {
    blockedAt: serverTimestamp(),
  });
}

export async function reportConversation(
  convId: string, reporterId: string, reason: string
): Promise<void> {
  if (!db) return;
  await addDoc(collection(db, 'reports'), {
    type: 'conversation',
    convId,
    reporterId,
    reason,
    createdAt: serverTimestamp(),
  });
}

// ─── Typing status ────────────────────────────────────────────────────────────

export async function setTypingStatus(
  convId: string, userId: string, isTyping: boolean
): Promise<void> {
  if (!db) return;
  const ref = doc(db, 'conversations', convId, 'typing', userId);
  if (isTyping) {
    await setDoc(ref, { userId, typingAt: serverTimestamp() });
  } else {
    await deleteDoc(ref).catch(() => {});
  }
}

export function subscribeTypingStatus(
  convId: string,
  currentUserId: string,
  onData: (typingUserIds: string[]) => void
): Unsubscribe {
  if (!db) return () => {};
  return onSnapshot(
    collection(db, 'conversations', convId, 'typing'),
    snap => {
      const now = Date.now();
      const ids = snap.docs
        .filter(d => {
          const t = d.data().typingAt as Timestamp | undefined;
          const ms = (t as { toDate?: () => Date })?.toDate?.()?.getTime() ?? 0;
          return d.id !== currentUserId && now - ms < 8000;
        })
        .map(d => d.id);
      onData(ids);
    },
    err => console.error('[subscribeTypingStatus]', err.code, err.message)
  );
}

// ─── Notifications ────────────────────────────────────────────────────────────

function docToNotification(id: string, d: DocumentData): Notification {
  return {
    id,
    type: d.type as NotificationType,
    actorId: d.actorId,
    actor: {
      id: d.actorId,
      displayName: d.actorName ?? '',
      handle: d.actorHandle ?? '',
      bio: '', avatarUrl: d.actorAvatar ?? '', coverUrl: '',
      interests: [], followers: 0, following: 0,
      postCount: 0, badges: [], joinedAt: new Date(),
    },
    postId: d.postId ?? undefined,
    communityId: d.communityId ?? undefined,
    targetId: d.targetId ?? undefined,
    commentId: d.commentId ?? undefined,
    storyId: d.storyId ?? undefined,
    convId: d.convId ?? undefined,
    emoji: d.emoji ?? undefined,
    targetPreview: d.targetPreview ?? undefined,
    message: d.message ?? '',
    read: d.read ?? false,
    createdAt: ts(d.createdAt),
  };
}

export function subscribeNotifications(userId: string, onData: (notifs: Notification[]) => void): Unsubscribe {
  if (!db) return () => {};
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(50)
  );
  return onSnapshot(q, snap => onData(snap.docs.map(d => docToNotification(d.id, d.data()))),
    err => console.error('[subscribeNotifications]', err.code, err.message));
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  if (!db) return;
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    where('read', '==', false)
  );
  const snap = await getDocs(q);
  await Promise.all(snap.docs.map(d => updateDoc(d.ref, { read: true })));
}

export async function markNotificationRead(notifId: string): Promise<void> {
  if (!db) return;
  await updateDoc(doc(db, 'notifications', notifId), { read: true }).catch(() => {});
}

export async function deleteNotification(notifId: string): Promise<void> {
  if (!db) return;
  await deleteDoc(doc(db, 'notifications', notifId)).catch(() => {});
}

export function subscribeUnreadNotificationCount(
  userId: string,
  onCount: (count: number) => void
): Unsubscribe {
  if (!db) return () => {};
  const q = query(
    collection(db, 'notifications'),
    where('userId', '==', userId),
    where('read', '==', false)
  );
  return onSnapshot(q, snap => onCount(snap.size),
    err => console.error('[subscribeUnreadNotificationCount]', err.code, err.message));
}

// ─── Comments ─────────────────────────────────────────────────────────────────

/** Raw comment shape returned from Firestore (no `liked` field — tracked locally). */
export type RawComment = {
  id: string;
  authorId: string;
  author: User;
  text: string;
  likes: number;
  replyCount: number;
  createdAt: Date;
};

export function subscribeComments(
  postId: string,
  onData: (comments: RawComment[]) => void
): Unsubscribe {
  if (!db) return () => {};
  const q = query(
    collection(db, 'posts', postId, 'comments'),
    orderBy('createdAt', 'asc'),
    limit(50)
  );
  return onSnapshot(q, snap => {
    onData(
      snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          authorId: data.authorId,
          author: {
            id: data.authorId,
            displayName: data.authorName ?? '',
            handle: data.authorHandle ?? '',
            bio: '', avatarUrl: data.authorAvatar ?? '', coverUrl: '',
            interests: [], followers: 0, following: 0,
            postCount: 0, badges: [], joinedAt: new Date(),
          },
          text: data.text ?? '',
          likes: data.likes ?? 0,
          replyCount: data.replyCount ?? 0,
          createdAt: ts(data.createdAt),
        } satisfies RawComment;
      })
    );
  }, err => console.error('[subscribeComments]', err.code, err.message));
}

export async function addComment(
  postId: string,
  author: User,
  text: string,
  postAuthorId?: string
): Promise<string> {
  if (!db) throw new Error('Firestore not available');
  const ref = await addDoc(collection(db, 'posts', postId, 'comments'), {
    authorId: author.id,
    authorName: author.displayName,
    authorHandle: author.handle,
    authorAvatar: author.avatarUrl ?? '',
    text,
    likes: 0,
    replyCount: 0,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'posts', postId), { comments: increment(1) });
  // Notify the post's author (fire-and-forget, no-ops if actor === recipient)
  if (postAuthorId) {
    writeNotification(postAuthorId, 'comment', author, {
      postId,
      commentId: ref.id,
      message: `${author.displayName} commented: "${text.slice(0, 60)}"`,
      targetPreview: text.slice(0, 80),
    }).catch(console.error);
  }
  return ref.id;
}

export async function toggleCommentLike(
  postId: string,
  commentId: string,
  userId: string,
  currentlyLiked: boolean
): Promise<void> {
  if (!db) return;
  const commentRef = doc(db, 'posts', postId, 'comments', commentId);
  const likeRef    = doc(db, 'users', userId, 'liked_comments', commentId);
  if (currentlyLiked) {
    await Promise.all([updateDoc(commentRef, { likes: increment(-1) }), deleteDoc(likeRef)]);
  } else {
    await Promise.all([updateDoc(commentRef, { likes: increment(1) }), setDoc(likeRef, { likedAt: serverTimestamp() })]);
  }
}

export async function addReply(
  postId: string,
  commentId: string,
  author: User,
  text: string
): Promise<string> {
  if (!db) throw new Error('Firestore not available');
  const ref = await addDoc(
    collection(db, 'posts', postId, 'comments', commentId, 'replies'),
    {
      authorId: author.id,
      authorName: author.displayName,
      authorHandle: author.handle,
      authorAvatar: author.avatarUrl ?? '',
      text,
      likes: 0,
      createdAt: serverTimestamp(),
    }
  );
  await updateDoc(doc(db, 'posts', postId, 'comments', commentId), { replyCount: increment(1) });
  return ref.id;
}

// ─── Notifications (write) ────────────────────────────────────────────────────

/**
 * Write a notification to `userId` (the recipient).
 * Silently no-ops when actor === recipient so users don't notify themselves.
 */
export async function writeNotification(
  userId: string,
  type: NotificationType,
  actor: User,
  opts: {
    postId?: string;
    commentId?: string;
    storyId?: string;
    convId?: string;
    communityId?: string;
    emoji?: string;
    targetPreview?: string;
    message: string;
  }
): Promise<void> {
  if (!db || userId === actor.id) return;
  await addDoc(collection(db, 'notifications'), {
    userId,
    type,
    actorId: actor.id,
    actorName: actor.displayName,
    actorHandle: actor.handle,
    actorAvatar: actor.avatarUrl ?? null,
    postId: opts.postId ?? null,
    commentId: opts.commentId ?? null,
    storyId: opts.storyId ?? null,
    convId: opts.convId ?? null,
    communityId: opts.communityId ?? null,
    emoji: opts.emoji ?? null,
    targetPreview: opts.targetPreview ?? null,
    message: opts.message,
    read: false,
    createdAt: serverTimestamp(),
  });
}

// ─── Seed initial communities ─────────────────────────────────────────────────
// Runs once when Firebase is first configured; no-ops if data already exists.

export async function seedCommunitiesIfNeeded(): Promise<void> {
  if (!db) return;
  try {
    const snap = await getDocs(query(collection(db, 'communities'), limit(1)));
    if (!snap.empty) return;
    const { mockCommunities } = await import('./mockData');
    await Promise.all(
      mockCommunities.map(c =>
        setDoc(doc(db!, 'communities', c.id), {
          name: c.name,
          description: c.description,
          bannerUrl: c.bannerUrl,
          emoji: c.emoji,
          memberCount: c.memberCount,
          postCount: c.postCount,
          onlineCount: c.onlineCount,
          category: c.category,
          rules: c.rules,
          moderatorIds: [],
          isPrivate: c.isPrivate,
          createdAt: serverTimestamp(),
        })
      )
    );
  } catch {
    // Silently skip seed errors (e.g. permission denied in strict-rules mode)
  }
}
