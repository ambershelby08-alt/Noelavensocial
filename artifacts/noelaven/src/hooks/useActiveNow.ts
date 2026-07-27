/**
 * useActiveNow — real-time list of online contacts for the current user.
 *
 * Contact sources (merged, de-duped, capped at 30):
 *   1. Users the current user is following  (users/{uid}/following subcollection)
 *   2. Direct-conversation partners  (conversations where type='direct')
 *
 * A contact is included only when their user document has isOnline=true.
 * Results are sorted by lastSeen descending (most-recently-active first).
 *
 * Demo mode: always returns [] — no fake active users.
 *
 * Security: we already have read access to users/{uid} for profile display.
 * No new Firestore rules are required.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db, isFirebaseConfigured } from '@/lib/firebase';
import { subscribeConversations, subscribeOnlineContacts, type OnlineUser } from '@/lib/firestore';

export type { OnlineUser };

export function useActiveNow(currentUserId: string | null | undefined): OnlineUser[] {
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);

  // Tracks the merged contact-ID set from both sources
  const followingRef  = useRef<Set<string>>(new Set());
  const convPartnersRef = useRef<Set<string>>(new Set());
  // Current unsubscribe for the online-contacts listener
  const onlineUnsubRef = useRef<(() => void) | null>(null);

  // Re-subscribe whenever the merged contact set changes
  const resubscribe = useCallback(() => {
    onlineUnsubRef.current?.();
    onlineUnsubRef.current = null;

    const merged = new Set([...followingRef.current, ...convPartnersRef.current]);
    // Remove self
    if (currentUserId) merged.delete(currentUserId);
    const ids = [...merged].slice(0, 30); // Firestore `in` cap

    if (ids.length === 0) {
      setOnlineUsers([]);
      return;
    }
    onlineUnsubRef.current = subscribeOnlineContacts(ids, setOnlineUsers);
  }, [currentUserId]);

  useEffect(() => {
    if (!currentUserId || !isFirebaseConfigured || !db) {
      setOnlineUsers([]);
      return;
    }

    // Source 1 — following list
    const followingCol = collection(db, 'users', currentUserId, 'following');
    const unsubFollowing = onSnapshot(
      followingCol,
      (snap) => {
        followingRef.current = new Set(snap.docs.map(d => d.id));
        resubscribe();
      },
      () => {
        followingRef.current = new Set();
        resubscribe();
      }
    );

    // Source 2 — conversation partners
    const unsubConvs = subscribeConversations(currentUserId, (convs) => {
      const partners = new Set<string>();
      for (const conv of convs) {
        if (conv.type !== 'direct') continue;
        for (const p of conv.participants) {
          if (p.id !== currentUserId) partners.add(p.id);
        }
      }
      convPartnersRef.current = partners;
      resubscribe();
    });

    return () => {
      unsubFollowing();
      unsubConvs();
      onlineUnsubRef.current?.();
      onlineUnsubRef.current = null;
      followingRef.current = new Set();
      convPartnersRef.current = new Set();
    };
  }, [currentUserId, resubscribe]);

  return onlineUsers;
}
