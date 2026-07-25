/**
 * Firebase Cloud Messaging Service Worker — Noelaven
 *
 * Handles background push notifications and notification-tap routing.
 * Firebase is initialised lazily when the main thread sends a FIREBASE_CONFIG
 * message (avoids hardcoding any project credentials in this file).
 */

importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging-compat.js');

let messaging = null;
let firebaseReady = false;

// ── Initialise Firebase once config arrives from the main thread ──────────────

function tryInit(config) {
  if (firebaseReady) return;
  try {
    if (!firebase.apps.length) {
      firebase.initializeApp(config);
    }
    messaging = firebase.messaging();
    firebaseReady = true;

    // Background message handler — app is closed or in another tab
    messaging.onBackgroundMessage(payload => {
      const notif  = payload.notification ?? {};
      const data   = payload.data ?? {};
      const title  = notif.title || 'Noelaven';
      const body   = notif.body  || '';

      self.registration.showNotification(title, {
        body,
        icon:    notif.icon || '/favicon.svg',
        badge:   '/favicon.svg',
        data,
        vibrate: [200, 100, 200],
        tag:     data.type || 'nlv',           // collapse same-type notifications
        renotify: false,
      });
    });
  } catch (err) {
    console.error('[NLV-SW] Firebase init failed:', err);
  }
}

// ── Receive config + other messages from main thread ─────────────────────────

self.addEventListener('message', event => {
  if (!event.data) return;

  if (event.data.type === 'FIREBASE_CONFIG') {
    tryInit(event.data.config);
  }
});

// ── Notification tap — route to correct screen ────────────────────────────────

self.addEventListener('notificationclick', event => {
  event.notification.close();

  const data = event.notification.data ?? {};
  const url  = buildDeepLink(data);

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(clients => {
        // If the app is already open, focus it and let React handle routing
        for (const client of clients) {
          if (client.url.startsWith(self.location.origin) && 'focus' in client) {
            client.postMessage({ type: 'NLV_NOTIFICATION_CLICK', data, url });
            return client.focus();
          }
        }
        // Otherwise open a new window at the deep-link URL
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      })
  );
});

// ── Deep-link builder ─────────────────────────────────────────────────────────

function buildDeepLink(data) {
  const { type, convId, postId, actorId, storyId } = data;

  if (type === 'message'  && convId)  return `/messages/${convId}`;
  if (type === 'follow'   && actorId) return `/profile/${actorId}`;
  if (type === 'mention'  && postId)  return `/`;
  if ((type === 'comment' || type === 'reply') && postId) return `/`;
  if ((type === 'reaction' || type === 'like') && postId) return `/`;
  if ((type === 'story_reply') && storyId) return `/`;
  return '/notifications';
}
