/**
 * useFollowingIds — real-time set of UIDs that the current user follows.
 *
 * Used by CommunityReveal to filter the "Following" and "Mutuals" sort tabs.
 * Returns an empty Set immediately and updates whenever the following list
 * changes in Firestore.
 *
 * The following list is stored at:
 *   users/{userId}/following/{targetUserId}
 * (written by followUser() / unfollowUser() in firestore.ts)
 */
import { useState, useEffect } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/lib/firebase';

export function useFollowingIds(userId: string | undefined): Set<string> {
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId || !isFirebaseConfigured || !db) {
      setIds(new Set());
      return;
    }

    const ref = collection(db, 'users', userId, 'following');
    const unsub = onSnapshot(
      ref,
      (snap) => setIds(new Set(snap.docs.map(d => d.id))),
      (err) => {
        console.error('[useFollowingIds]', err.code, err.message);
        setIds(new Set());
      }
    );

    return unsub;
  }, [userId]);

  return ids;
}
