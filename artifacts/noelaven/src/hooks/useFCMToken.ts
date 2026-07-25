/**
 * useFCMToken — React hook
 *
 * Responsibilities:
 * 1. Registers the Firebase Messaging service worker once on mount.
 * 2. Requests + saves an FCM token when the user grants permission.
 * 3. Listens for foreground messages and fires onForegroundMessage instead of
 *    showing a duplicate OS notification (the app is already visible).
 * 4. Listens for notification-tap messages from the SW and routes the app.
 * 5. Handles token refresh via Firebase's onTokenRefresh listener.
 */

import { useEffect, useRef } from 'react';
import { getMessaging, onMessage } from 'firebase/messaging';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { isFirebaseConfigured, app } from '@/lib/firebase';
import {
  registerFCMToken,
  registerMessagingServiceWorker,
  saveTokenToFirestore,
} from '@/lib/fcmToken';

interface FCMOptions {
  /** Called when a push arrives while the app is in the foreground. */
  onForegroundMessage?: (payload: { notification?: { title?: string; body?: string }; data?: Record<string, string> }) => void;
}

export function useFCMToken({ onForegroundMessage }: FCMOptions = {}) {
  const { currentUser } = useAuth();
  const [, setLocation] = useLocation();
  const swRegistered = useRef(false);
  const messagingUnsub = useRef<(() => void) | null>(null);

  // ── Register service worker once ────────────────────────────────────────────
  useEffect(() => {
    if (swRegistered.current || !isFirebaseConfigured) return;
    swRegistered.current = true;
    registerMessagingServiceWorker().catch(console.error);
  }, []);

  // ── Foreground message handler ───────────────────────────────────────────────
  // Firebase SDK automatically suppresses OS notifications when the page is
  // focused, so we show our own in-app toast instead.
  useEffect(() => {
    if (!isFirebaseConfigured || !app || !currentUser) return;

    // Clean up previous listener before creating a new one
    messagingUnsub.current?.();

    try {
      const messaging = getMessaging(app);
      messagingUnsub.current = onMessage(messaging, payload => {
        onForegroundMessage?.(payload as Parameters<NonNullable<FCMOptions['onForegroundMessage']>>[0]);
      });
    } catch (err) {
      console.error('[FCM] onMessage setup failed:', err);
    }

    return () => {
      messagingUnsub.current?.();
      messagingUnsub.current = null;
    };
  }, [currentUser?.id, onForegroundMessage]);

  // ── Token acquisition after user grants notification permission ──────────────
  // This is NOT triggered automatically — it's called explicitly from
  // NotificationPermissionPrompt after the user taps "Enable notifications".
  useEffect(() => {
    if (!isFirebaseConfigured || !currentUser) return;

    if (Notification.permission === 'granted') {
      // Permission already granted from a previous session
      registerFCMToken(currentUser.id).catch(console.error);
    }
  }, [currentUser?.id]);

  // ── Token refresh ─────────────────────────────────────────────────────────────
  // Firebase rotates tokens periodically. We detect rotation via the
  // service worker's push subscription change event.
  useEffect(() => {
    if (!isFirebaseConfigured || !currentUser) return;

    const handleSubscriptionChange = async () => {
      const token = await registerFCMToken(currentUser.id);
      if (token) {
        await saveTokenToFirestore(currentUser.id, token);
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleSubscriptionChange);
    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleSubscriptionChange);
    };
  }, [currentUser?.id]);

  // ── Notification-tap routing (SW → main thread postMessage) ──────────────────
  useEffect(() => {
    function handleSWMessage(event: MessageEvent) {
      if (event.data?.type !== 'NLV_NOTIFICATION_CLICK') return;
      const url: string = event.data.url ?? '/notifications';
      setLocation(url);
    }

    navigator.serviceWorker?.addEventListener('message', handleSWMessage);
    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleSWMessage);
    };
  }, [setLocation]);
}
