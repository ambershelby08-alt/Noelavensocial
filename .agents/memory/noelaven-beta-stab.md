---
name: Noelaven beta stabilization
description: Root causes and fixes for the 20-issue beta stabilization sprint
---

# Beta Stabilization — Key Decisions

**Why:** Multi-account real-world testing revealed 20 production bugs. All fixes are non-feature (bug-only).

## Reactions override (ReactionButton.tsx)
- **Root cause:** `handlePressEnd` fires on every pointer-up, including after tray selections, overriding the chosen emoji with the default Vibe 🌊.
- **Fix:** Added `trayWasOpenRef` — set true when tray opens, checked in `handlePressEnd` to skip the default-emoji call, reset after.

## Presence / Active Now
- **Root cause:** AppShell never called `usePresence`, so visibility-change and tab-close events never marked users offline.
- **Fix:** Added `usePresence(currentUser?.id)` call in `AppShell` component body. `updatePresence` calls in AuthContext (sign-in/sign-out/switchToAccount) were already wired from a prior session.

## Messaging privacy
- **Root cause:** `getComposeUsers` called `getAllUsers` which fetched every Firebase account.
- **Fix:** Replaced with following-list query (`users/{uid}/following`) + conversation participants. Never fetches all users.

## Notification avatar taps
- **Root cause:** `AvatarStack` in `NotifItem` had no profile link; tapping it triggered the notification's primary action.
- **Fix:** Wrapped `AvatarStack` in `<Link href={/profile/${actorId}}>` with `stopPropagation` on the container div.

## Report warning notifications
- **Root cause:** `sendWarning` wrote to `userWarnings` collection but never to `notifications`, so warned users saw no badge.
- **Fix:** After the `userWarnings` write, lazy-import `writeNotification` + `getUserDoc`, fetch moderator user, write `moderation_warning` notification.
- **Note:** `moderation_warning` added to `NotificationType` union in `mockData.ts`.

## Push deep links
- **Root cause:** `buildDeepLink` in both `fcm.ts` (api-server) and `firebase-messaging-sw.js` returned `/` for likes/comments/mentions.
- **Fix:** Both now return `/post/{postId}` for reaction/like/comment/reply/mention; `/story/{storyId}` for story_reply; `/?spark=1` for daily_spark; `/notifications` for moderation_warning.

## Daily Spark expiry guard
- **Root cause:** `recordSparkAnswer` in firestore.ts had no date check — users could answer yesterday's prompt.
- **Fix:** Added `if (dateKey !== todayKeyET()) throw new Error('spark_expired')` at the top of `recordSparkAnswer`.

## STUN dedup (calls)
- **Root cause:** `callSignaling.ts` defined its own `STUN_CONFIG` separately from `iceConfig.ts`'s `STUN_ONLY`.
- **Fix:** Exported `STUN_ONLY` from `iceConfig.ts`; `callSignaling.ts` re-exports it as `STUN_CONFIG`.

## Community Sparks tabs
- **Already correct** — `useSparkCommunity` returns public posts; `CommunityReveal` in Home.tsx filters by `useFollowingIds`/`useFollowerIds` at the component layer.

## Following counts
- **Already correct** — `followUser` and `unfollowUser` both use `increment(±1)` on both sides atomically.

## Profile navigation in Chat
- **Fix:** Chat.tsx header avatar wrapped in `<Link href={/profile/${other.id}}>` (direct chats only); title div gets `onClick` → `setLocation(/profile/${other.id})`.

## CommentsDrawer profile links
- **Fix:** Comment author avatar and display name in Home.tsx CommentsDrawer wrapped in `<Link href={/profile/${c.authorId}}>`.
