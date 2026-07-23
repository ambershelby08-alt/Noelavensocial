/**
 * UserCacheContext — real-time, deduped user profile cache.
 *
 * Architecture:
 *  • One Firestore `onSnapshot` per unique userId (ref-counted so 20 PostCards
 *    with the same author share exactly ONE listener).
 *  • Each `UserAvatar` component calls `useUserProfile(userId)` which registers
 *    itself as a subscriber.  When Firestore pushes a new avatarUrl the hook
 *    updates its local state — only the affected avatars re-render.
 *  • Demo mode (isFirebaseConfigured = false): resolves instantly from
 *    mockUsers with no network calls.
 */

import React, {
  createContext, useCallback, useContext, useEffect,
  useMemo, useRef, useState,
} from 'react';
import { onSnapshot, doc } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { mockUsers } from '@/lib/mockData';
import { useAuth } from '@/contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CachedUser {
  avatarUrl:   string;
  displayName: string;
  handle:      string;
}

type Subscriber = (user: CachedUser) => void;

interface UserCacheContextType {
  /** Subscribe to live updates for userId. Returns a cleanup function. */
  subscribeToUser: (userId: string, onData: Subscriber) => () => void;
  /** Seed the cache from an already-known User object (e.g. currentUser). */
  seedUser: (userId: string, user: CachedUser) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const UserCacheContext = createContext<UserCacheContextType>({
  subscribeToUser: () => () => {},
  seedUser:        () => {},
});

// ─── Provider ─────────────────────────────────────────────────────────────────

export function UserCacheProvider({ children }: { children: React.ReactNode }) {
  // These are all refs so mutations never cause the provider to re-render.
  const cacheRef      = useRef(new Map<string, CachedUser>());
  const subsRef       = useRef(new Map<string, Set<Subscriber>>());
  const listenerCount = useRef(new Map<string, number>());
  const unsubsRef     = useRef(new Map<string, () => void>());

  /** Push a user update into the cache and notify all subscribers. */
  const publish = useCallback((userId: string, user: CachedUser) => {
    cacheRef.current.set(userId, user);
    subsRef.current.get(userId)?.forEach(cb => cb(user));
  }, []);

  /** Seed from a known value (e.g. from AuthContext). */
  const seedUser = useCallback((userId: string, user: CachedUser) => {
    publish(userId, user);
  }, [publish]);

  /** Start a Firestore listener for userId (demo mode: resolve from mockUsers). */
  const startListener = useCallback((userId: string) => {
    if (!isFirebaseConfigured) {
      const mock = mockUsers.find(u => u.id === userId);
      if (mock) {
        publish(userId, {
          avatarUrl:   mock.avatarUrl,
          displayName: mock.displayName,
          handle:      mock.handle,
        });
      }
      return;
    }
    if (!db) return;
    const unsub = onSnapshot(
      doc(db, 'users', userId),
      snap => {
        if (!snap.exists()) return;
        const d = snap.data();
        publish(userId, {
          avatarUrl:   d.avatarUrl   ?? '',
          displayName: d.displayName ?? '',
          handle:      d.handle      ?? '',
        });
      },
      err => console.warn(`[UserCache] listener error for ${userId}:`, err)
    );
    unsubsRef.current.set(userId, unsub);
  }, [publish]);

  const subscribeToUser = useCallback((userId: string, onData: Subscriber): () => void => {
    if (!userId) return () => {};

    // Register subscriber
    if (!subsRef.current.has(userId)) subsRef.current.set(userId, new Set());
    subsRef.current.get(userId)!.add(onData);

    // Immediately notify with cached value (prevents flash on re-mount)
    const cached = cacheRef.current.get(userId);
    if (cached) onData(cached);

    // Start Firestore listener on the first subscriber for this userId
    const count = listenerCount.current.get(userId) ?? 0;
    listenerCount.current.set(userId, count + 1);
    if (count === 0) startListener(userId);

    return () => {
      subsRef.current.get(userId)?.delete(onData);
      const n = listenerCount.current.get(userId) ?? 1;
      if (n <= 1) {
        listenerCount.current.delete(userId);
        unsubsRef.current.get(userId)?.();
        unsubsRef.current.delete(userId);
      } else {
        listenerCount.current.set(userId, n - 1);
      }
    };
  }, [startListener]);

  const value = useMemo(
    () => ({ subscribeToUser, seedUser }),
    [subscribeToUser, seedUser]
  );

  return (
    <UserCacheContext.Provider value={value}>
      {children}
    </UserCacheContext.Provider>
  );
}

// ─── CurrentUserSeed ──────────────────────────────────────────────────────────
// Renders null; keeps the cache warm for the logged-in user so their avatar
// is available immediately without a separate Firestore round-trip.

export function CurrentUserSeed() {
  const { currentUser } = useAuth();
  const { seedUser } = useContext(UserCacheContext);

  useEffect(() => {
    if (!currentUser) return;
    seedUser(currentUser.id, {
      avatarUrl:   currentUser.avatarUrl   ?? '',
      displayName: currentUser.displayName ?? '',
      handle:      currentUser.handle      ?? '',
    });
  // Re-seed whenever the avatar, name, or handle changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentUser?.id,
    currentUser?.avatarUrl,
    currentUser?.displayName,
    currentUser?.handle,
  ]);

  return null;
}

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useUserCache() {
  return useContext(UserCacheContext);
}

/**
 * Subscribe to live profile data for a single userId.
 * Automatically cleans up the Firestore listener when the component unmounts.
 */
export function useUserProfile(userId: string): CachedUser | null {
  const [user, setUser] = useState<CachedUser | null>(null);
  const { subscribeToUser } = useContext(UserCacheContext);

  useEffect(() => {
    if (!userId) return;
    const cleanup = subscribeToUser(userId, setUser);
    return cleanup;
  }, [userId, subscribeToUser]);

  return user;
}
