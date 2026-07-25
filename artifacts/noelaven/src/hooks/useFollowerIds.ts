/**
 * useFollowerIds — real-time set of UIDs that follow the current user.
 *
 * Mirrors useFollowingIds but reads the followers subcollection instead.
 * Combined with useFollowingIds, the intersection gives "mutuals" —
 * accounts that the user follows AND that follow the user back.
 *
 * The followers list is stored at:
 *   users/{userId}/followers/{followerUserId}
 * (written by followUser() / unfollowUser() in firestore.ts)
 */
import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/lib/firebase';

export function useFollowerIds(userId: string | undefined): Set<string> {
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId || !isFirebaseConfigured || !db) {
      setIds(new Set());
      return;
    }

    const ref = collection(db, 'users', userId, 'followers');
    const unsub = onSnapshot(
      ref,
      (snap) => setIds(new Set(snap.docs.map(d => d.id))),
      () => setIds(new Set()) // non-critical; fail silently
    );

    return unsub;
  }, [userId]);

  return ids;
}
