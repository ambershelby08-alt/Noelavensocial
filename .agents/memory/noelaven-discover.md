---
name: Noelaven Discover page
description: Architecture and key decisions for the production Discover experience
---

## Files
- `src/hooks/usePersonalization.ts` — localStorage signals, `rankPosts()` scoring
- `src/hooks/useDiscover.ts` — Firestore subscription, trending/suggested derivation, live search
- `src/pages/Discover.tsx` — full rewrite (~1 100 lines), all sub-components inline

## Tab structure (updated)
`TABS = ['For You', 'Trending', 'Suggested', 'Search']` — Search is a first-class tab, not a focus-mode overlay. `isSearchMode = activeTab === 'Search'`. Clicking the Search tab (or focusing the input) switches to it and stores the previous tab in `prevTab` so Cancel can navigate back. TrendingView Top Posts now uses `ExploreGrid` with local `pageCount` pagination (TRENDING_PAGE_SIZE=12) instead of a static `slice(0,12)`.

## Architecture decisions

**Privacy filter:** public posts filter uses `!p.sparkAudience || p.sparkAudience === 'public'`.
`SparkAudience` union is `'public' | 'friends' | 'only_me' | 'private'` — no `'everyone'` value.

**Optimistic reactions from Discover:** `localOverrides: Record<postId, Partial<Post>>` state in the
Discover page; merged onto `discover.allPosts` before rendering. Firestore subscription reconciles
on next update. Avoids needing a second subscription or exposing a setter from useDiscover.

**PostCard.onSave signature:** `(postId, newSaved: boolean)` — PostCard passes the *new* desired state.
The Discover `handleSave(postId, currentlySaved)` function expects the *current* state; ForYouView
adapts with `onSave={(id, newSaved) => handleSave(id, !newSaved)}`.

**Search:** runs client-side against already-subscribed posts (no extra Firestore reads). Debounced 280 ms.
Users search via `useDiscover.search()` which also calls `fsSearchUsers` for people.

**Categories:** 50 defined in CATEGORIES array with emoji + label + slug. Selecting a category filters
posts via `filteredPosts` in useDiscover (slug → label word match). Slug `'trending'` switches to
Trending tab automatically.

**Personalization:** `rankPosts()` scores by recency + engagement + interest match + recent-category
words + prior-reaction boost + 0.4 jitter. Signals stored under `'noelaven-personalization-v2'` in
localStorage.

**Trending data fallback:** `DEMO_TRENDING_HASHTAGS` / `DEMO_TRENDING_SPARKS` / `DEMO_TRENDING_SEARCHES`
are static lists shown when Firestore posts don't contain enough hashtags or sparks.

**Why:**
- Masonry grid uses CSS `columns: 2` with `break-inside: avoid` — no JS needed, renders correctly.
- ExploreCard keeps its own local reaction/save state for instant feedback; syncs from props on effect.
