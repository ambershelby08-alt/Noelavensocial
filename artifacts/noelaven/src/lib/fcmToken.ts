/**
 * FCM Token Management — Noelaven
 *
 * Handles permission request, token generation, Firestore persistence,
 * token refresh, and invalid-token cleanup.
 *
 * Token schema (users/{uid}/devices/{deviceId}):
 *   token      — FCM registration token
 *   deviceId   — stable browser-local UUID
 *   platform   — 'web'
 *   enabled    — true | false (user can disable)
 *   createdAt  — server timestamp (first save)
 *   updatedAt  — server timestamp (refreshed on change)
 */

import { getMessaging, getToken, deleteToken } from 'firebase/messaging';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { app, db, isFirebaseConfigured } from './firebase';

// ─── Constants ────────────────────────────────────────────────────────────────

const DEVICE_ID_KEY   = 'nlv_device_id';
const TOKEN_CACHE_KEY = 'nlv_fcm_token';
const VAPID_KEY       = import.meta.env.VITE_FCM_VAPID_KEY as string | undefined;

// ─── Stable device ID ─────────────────────────────────────────────────────────

export function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = `web-${crypto.randomUUID()}`;
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

// ─── Register / refresh token ─────────────────────────────────────────────────

/**
 * Requests a fresh FCM token and saves it to Firestore.
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

    // Skip if unchanged since last save
    const cached = localStorage.getItem(TOKEN_CACHE_KEY);
    if (cached !== token) {
      await saveTokenToFirestore(uid, token);
      localStorage.setItem(TOKEN_CACHE_KEY, token);
    }
    return token;
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    // User denied permission — not an error we should log noisily
    if (code !== 'messaging/permission-blocked' && code !== 'messaging/permission-default') {
      console.error('[FCM] getToken failed:', err);
    }
    return null;
  }
}

// ─── Save / update token doc ──────────────────────────────────────────────────

export async function saveTokenToFirestore(uid: string, token: string): Promise<void> {
  if (!db) return;
  const deviceId = getDeviceId();
  await setDoc(
    doc(db, 'users', uid, 'devices', deviceId),
    {
      token,
      deviceId,
      platform:  'web',
      enabled:   true,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),   // merge:true means this won't overwrite on refresh
    },
    { merge: true }
  );
}

// ─── Disable / delete token ───────────────────────────────────────────────────

/** Call on sign-out to stop notifications for this device. */
export async function unregisterFCMToken(uid: string): Promise<void> {
  if (!app || !db) return;
  const deviceId = getDeviceId();
  try {
    const messaging = getMessaging(app);
    await deleteToken(messaging);
  } catch { /* ignore — token may already be expired */ }
  await deleteDoc(doc(db, 'users', uid, 'devices', deviceId)).catch(console.error);
  localStorage.removeItem(TOKEN_CACHE_KEY);
}

// ─── Service worker registration ──────────────────────────────────────────────

/** Register the SW and send Firebase config so the SW can initialise messaging. */
export async function registerMessagingServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;

  try {
    const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/',
    });

    // Send Firebase config to the SW so it can init the SDK
    // Works regardless of whether the SW is installing, waiting, or active
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

    // Also send on any future SW activation (e.g. after page refresh)
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
