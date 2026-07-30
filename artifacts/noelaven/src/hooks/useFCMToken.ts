/**
 * useFCMToken — React hook
 *
 * Responsibilities:
 * 1. Detects whether we are running inside the Capacitor native Android app
 *    or in a browser, and uses the appropriate push registration path.
 *
 * Native (Android Capacitor):
 *   - Registers via @capacitor/push-notifications (FCM native)
 *   - Listens for notification taps via the Capacitor plugin
 *   - Token refresh is handled by re-registering on app resume
 *
 * Web (browser / hosted PWA):
 *   - Registers the Firebase Messaging service worker
 *   - Requests + saves an FCM web-push token
 *   - Listens for foreground messages and fires onForegroundMessage
 *   - Handles notification-tap postMessage from the SW for deep-link routing
 *   - Handles token refresh via service worker subscription change
 */

import { useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { useLocation } from 'wouter';
import { useAuth } from '@/contexts/AuthContext';
import { isFirebaseConfigured, app } from '@/lib/firebase';
import {
  registerFCMToken,
  registerMessagingServiceWorker,
  registerCapacitorPushToken,
  saveTokenToFirestore,
} from '@/lib/fcmToken';

interface FCMOptions {
  /** Called when a push arrives while the app is in the foreground. */
  onForegroundMessage?: (payload: {
    notification?: { title?: string; body?: string };
    data?: Record<string, string>;
  }) => void;
}

export function useFCMToken({ onForegroundMessage }: FCMOptions = {}) {
  const { currentUser } = useAuth();
  const [, setLocation] = useLocation();
  const swRegistered   = useRef(false);
  const nativeInited   = useRef(false);

  const isNative = Capacitor.isNativePlatform();

  // ══════════════════════════════════════════════════════════════════════════
  // NATIVE PATH (Android Capacitor)
  // ══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!isNative || !currentUser || !isFirebaseConfigured) return;
    if (nativeInited.current) return;
    nativeInited.current = true;

    let cleanupFns: Array<() => void> = [];

    async function initNative() {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');

        // 1. Register token (requests permission if needed)
        await registerCapacitorPushToken(currentUser!.id);

        // 2. Token refresh — FCM may rotate the token; re-register to keep Firestore fresh
        const refreshHandle = await PushNotifications.addListener('registration', async (t) => {
          if (currentUser) {
            await saveTokenToFirestore(currentUser.id, t.value, 'android');
            localStorage.setItem(`nlv_fcm_token_android_${currentUser.id}`, t.value);
          }
        });
        cleanupFns.push(() => refreshHandle.remove());

        // 3. Foreground push notification received
        //    On Android, FCM delivers a heads-up notification automatically when the
        //    app is backgrounded. When foregrounded, we fire onForegroundMessage instead.
        const fgHandle = await PushNotifications.addListener(
          'pushNotificationReceived',
          (notification) => {
            onForegroundMessage?.({
              notification: {
                title: notification.title,
                body:  notification.body,
              },
              data: notification.data as Record<string, string> | undefined,
            });
          },
        );
        cleanupFns.push(() => fgHandle.remove());

        // 4. Notification tap — user tapped a push while the app was closed/backgrounded
        const tapHandle = await PushNotifications.addListener(
          'pushNotificationActionPerformed',
          (action) => {
            const data = action.notification.data as Record<string, string> | undefined;
            // Deep-link routing: mirrors the service worker click handler on web
            const url = deepLinkFromData(data);
            if (url) setLocation(url);
          },
        );
        cleanupFns.push(() => tapHandle.remove());

      } catch (err) {
        console.error('[FCM-native] initNative failed:', err);
      }
    }

    initNative();

    return () => {
      cleanupFns.forEach(fn => fn());
      cleanupFns = [];
      nativeInited.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, isNative]);

  // ══════════════════════════════════════════════════════════════════════════
  // WEB PATH (browser / hosted PWA)
  // ══════════════════════════════════════════════════════════════════════════

  // ── Register service worker once ─────────────────────────────────────────
  useEffect(() => {
    if (isNative || swRegistered.current || !isFirebaseConfigured) return;
    swRegistered.current = true;
    registerMessagingServiceWorker().catch(console.error);
  }, [isNative]);

  // ── Foreground message handler ────────────────────────────────────────────
  useEffect(() => {
    if (isNative || !isFirebaseConfigured || !app || !currentUser) return;

    let unsub: (() => void) | null = null;

    import('firebase/messaging').then(({ getMessaging, onMessage }) => {
      try {
        const messaging = getMessaging(app!);
        unsub = onMessage(messaging, payload => {
          onForegroundMessage?.(
            payload as Parameters<NonNullable<FCMOptions['onForegroundMessage']>>[0],
          );
        });
      } catch (err) {
        console.error('[FCM] onMessage setup failed:', err);
      }
    });

    return () => { unsub?.(); };
  }, [currentUser?.id, onForegroundMessage, isNative]);

  // ── Token acquisition after permission is granted ─────────────────────────
  useEffect(() => {
    if (isNative || !isFirebaseConfigured || !currentUser) return;
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      registerFCMToken(currentUser.id).catch(console.error);
    }
  }, [currentUser?.id, isNative]);

  // ── Token refresh (web) ───────────────────────────────────────────────────
  useEffect(() => {
    if (isNative || !isFirebaseConfigured || !currentUser) return;

    const handleSubscriptionChange = async () => {
      const token = await registerFCMToken(currentUser.id);
      if (token) await saveTokenToFirestore(currentUser.id, token, 'web');
    };

    navigator.serviceWorker?.addEventListener('message', handleSubscriptionChange);
    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleSubscriptionChange);
    };
  }, [currentUser?.id, isNative]);

  // ── Notification-tap routing (SW → main thread postMessage) ──────────────
  useEffect(() => {
    if (isNative) return;

    function handleSWMessage(event: MessageEvent) {
      if (event.data?.type !== 'NLV_NOTIFICATION_CLICK') return;
      const url: string = event.data.url ?? '/notifications';
      setLocation(url);
    }

    navigator.serviceWorker?.addEventListener('message', handleSWMessage);
    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleSWMessage);
    };
  }, [setLocation, isNative]);
}

// ─── Deep-link helper ─────────────────────────────────────────────────────────

/**
 * Mirrors the logic in api-server/src/services/fcm.ts buildDeepLink().
 * Converts FCM data payload → in-app route.
 */
function deepLinkFromData(data?: Record<string, string>): string | null {
  if (!data) return null;
  const type = data['type'] ?? '';

  if (type === 'message'     && data['convId'])  return `/messages/${data['convId']}`;
  if (type === 'follow'      && data['actorId']) return `/profile/${data['actorId']}`;
  if (type === 'mention'     && data['postId'])  return `/post/${data['postId']}`;
  if ((type === 'comment' || type === 'reply') && data['postId'])
    return `/post/${data['postId']}`;
  if ((type === 'reaction' || type === 'like') && data['postId'])
    return `/post/${data['postId']}`;
  if (type === 'story_reply' && data['storyId']) return `/story/${data['storyId']}`;
  if (type === 'daily_spark')                    return `/?spark=1`;
  if (type === 'moderation_warning')             return `/notifications`;
  if (type === 'missed_call')                    return `/notifications`;
  return '/notifications';
}
