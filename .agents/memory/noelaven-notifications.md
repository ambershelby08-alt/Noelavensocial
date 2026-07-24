---
name: Noelaven Notifications System
description: Complete real-time notifications — types, grouping, badge, prefs, sign-out confirm, triggers.
---

## Architecture

### Data layer
- `src/lib/mockData.ts` — `NotificationType` union + extended `Notification` interface (commentId, storyId, convId, emoji, targetPreview) + `NotificationPrefs` interface.
- `src/lib/notifications.ts` — High-level write helpers: `notifyFollow`, `notifyReaction`, `notifyComment`, `notifyReply`, `notifyMention`, `notifyMessage`, `notifyStoryReaction`, `notifyStoryReply`, `notifySparkReaction`, `notifyCommentLike`. Works in both Firebase and demo (localStorage `nlv_demo_notifications`) modes. Also exports `demoGetUserNotifs`, `demoMarkRead`, `demoMarkAllRead`, `demoClearNotif`.
- `src/lib/firestore.ts` — Extended `writeNotification` to new types + fields. Added `deleteNotification` and `subscribeUnreadNotificationCount`.

### Hook — `src/hooks/useNotifications.ts`
- Exports `GroupedNotification` type (id, ids[], actor, extraActors[], groupCount, …).
- Client-side grouping by `groupKey()`: reactions/likes on same post → one group; follows → one batch; story reactions by storyId; like_comment by commentId. Comments/replies/messages/mentions NOT grouped.
- Grouped message text: "Alice, Bob and 3 others reacted to your post".
- Pagination: 25 per page, `hasMore` + `loadMore()`.
- Prefs filtering: reads `nlv_notif_prefs` key, maps `NotificationType` to pref boolean with legacy key fallback.
- Actions: `markAllRead`, `markOneRead`, `markGroupRead(ids[])`, `deleteNotif(ids[])`.
- Exports `loadNotifPrefs` and `NOTIF_PREFS_KEY` for Settings.tsx to share the same key.

### UI
- `src/pages/Notifications.tsx` — Complete rewrite. Filters: All/Reactions/Comments/Follows/Messages/Mentions. `AvatarStack` shows stacked avatars + overflow count for grouped items. Per-filter empty states. Load more button. Tap → markGroupRead + navigate. Hover → delete button (Trash icon).
- `src/components/layout/AppShell.tsx` — `MobileHeader` now shows Bell icon with Link to /notifications + purple badge. `Sidebar` shows purple badge on Bell. `AppShell` subscribes to `subscribeUnreadNotificationCount` (Firebase) or counts from localStorage (demo).
- `src/pages/Settings.tsx` — Expanded 8-item notification prefs panel (reactions/comments/follows/messages/mentions/storyReplies/dailySpark/communityInvites). Sign-out now opens a bottom-sheet confirmation instead of immediately signing out.

### Notification triggers wired
- **Follow**: `Profile.tsx` handleFollow → `notifyFollow` on successful follow.
- **Reaction**: `Home.tsx` PostCard onReact → `writeNotification` (already wired via `fsWriteNotification` alias).
- **Comment/Reply/CommentLike**: `Home.tsx` comment overlay → `fsWriteNotification` (already wired from previous session).
- **Spark reactions**: `Home.tsx` CommunityReveal onReact also triggers — shares the same handler.
- **Message**: NOT yet wired in Chat.tsx (future task).
- **Story reaction/reply**: NOT yet wired (future task).
- **Mention detection**: NOT wired — would need @handle lookup (future task).

## Key decisions

**Grouping is client-side only** — Firestore stores one doc per notification. The hook groups them on read. This avoids Firestore transactions for group updates but means a group's "unread" status reflects the most recent member only until markGroupRead is called.

**Why:**
Firestore atomic group updates require knowing the groupKey at write time and running a transaction to update-or-create. Client-side grouping is simpler, avoids extra writes, and works identically in demo mode.

**Badge count**: Uses a separate `subscribeUnreadNotificationCount` onSnapshot query (read = false, userId = current). In demo mode, counts from localStorage + mockNotifications.

**Sign-out confirm**: Settings.tsx `handleSignOut` now opens a bottom-sheet (z-[75]), not a browser confirm(). The sheet calls `await signOut()` then navigates to `/login`. This preserves Firebase sign-out semantics (evicts conversation cache etc.).

**Prefs key**: `nlv_notif_prefs` in localStorage. Both `useNotifications.ts` and `Settings.tsx` use this same key — Settings writes it on toggle, hook reads it on mount + can refresh via `refreshPrefs()`.
