---
name: Noelaven UserCacheContext
description: Real-time deduped avatar/profile cache; how avatars propagate live across the app.
---

## The Problem It Solves
Post/comment/story documents denormalize `author.avatarUrl` at write time. When a user changes their profile photo, every old post still showed the old photo.

## Architecture
- **`src/contexts/UserCacheContext.tsx`** — one Firestore `onSnapshot` per unique `userId`, ref-counted so N components sharing a userId share ONE listener.
- **`src/components/ui/UserAvatar.tsx`** — drop-in for `<GradientAvatar name src />` when the userId is known. Subscribes via the cache; only that component re-renders when its user's avatarUrl changes.
- **`<CurrentUserSeed />`** in `App.tsx` — seeds the current user into the cache from AuthContext so their own avatar is immediately available without a Firestore round-trip.

## Where UserAvatar Is Used (vs. GradientAvatar)
Use `UserAvatar` wherever you have a `userId` for someone other than currentUser, or for currentUser via userId:
- PostCard author, PostMenu author, CommentsDrawer comment authors (Home.tsx)
- Notification actors (Notifications.tsx)
- Conversation partners, active-users row, group members, new-conv search (Messages.tsx)
- Message sender, group header, read receipts, typing indicator (Chat.tsx)
- Story circles for other users (StoriesRow.tsx, StoryViewer.tsx)
- Followers/following list, SparkCard avatar (Profile.tsx)
- Search results, people cards (Discover.tsx)
- QuickComposer, ModCard, MemberCard (CommunityFeed.tsx)

Keep using `GradientAvatar` directly only for:
- `currentUser.avatarUrl` — already reactive via AuthContext (compose boxes, AppShell, StoriesRow own-story)
- Profile edit-state preview (local upload buffer)

## Demo Mode
In demo mode (`isFirebaseConfigured = false`), `subscribeToUser` resolves synchronously from `mockUsers` — no Firestore calls, no loading flash.

**Why:** Firestore's `onSnapshot` per-user is the only way to get sub-second propagation after a profile photo change. The ref-count ensures we don't create O(posts) listeners.
