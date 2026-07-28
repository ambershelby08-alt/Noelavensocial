/**
 * useUserPresence — real-time online status for a single user.
 *
 * Subscribes to users/{uid} and returns whether that user is currently online,
 * with a TTL-aware check (isOnline=true AND lastSeen < 3 min ago).
 * Used by Chat.tsx to drive the header green dot and "Active now" subtitle.
 *
 * Returns { isOnline: false, lastSeen: null } in demo mode or when uid is falsy.
 */

import { useState, useEffect } from 'react';
import { subscribeUserPresence } from '@/lib/firestore';
import { isFirebaseConfigured } from '@/lib/firebase';

export interface UserPresence {
  isOnline: boolean;
  lastSeen: Date | null;
}

export function useUserPresence(uid: string | null | undefined): UserPresence {
  const [presence, setPresence] = useState<UserPresence>({ isOnline: false, lastSeen: null });

  useEffect(() => {
    if (!uid || !isFirebaseConfigured) {
      setPresence({ isOnline: false, lastSeen: null });
      return;
    }
    const unsub = subscribeUserPresence(uid, (isOnline, lastSeen) => {
      setPresence({ isOnline, lastSeen });
    });
    return unsub;
  }, [uid]);

  return presence;
}
