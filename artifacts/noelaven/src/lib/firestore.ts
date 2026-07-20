/**
 * Firestore service layer — all reads/writes to Firebase go through here.
 * Every exported function checks `db` is available before touching Firestore,
 * so callers never need to guard individually.
 */

import {
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc,
  deleteDoc, query, where, orderBy, limit, onSnapshot,
  serverTimestamp, increment, Timestamp,
  type DocumentData, type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type { User, Post, Community, Message, Conversation, Notification } from './mockData';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function ts(v: Timestamp | Date | undefined): Date {
  if (!v) return new Date();
  if (v instanceof Timestamp) return v.toDate();
  return v as Date;
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
  if (!db || !q) return [];
  const snap = await getDocs(
    query(collection(db, 'users'), orderBy('handle'), limit(20))
  );
  const lower = q.toLowerCase();
  return snap.docs
    .map(d => docToUser(d.id, d.data()))
    .filter(u =>
      u.handle.toLowerCase().includes(lower) ||
      u.displayName.toLowerCase().includes(lower)
    );
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
    communityId: d.communityId ?? undefined,
    sparkPrompt: d.sparkPrompt ?? undefined,
    likes: d.likes ?? 0,
    comments: d.comments ?? 0,
    shares: d.shares ?? 0,
    liked: false,
    saved: false,
    mood: d.mood ?? undefined,
    createdAt: ts(d.createdAt),
  };
}

export async function createPost(
  author: User,
  content: string,
  opts: { imageUrl?: string; communityId?: string; mood?: string; sparkPrompt?: string } = {}
): Promise<string> {
  if (!db) throw new Error('Firestore not available');
  const ref = await addDoc(collection(db, 'posts'), {
    authorId: author.id,
    authorName: author.displayName,
    authorHandle: author.handle,
    content,
    imageUrl: opts.imageUrl ?? null,
    communityId: opts.communityId ?? null,
    mood: opts.mood ?? null,
    sparkPrompt: opts.sparkPrompt ?? null,
    likes: 0,
    comments: 0,
    shares: 0,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'users', author.id), { postCount: increment(1) });
  return ref.id;
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
      const [likedSnap, savedSnap] = await Promise.all([
        getDocs(collection(db, 'users', currentUserId, 'liked_posts')),
        getDocs(collection(db, 'users', currentUserId, 'saved_posts')),
      ]);
      const likedIds = new Set(likedSnap.docs.map(d => d.id));
      const savedIds = new Set(savedSnap.docs.map(d => d.id));
      posts.forEach(p => {
        p.liked = likedIds.has(p.id);
        p.saved = savedIds.has(p.id);
      });
    }
    onData(posts);
  });
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
  });
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
  });
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
    lastMessageAt: ts(d.lastMessageAt),
    unreadCount: (d.unreadCounts ?? {})[currentUserId ?? ''] ?? 0,
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
  });
}

export function subscribeMessages(convId: string, onData: (msgs: Message[]) => void): Unsubscribe {
  if (!db) return () => {};
  const q = query(
    collection(db, 'conversations', convId, 'messages'),
    orderBy('createdAt', 'asc'),
    limit(100)
  );
  return onSnapshot(q, snap => {
    onData(
      snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          senderId: data.senderId,
          content: data.content ?? '',
          imageUrl: data.imageUrl ?? undefined,
          type: (data.type ?? 'text') as 'text' | 'image' | 'voice',
          reactions: data.reactions ?? {},
          readBy: data.readBy ?? [],
          createdAt: ts(data.createdAt),
        } satisfies Message;
      })
    );
  });
}

export async function sendMessage(
  convId: string,
  senderId: string,
  content: string,
  type: 'text' | 'image' | 'voice' = 'text'
): Promise<void> {
  if (!db) return;
  await addDoc(collection(db, 'conversations', convId, 'messages'), {
    senderId,
    content,
    type,
    reactions: {},
    readBy: [senderId],
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'conversations', convId), {
    lastMessage: content,
    lastMessageAt: serverTimestamp(),
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
  });
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

// ─── Notifications ────────────────────────────────────────────────────────────

function docToNotification(id: string, d: DocumentData): Notification {
  return {
    id,
    type: d.type,
    actorId: d.actorId,
    actor: {
      id: d.actorId,
      displayName: d.actorName ?? '',
      handle: d.actorHandle ?? '',
      bio: '', avatarUrl: '', coverUrl: '',
      interests: [], followers: 0, following: 0,
      postCount: 0, badges: [], joinedAt: new Date(),
    },
    postId: d.postId ?? undefined,
    communityId: d.communityId ?? undefined,
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
  return onSnapshot(q, snap => onData(snap.docs.map(d => docToNotification(d.id, d.data()))));
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
