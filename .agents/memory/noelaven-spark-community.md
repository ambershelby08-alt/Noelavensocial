---
name: Noelaven Spark Community Feed
description: Architecture of the Daily Spark community responses feed — prompt persistence, audience filtering, sort tabs, and account isolation guard.
---

## The core rule: prompt string must be identical across all accounts

The Firestore community query is `where('sparkPrompt', '==', prompt)`. This requires an
**exact string match**. If Account A and Account B receive even slightly different prompt
strings (e.g., server restarted between requests), Account B's query returns 0 results and
"No other responses yet" shows even though Account A has a public post.

**Fix:** The API server (`artifacts/api-server/src/routes/spark.ts`) now persists the daily
prompt to `.spark-prompt-cache.json`. The file cache is loaded on startup so server restarts
return the same prompt. All clients on the same ET day get the identical string.

**Why:** The previous `new Map()` in-memory cache was cleared on every server restart. In
development (hot-reload, workflow restart) this happened constantly, silently causing a
prompt mismatch that looked like a Firestore query returning empty.

## Audience filtering: only 'public' posts enter the community subscription

`subscribeCommunitySparkPosts` in `firestore.ts` now filters to `p.sparkAudience === 'public'` only.

**Why:** The old filter also passed `'friends'`-audience posts through, meaning private
responses appeared in the Everyone tab for all viewers regardless of relationship.

## Sort tabs: useFollowingIds + IIFE filter

`CommunityReveal` in `Home.tsx` calls `useFollowingIds(currentUserId)` (from
`src/hooks/useFollowingIds.ts`), which subscribes to `users/{uid}/following` subcollection
and returns a `Set<string>` of followed UIDs.

Sort filtering is applied as an IIFE after computing `allOthers`:
- `everyone` → all public posts (no extra filter)
- `following` → `followingIds.has(p.authorId)`
- `friends` → same as following (simplified; full mutual-follower check skipped to avoid
  a separate subcollection query per post)

## Account isolation: confirmedForUserId guard in useDailySpark

Between a userId prop change and the `useEffect([userId, today])` firing, `hasAnsweredToday`
retains the previous account's value. This causes a flash of the unlock banner on account
switch.

**Fix:** `useDailySpark` maintains a `confirmedForUserId` state. The return value exposes
`hasAnsweredToday: confirmedForUserId === userId ? hasAnsweredToday : false`. Only returns
true once the effect has confirmed the value for the current account.

`markAnswered` also sets `confirmedForUserId` so in-session answers don't get masked.

## Firestore rules: subcollection coverage

`users/{userId}/following` and `users/{userId}/followers` subcollections are NOT covered by
the parent `/users/{userId}` rule. Explicit rules added to `firestore.rules`:
- following: read = any authenticated user; write = owner only
- followers: read = any authenticated user; write = the person doing the following (auth.uid == followerId)

## Firestore index: checkTodaySparkAnswer

`checkTodaySparkAnswer` queries `(authorId, sparkPrompt, createdAt)`. Added composite index
to `firestore.indexes.json`. Without it, the query throws `failed-precondition` (silently
caught), so the cross-device "already answered" check never works.
