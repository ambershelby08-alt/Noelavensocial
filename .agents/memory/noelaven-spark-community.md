---
name: Noelaven Spark Community Feed
description: Architecture of the Daily Spark community responses feed — prompt persistence, audience filtering, sort tabs, account isolation guard, and confirmed production bugs.
---

## Current query (correct — confirmed via Admin SDK 2026-07-25)

`subscribeCommunitySparkPosts` uses:
```
where('createdAt', '>=', Timestamp.fromDate(etDayStart))
orderBy('createdAt', 'desc')
limit(pageSize)
```
This uses Firestore's auto-deployed single-field index on `createdAt` — no composite index
needed. Client-side filter: `p.sparkPrompt && p.sparkAudience === 'public'`.

**Why NOT sparkDateKey:** Existing posts don't have the `sparkDateKey` field (written only by
new code); an equality query on it returns 0 results for older posts. Confirmed via Admin SDK.

**Why NOT sparkPrompt equality:** The API server generated 3 different prompt strings on
2026-07-25 across server restarts. Exact-match filtering silently drops valid responses.

## CommunityReveal gate — was a confirmed bug, now fixed

**Old code (buggy):** `{hasAnsweredToday && <CommunityReveal ...>}`
**New code (fixed):** `{!!sparkPrompt && <CommunityReveal ...>}`

**Root cause confirmed 2026-07-25:** Account B (who follows Account A) could never see
Account A's public response because CommunityReveal was only rendered after Account B also
answered. Account B had 0 posts in Firestore today, so `hasAnsweredToday = false` always.
The Firestore query and client filters were correct — the gate was the blocker.

`CommunityReveal` now accepts `hasAnsweredToday: boolean` prop and uses it only for the
`total` count (`allOthers.length + (hasAnsweredToday ? 1 : 0)`).

## checkTodaySparkAnswer — composite index NOT deployed (confirmed bug)

**Old query (broken):**
```
where('authorId', '==', uid)
where('createdAt', '>=', Timestamp.fromDate(dayStart))   ← requires missing index
orderBy('createdAt', 'desc')
```
Admin SDK threw `FAILED_PRECONDITION` on 2026-07-25: the composite index
`(authorId ASC, createdAt ASC, __name__ ASC)` does not exist in the live project.
The browser client silently catches this and returns `null` — cross-device answered-state
restoration never works.

**New query (fixed):**
```
where('authorId', '==', uid)
orderBy('createdAt', 'desc')   ← uses existing (authorId, createdAt DESC) composite index
limit(10)
```
Then client-side: find first doc where `sparkPrompt` truthy AND `createdAt >= etDayStart`.
Ten posts is more than enough — one spark per day is enforced.

## Audience filtering: only 'public' posts enter the community subscription

`subscribeCommunitySparkPosts` client-side filter: `p.sparkAudience === 'public'`.
Firestore document field is `sparkAudience`, value is the string `'public'` (not 'everyone').

## Sort tabs: useFollowingIds + IIFE filter

`CommunityReveal` calls `useFollowingIds(currentUserId)` and `useFollowerIds(currentUserId)`.
- `everyone`  → `allOthers` (all public posts, no relationship filter)
- `following` → `followingIds.has(p.authorId)`
- `mutuals`   → `followingIds.has(p.authorId) && followerIds.has(p.authorId)`

`allOthers = posts.filter(p => p.authorId !== currentUserId)` — current user's own post
excluded from all tabs (displayed separately above the community section).

## Account isolation: confirmedForUserId guard in useDailySpark

`useDailySpark` maintains `confirmedForUserId`. Returns `hasAnsweredToday: true` only when
`confirmedForUserId === userId`. Prevents cross-account flash on account switch.
`markAnswered` also sets `confirmedForUserId` so in-session answers aren't masked.

## Firestore rules: subcollection coverage

`users/{userId}/following` and `users/{userId}/followers` subcollections need EXPLICIT rules —
parent `/users/{userId}` rule does NOT cover them. Rules are in `firestore.rules`.
