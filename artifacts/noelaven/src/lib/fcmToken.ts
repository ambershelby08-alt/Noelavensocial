/**
 * FCM Token Management — Noelaven
 *
 * Two registration paths:
 *
 *   Web (browser / hosted PWA)
 *     Uses Firebase Web Messaging SDK + a service worker.
 *     Entry points: registerFCMToken(), registerMessagingServiceWorker()
 *
 *   Android native (Capacitor WebView)
 *     Uses @capacitor/push-notifications which talks directly to FCM.
 *     The web service worker is NOT active inside the Capacitor WebView,
 *     so background notifications require the native plugin.
 *     Entry point: registerCapacitorPushToken()
 *
 * Token schema  users/{uid}/devices/{deviceId}:
 *   token      — FCM registration token
 *   deviceId   — stable device-local UUID
 *   platform   — 'web' | 'android'
 *   enabled    — true | false (user can disable)
 *   createdAt  — server timestamp (first save)
 *   updatedAt  — server timestamp (refreshed on change)
 */

import { getMessaging, getToken, deleteToken } from 'firebase/messaging';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { app, db, isFirebaseConfigured } from './firebase';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEVICE_ID_KEY = 'nlv_device_id';
const VAPID_KEY     = import.meta.env.VITE_FCM_VAPID_KEY as string | undefined;

/** UID-scoped cache key — prevents multi-account token-skip bug */
function tokenCacheKey(uid: string) { return `nlv_fcm_token_${uid}`; }

// ─── Stable device ID ─────────────────────────────────────────────────────────

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `web-${crypto.randomUUID()}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

/** Device ID for the native Android path — kept separate from the web ID. */
function getAndroidDeviceId(): string {
  const key = 'nlv_android_device_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = `android-${crypto.randomUUID()}`;
    localStorage.setItem(key, id);
  }
  return id;
}

// ─── Save / update token doc ──────────────────────────────────────────────────

export async function saveTokenToFirestore(
  uid: string,
  token: string,
  platform: 'web' | 'android' = 'web',
): Promise<void> {
  if (!db) return;
  const deviceId = platform === 'android' ? getAndroidDeviceId() : getDeviceId();
  await setDoc(
    doc(db, 'users', uid, 'devices', deviceId),
    {
      token,
      deviceId,
      platform,
      enabled:   true,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(), // merge:true won't overwrite existing createdAt
    },
    { merge: true },
  );
}

// ─── Web: Register / refresh token ───────────────────────────────────────────

/**
 * Requests a fresh FCM token (web) and saves it to Firestore.
 * Returns the token on success, null if FCM is not available.
 */
export async function registerFCMToken(uid: string): Promise<string | null> {
  if (!isFirebaseConfigured || !app || !db) return null;
  if (!VAPID_KEY) {
    console.warn('[FCM] VITE_FCM_VAPID_KEY is not set — push notifications disabled');
    return null;
  }

  try {
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (!token) return null;

    // Skip save if unchanged since last save (cache is UID-scoped)
    const cached = localStorage.getItem(tokenCacheKey(uid));
    if (cached !== token) {
      await saveTokenToFirestore(uid, token, 'web');
      localStorage.setItem(tokenCacheKey(uid), token);
    }
    return token;
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code !== 'messaging/permission-blocked' && code !== 'messaging/permission-default') {
      console.error('[FCM] getToken failed:', err);
    }
    return null;
  }
}

// ─── Web: Disable / delete token ─────────────────────────────────────────────

/** Call on sign-out to stop web-push notifications for this device. */
export async function unregisterFCMToken(uid: string): Promise<void> {
  if (!app || !db) return;
  const deviceId = getDeviceId();
  try {
    const messaging = getMessaging(app);
    await deleteToken(messaging);
  } catch { /* token may already be expired */ }
  await deleteDoc(doc(db, 'users', uid, 'devices', deviceId)).catch(console.error);
  localStorage.removeItem(tokenCacheKey(uid));
}

// ─── Android native (Capacitor): Register token ───────────────────────────────

/**
 * Requests push-notification permission and registers an FCM token using
 * the @capacitor/push-notifications plugin.  This is the correct path for
 * the Capacitor Android WebView — the web service worker is inactive when
 * the native app is closed, so only the native plugin can deliver background
 * push notifications.
 *
 * Returns the FCM token string, or null if permission is denied / unavailable.
 */
export async function registerCapacitorPushToken(uid: string): Promise<string | null> {
  if (!isFirebaseConfigured || !db) return null;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    // 1. Request (or check existing) permission
    const permResult = await PushNotifications.requestPermissions();
    if (permResult.receive !== 'granted') {
      console.warn('[FCM-native] Push permission not granted:', permResult.receive);
      return null;
    }

    // 2. Register with FCM — triggers the 'registration' event asynchronously.
    //    We wrap it in a one-shot Promise so callers can await the token.
    const token = await new Promise<string | null>((resolve) => {
      let resolved = false;

      const safeResolve = (val: string | null) => {
        if (!resolved) {
          resolved = true;
          resolve(val);
        }
      };

      // Success
      PushNotifications.addListener('registration', (t) => {
        safeResolve(t.value);
      }).catch(() => safeResolve(null));

      // Failure
      PushNotifications.addListener('registrationError', (err) => {
        console.error('[FCM-native] Registration error:', err);
        safeResolve(null);
      }).catch(() => safeResolve(null));

      // Kick off the registration — the listeners above will fire
      PushNotifications.register().catch((err) => {
        console.error('[FCM-native] register() failed:', err);
        safeResolve(null);
      });

      // Timeout safety-net — never block the app indefinitely
      setTimeout(() => safeResolve(null), 10_000);
    });

    if (!token) return null;

    // 3. Persist — skip if unchanged to avoid unnecessary Firestore writes
    const cacheKey = `nlv_fcm_token_android_${uid}`;
    const cached   = localStorage.getItem(cacheKey);
    if (cached !== token) {
      await saveTokenToFirestore(uid, token, 'android');
      localStorage.setItem(cacheKey, token);
    }

    return token;
  } catch (err) {
    console.error('[FCM-native] registerCapacitorPushToken failed:', err);
    return null;
  }
}

// ─── Android native: Unregister on sign-out ───────────────────────────────────

/** Remove the native FCM token from Firestore on sign-out. */
export async function unregisterCapacitorPushToken(uid: string): Promise<void> {
  if (!db) return;
  const deviceId = getAndroidDeviceId();
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    // Removes all listeners but keeps the OS-level registration — correct for sign-out
    await PushNotifications.removeAllListeners();
  } catch { /* plugin unavailable on web */ }
  await deleteDoc(doc(db, 'users', uid, 'devices', deviceId)).catch(console.error);
  localStorage.removeItem(`nlv_fcm_token_android_${uid}`);
}

// ─── Web: Service worker registration ────────────────────────────────────────

/** Register the SW and send Firebase config so the SW can initialise messaging. */
export async function registerMessagingServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;

  try {
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/',
    });

    const sendConfig = (sw: ServiceWorker) => {
      sw.postMessage({
        type: 'FIREBASE_CONFIG',
        config: {
          apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
          authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
          projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
          storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
          appId:             import.meta.env.VITE_FIREBASE_APP_ID,
        },
      });
    };

    const target = reg.active ?? reg.installing ?? reg.waiting;
    if (target) {
      if (target.state === 'activated') {
        sendConfig(target);
      } else {
        target.addEventListener('statechange', e => {
          if ((e.target as ServiceWorker).state === 'activated') sendConfig(target);
        });
      }
    }

    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (navigator.serviceWorker.controller) {
        sendConfig(navigator.serviceWorker.controller);
      }
    });

    return reg;
  } catch (err) {
    console.error('[FCM] Service worker registration failed:', err);
    return null;
  }
}
