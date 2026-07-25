---
name: Noelaven Spark community query architecture
description: Why sparkDateKey is used instead of sparkPrompt+orderBy for community queries, and why composite indexes were the root cause of the empty feed bug.
---

# Spark Community Query Architecture

## The rule
Always query the community feed by `sparkDateKey` (single equality `where` clause), never by `sparkPrompt + orderBy('createdAt')`.

**Why:** `where('sparkPrompt', '==', prompt) + orderBy('createdAt', 'desc')` is a compound query requiring a composite index on `(sparkPrompt ASC, createdAt DESC)`. Composite indexes must be deployed via Firebase CLI — they are NOT created automatically. Without the deployed index, Firestore throws `failed-precondition` and returns zero documents, making the community feed appear empty for all users.

**How to apply:** `subscribeCommunitySparkPosts` takes `sparkDateKey: string` (the ET date key `YYYY-MM-DD`). It queries `where('sparkDateKey', '==', sparkDateKey)` with no `orderBy`. Results are sorted client-side by `createdAt` descending in `useSparkCommunity`.

## Fields written on spark posts (createPost)
- `sparkPrompt` — the prompt text (for display and backward compat)
- `sparkAudience` — `'public' | 'friends' | 'only_me' | 'private'`
- `sparkDateKey` — `YYYY-MM-DD` in America/New_York (used for querying)

## checkTodaySparkAnswer
Uses `where('authorId', '==', userId)` + `where('sparkDateKey', '==', today)`. Two equality filters — Firestore can handle with auto-created single-field indexes (no composite needed). Old version used `createdAt >= dayStart` which required a 3-field composite index that was never deployed.

## Client-side filters in useSparkCommunity (applied in order)
1. `isFromTodayET(p.createdAt)` — safety net for clock drift
2. `p.sparkPrompt === prompt` — ensures only the active Daily Spark question shows
3. `p.sparkAudience === 'public'` — visibility gate
4. Sort by `createdAt` descending

## Cache
- Module-level `memCache: Map<prompt, Post[]>` — survives remounts
- `localStorage` keyed by `noelaven_community_{etDate}_{prompt}` — survives refreshes, evicted at midnight ET

## What NOT to do
- Do not add `orderBy('createdAt')` to the Firestore query without first deploying the composite index via Firebase CLI
- Do not query by `sparkPrompt` for community feeds — index not deployed
