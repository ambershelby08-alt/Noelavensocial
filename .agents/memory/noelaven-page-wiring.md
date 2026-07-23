---
name: Noelaven page wiring sweep
description: Production wiring of Discover, Profile, Notifications, CommunityFeed, and PostDetail to Firestore — stubs replaced and patterns used.
---

## Discover
- Live search calls `fsSearchUsers(query)` when Firebase is configured; falls back to mock filter.
- Horizontal user cards: `UserCard` component calls `fsFollow`/`fsUnfollow` with loading state.
- Slim `FollowButton` component added for search-result rows (avoids embedding full card format in a list row).
- Main Discover component reads `currentUser?.id` from `useAuth` and passes it through.

## Profile
- Follow/Unfollow button calls `fsFollow`/`fsUnfollow` with optimistic counter update and loading spinner.
- Message button calls `getOrCreateDirectConversation` (Firestore); navigates to `/messages/:convId`; falls back to mock for demo mode.
- Followers/following sheets load real user docs via `getUserDoc` on demand (dynamic Firestore import); fall back to mockUsers in demo mode.
- `UserListSheet` follow buttons now call `fsFollow`/`fsUnfollow` with loading state per row.
- `loadFollowLists()` is triggered lazily when either sheet opens (`listsLoaded` gate prevents re-fetch).

## Notifications
- Rewritten: filter chips (All/Likes/Comments/Follows), `matchesFilter` util, `linkForNotif` routes to correct page.
- Individual tap marks one notification read (`markOneRead` → `markNotificationRead` in Firestore).
- Auto-marks all read after 4 s delay so user sees unread state briefly.
- Daily spark "Respond" button navigates to `/?spark=1`.
- `Notification` type now includes optional `targetId` field.
- `markNotificationRead(notifId)` added to `firestore.ts` and `useNotifications.ts`.

## CommunityFeed
- `handleJoin` calls `toggleJoin(community.id)` from `useCommunities` hook with optimistic update + revert on error.
- `MemberCard` follow button calls `fsFollow`/`fsUnfollow` with loading state (was local-only before).

## PostDetail (`/post/:postId`) — NEW PAGE
- Route `/post/:postId` added to `AppRouter.tsx`.
- Fetches post from Firestore (dynamic import of `getDoc`) or mockPosts in demo mode.
- Uses `subscribeComments` for live comments; `addComment` to post; `toggleCommentLike` for comment likes.
- Sticky back-nav header; PostCard reused; compose bar fixed above tab bar.
- Solves broken notification deep-links (like/comment notifications previously 404'd).

## Key constraint
- `useEffect` returning `Unsubscribe | undefined` requires explicit `return undefined` on all branches — TypeScript TS7030 fires otherwise.
