---
name: Noelaven push notification bugs
description: Root causes and fixes for push notifications not arriving
---

## Root causes found (all fixed)

### 1. Token cache key was not UID-scoped (CRITICAL)
`TOKEN_CACHE_KEY = 'nlv_fcm_token'` was shared across all accounts on the same device.
When a multi-account user added a second account, `registerFCMToken(newUid)` compared
the token against the old cached value, found it unchanged, and **skipped the Firestore
`setDoc`**. The new account's `users/{newUid}/devices/{deviceId}` doc was never written.
**Fix:** Cache key is now `nlv_fcm_token_${uid}` (via `tokenCacheKey(uid)` helper).

### 2. `sendPushNotification` had silent early returns (CRITICAL for diagnosis)
The function returned silently (no log) when there were no device tokens or when prefs
blocked the send. This made it impossible to know why pushes weren't arriving.
API server logs showed HTTP 200 but no `[FCM] send result` — this is the tell.
**Fix:** Added `logger.info` on every early-return path.

### 3. `typeToPrefKey` mismatch between client and server
Client (`notifTypeToPrefKey` in firestore.ts) stored prefs as:
- `like` → `'likes'`, `follow` → `'followers'`, `reply` → `'replies'`

Server (`typeToPrefKey` in fcm.ts) was checking different keys:
- `like` → `'reactions'`, `follow` → `'follows'`, `reply` → `'comments'`

**Fix:** Server keys updated to exactly match client keys.

### 4. No way to re-enable push after dismissing the prompt
`DISMISSED_KEY = 'nlv_notif_prompt_dismissed'` was set permanently in localStorage
after "Maybe later". Users could never get the prompt again.
**Fix:** Settings → Notifications section now shows a banner with an "Enable" button
when `Notification.permission !== 'granted'`. It also clears `DISMISSED_KEY` and
calls `registerMessagingServiceWorker()` + `registerFCMToken()`.

## Diagnostic pattern
API server logs HTTP 200 for `/api/push/send` but no `[FCM] send result` line
→ `sendPushNotification` is exiting early (no tokens or pref-blocked).
Check `users/{uid}/devices` subcollection in Firebase console for token docs.
