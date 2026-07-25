---
name: Noelaven Daily Spark status architecture
description: How the shared Daily Spark answered-state is managed across all pages and entry points
---

## Rule
All Daily Spark answered-state reads must come from `useDailySparkStatus()` (from `DailySparkContext`). Never call `useDailySpark(uid)` directly in pages or nav components — it creates isolated instances that start from `false` and race with localStorage.

## Why
`useDailySpark` starts `hasAnsweredToday = false` and reads localStorage in a `useEffect`. When Home mounts after navigating from another page, the `useEffect` that checks `?spark=1` fires on the same render cycle as (and before) the storage-read effect, so it always sees `false` and opens the composer. Moving `useDailySpark` into a provider above the router means the state is settled long before any page mounts.

## How to apply
- `DailySparkProvider` in `src/contexts/DailySparkContext.tsx` calls `useDailySpark(currentUser?.id)` once, lives in `App.tsx` inside `AuthProvider > UserCacheProvider`
- Pages and components use `useDailySparkStatus()` from the context
- **Gate any UI open on `statusConfirmed`** — the `statusConfirmed: boolean` field is `true` only after localStorage has been read for the current UID. Home.tsx uses `handledSparkParamRef` + `statusConfirmed` guard to avoid the race
- BottomNav and Sidebar Spark buttons check `hasAnsweredToday` from context; if true, show `AlreadyAnsweredSheet` (not composer)
- `recordSparkAnswer(uid, dateKey, 'pending')` in `firestore.ts` writes a `dailySparkResponses/{uid}_{YYYY-MM-DD}` doc via a Firestore transaction — rejects duplicates with `Error('already_answered')`. Called from `handleSparkPost` BEFORE `addPost` so the gate is set before the post exists
- Firestore rules: `allow create` only (no update/delete) on `dailySparkResponses` — server-side write-once enforcement
- `checkTodaySparkAnswer` fast path: point-read `dailySparkResponses/{uid}_{dateKey}` (O(1)); slow path: query posts collection (backward compat for pre-gate answers)

## Account switching
`useDailySpark`'s `useEffect([userId, today])` re-reads localStorage on every userId change and resets `confirmedForUserId`. The `safeHasAnsweredToday` and `statusConfirmed` guards prevent the previous account's state from leaking.
