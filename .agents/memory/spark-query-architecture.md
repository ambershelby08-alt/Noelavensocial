---
name: Noelaven Spark community query
description: How the community spark feed is queried, filtered, and displayed; common pitfalls.
---

## Query strategy
`subscribeCommunitySparkPosts` uses `where('createdAt', '>=', etDayStart) + orderBy('createdAt', 'desc') + limit(n)`.
This uses the auto-created single-field index on `createdAt` — no composite index needed.
Do NOT filter by `sparkPrompt` text or `sparkDateKey` in the Firestore query itself:
- prompt-equality needs a composite index that may not be deployed
- `sparkDateKey` wasn't written to older posts

## sparkAudience null-drop bug (fixed)
Old posts and posts where `sparkAudience` wasn't written have `sparkAudience: null` in Firestore.
`docToPost` previously mapped null → `undefined`, then the hook filter excluded `undefined`.
**Fix**: `docToPost` now defaults spark posts (`sparkPrompt != null`) with null audience to `'public'`.
The hook filter was also changed to exclude only `'onlyMe'` (i.e. null/undefined are treated as public).

## fromCache empty-state flash (fixed)
Firestore's persistent cache fires a snapshot with 0 results before the network snapshot.
Previously the hook called `setLoading(false)` on the empty cache hit → empty state flashed in.
**Fix**: `subscribeCommunitySparkPosts` now passes `fromCache` to its callback.
The hook skips `setLoading(false)` when `fromCache=true && sparkPosts.length === 0`.

## State machine in CommunityReveal (Home.tsx)
Four mutually exclusive render states derived from one data source (`posts` from `useSparkCommunity`):
- `isLoadingState` = loading && total === 0
- `isEmptyState`   = !isLoadingState && total === 0
- `isWaitingState` = !isLoadingState && !isEmptyState && community.length === 0
  (user answered but no one else visible in current tab)
- populated = else branch

`total = community.length + (hasAnsweredToday ? 1 : 0)`
All three (empty-state gate, counter, list) derive from the same `posts` array — no separate queries.

## Tab filtering
- `everyone` → public only
- `following` → posts from followed authors that isVisible() allows
- `mutuals` → posts from mutual-follow authors that isVisible() allows
`isVisible()` applies audience gates on top of tab relationship checks.

## 'onlyMe' posts
Excluded from the community feed. Authors see their own response via the CommunityReveal banner
(`hasAnsweredToday` flag), not as a post card.
