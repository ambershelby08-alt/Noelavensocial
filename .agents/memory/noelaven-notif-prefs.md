---
name: Noelaven notification prefs architecture
description: How notification preferences are stored and enforced server-side
---

## Rule
Notification preferences are stored in two places:
1. `localStorage` (key `nlv_notif_prefs`) — used for client-side display filtering in `useNotifications.ts`
2. Firestore `users/{uid}.notificationPrefs` — used by `writeNotification` in `firestore.ts` to gate writes

**Why:** localStorage is device-local; the backend (writeNotification) needs Firestore to know the recipient's prefs so push notifications are also suppressed.

## How to apply
- `Settings.tsx` `handleNotifToggle` saves to both localStorage and Firestore via `saveUserNotifPrefs`
- `writeNotification` calls `getDoc` on the recipient user doc, checks `notificationPrefs[prefKey]`; if `=== false`, returns early (no write, no push)
- The mapping from `NotificationType` to pref key is in `notifTypeToPrefKey()` in `firestore.ts`
- `moderation_warning` is always delivered (not in the map)
- New type `story_view` maps to pref key `storyViews`
