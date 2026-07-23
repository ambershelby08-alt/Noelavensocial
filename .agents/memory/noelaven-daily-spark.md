---
name: Noelaven Daily Spark Architecture
description: Full Daily Spark feature — completion tracking, streak, community reveal, audience controls
---

## Completion Tracking
- localStorage key: `noelaven_spark_done_YYYY-MM-DD` → value is postId or `'true'`
- One write per day; `markAnswered` is idempotent
- `hasAnsweredToday` derived from this key on mount; no Firestore needed for demo mode

## Streak
- localStorage key: `noelaven_spark_streak` → `{ count: N, lastDate: 'YYYY-MM-DD' }`
- On `markAnswered`: if lastDate === yesterday → count+1; else if new day → count=1
- `streakBadges(count)` exported from `useDailySpark.ts` → used in Home + Profile

## Memory Lane
- On mount, scans all `noelaven_spark_done_*` localStorage keys
- If any key's MM-DD matches today's MM-DD and year < current year → MemoryLaneEntry returned
- Shown in `CommunityReveal` section

## Community Reveal (Home)
- `useSparkCommunity(prompt, enabled)` hook — Firebase: Firestore query posts where sparkPrompt == prompt; demo: static demo posts
- `CommunityReveal` component shows when `hasAnsweredToday === true`
- Sorts: Friends / Following / Everyone (visual only; demo shows all regardless)
- Featured (first 2) vs. "More responses" (rest)
- Excludes current user's own post (already in main feed)

## Audience
- `SparkAudience = 'public' | 'friends' | 'only_me' | 'private'` in mockData.ts
- Stored as `sparkAudience` field on Post documents in Firestore
- `SparkModal` has 4-button audience selector (defaults to 'public')
- Profile `SparkCard` has audience picker dropdown (own sparks only) → calls `updatePostSparkAudience`

## Data Flow
1. `useDailySpark` reads today's localStorage doneKey → sets `hasAnsweredToday`
2. SparkModal posts with sparkPrompt + sparkAudience
3. `handleSparkPost` (async) → `addPost` returns postId → `markAnswered(postId)` → `sparkJustCompleted=true` for 2.2s
4. DailySpark card shows green "completed" animation then disappears
5. CommunityReveal animates in

**Why:** All state in localStorage means zero latency, works in demo mode, survives page refresh. Firestore community query uses `sparkPrompt == prompt` which requires a composite index in production.

**How to apply:** If Firestore index missing → community section will load empty (not crash). Add composite index on `posts`: (sparkPrompt ASC, createdAt DESC).
