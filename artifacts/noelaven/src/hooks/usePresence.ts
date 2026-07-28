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

    // Mark online immediately.
    updatePresence(uid, true).catch(() => {});

    // ── Heartbeat ────────────────────────────────────────────────────────────
    // Refresh lastSeen every 60 s while the tab is visible.
    // This keeps the TTL-aware reader (subscribeOnlineContacts / subscribeUserPresence)
    // satisfied: a user whose heartbeat is > 3 min stale is shown as offline
    // even if their isOnline flag was never explicitly cleared (e.g. browser crash).
    const heartbeat = setInterval(() => {
      if (document.visibilityState !== 'hidden') {
        updatePresence(uid, true).catch(() => {});
      }
    }, 60_000);

    function onVisibility() {
      if (document.visibilityState === 'hidden') {
        updatePresence(uid!, false).catch(() => {});
      } else {
        updatePresence(uid!, true).catch(() => {});
      }
    }

    function onUnload() {
      // Async write — best-effort on clean navigations.
      // For abrupt closes the TTL heartbeat is the safety net.
      updatePresence(uid!, false).catch(() => {});
    }

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeunload', onUnload);

    return () => {
      clearInterval(heartbeat);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeunload', onUnload);
      // Mark offline on cleanup (sign-out or account switch).
      updatePresence(uid!, false).catch(() => {});
    };
  }, [uid]);
}
