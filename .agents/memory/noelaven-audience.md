---
name: Noelaven Audience System
description: Canonical audience values, normalization, and where they are applied
---

## Canonical Values (SparkAudience type)
`'public' | 'mutuals' | 'private' | 'onlyMe'`

## Legacy Values (Firestore may have these from old writes)
| Old value | Normalizes to |
|---|---|
| `'friends'` | `'mutuals'` |
| `'only_me'` | `'onlyMe'` |
| `'everyone'` | `'public'` |
| null/undefined | `'public'` |

## Normalization Point
`normalizeAudience(raw)` in `src/lib/firestore.ts` — called inside `docToPost` for BOTH `sparkAudience` and `postAudience` fields. All reads from Firestore go through `docToPost`, so old and new values are transparently normalized.

## Write Layer
- All AUDIENCE_OPTIONS arrays in UI use canonical values (`mutuals` not `friends`, `onlyMe` not `only_me`)
- `createPost` stores `postAudience: opts.postAudience ?? 'public'` and passes `sparkAudience` as-is (already canonical from UI)

## Where Applied
- **Spark posts** (`sparkAudience`): SparkModal in Home.tsx, Spark card audience pill in Profile.tsx
- **Regular posts** (`postAudience`): PostComposer in Home.tsx has audience pill selector
- **Community feed filter**: `useSparkCommunity` filters `p.sparkAudience === 'public'` — works after normalization

## postAudience on Regular Posts
Added to `Post` interface as `postAudience?: SparkAudience`. Stored in Firestore. PostComposer shows a pill selector (Public / Mutuals / Private / Only Me) in the expanded bottom bar.

**Why:** The app had a `sparkAudience` field only on Spark posts. Regular posts lacked per-post audience control. Both now use the same canonical SparkAudience type.
