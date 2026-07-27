/**
 * usePresence — writes the current user's online status to Firestore.
 *
 * Call once per authenticated session (mounted inside AppShell so it only
 * runs when a user is signed in).
 *
 * Lifecycle:
 *   - mount:              isOnline = true
 *   - visibilitychange → hidden:   isOnline = false
 *   - visibilitychange → visible:  isOnline = true
 *   - beforeunload:       isOnline = false  (best-effort)
 *   - unmount (sign-out / account switch):  isOnline = false
 *
 * Presence is stored on the user document:
 *   users/{uid} { isOnline: boolean, lastSeen: Timestamp }
 *
 * Demo mode: no-ops immediately.
 */

import { useEffect } from 'react';
import { updatePresence } from '@/lib/firestore';
import { isFirebaseConfigured } from '@/lib/firebase';

export function usePresence(uid: string | null | undefined): void {
  useEffect(() => {
    if (!uid || !isFirebaseConfigured) return;

    // Mark online immediately
    updatePresence(uid, true).catch(() => {});

    function onVisibility() {
      if (document.visibilityState === 'hidden') {
        updatePresence(uid!, false).catch(() => {});
      } else {
        updatePresence(uid!, true).catch(() => {});
      }
    }

    function onUnload() {
      // navigator.sendBeacon would be ideal here but updatePresence is async.
      // Best-effort: the lastSeen timestamp still shows when they were last active.
      updatePresence(uid!, false).catch(() => {});
    }

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', onUnload);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onUnload);
      // Mark offline on cleanup (sign-out or account switch).
      updatePresence(uid!, false).catch(() => {});
    };
  }, [uid]);
}
