---
name: Noelaven GIF + Poll features
description: GIF search (Giphy), Poll creation/voting, and @mention search scalability fix.
---

## GIF Search
- Powered by Giphy REST API. Key: `VITE_GIPHY_API_KEY` env secret (needs to be added by user).
- `isGiphyConfigured` check in PostComposer.tsx — picker shows a "not configured" message if key absent.
- Trending GIFs shown on open; debounced search on type; uses `fixed_height_small` webp for thumbnails, `downsized` URL for storage.
- GIFs and images are mutually exclusive (picking one clears the other).
- `gifUrl` field on `Post` type in mockData.ts; persisted in Firestore via `createPost`; `docToPost` maps it.
- `PostCard` renders gifUrl with a "GIF" badge overlay; opens in PhotoViewer on tap.

## Polls
- `PollData` interface: `{ question: string; options: string[]; votes: Record<string, number> }`.
  - `votes` map: uid → chosen optionIndex (0-based). One vote per user; last write wins.
- `castVote(postId, optionIndex, userId)` in firestore.ts: simple `updateDoc` with dot-notation key `poll.votes.${userId}`.
- `castVote` also exposed via `useFeed` hook with optimistic update + revert on error.
- Poll builder in PostComposer: question input + 2–4 option inputs; toggled by BarChart2 button.
- `PostCard` renders poll with animated vote bars, pct labels, chosen-option checkmark; tapping an option calls `onVote` (disabled after voting).
- `onVote` and `currentUserId` props added to `PostCard` (both optional for backward compat).
- Only the main feed PostCard passes `onVote`; CommunityReveal PostCards do not (spark posts rarely have polls).

## @mention search fix (Task #70)
- `searchUsers` in firestore.ts replaced from "fetch 50, filter client-side" to server-side prefix range:
  `where('handle', '>=', lower) + where('handle', '<=', lower + '\uf8ff') + orderBy('handle') + limit(6)`.
- Uses auto-created single-field index on `handle` — no composite index deployment needed.
- Empty query returns first 6 users alphabetically (for showing suggestions when @ is typed with no text).

**Why:** Client-side scan of 50 users breaks on large accounts; Giphy GIF was user-requested; poll enables richer post types.
