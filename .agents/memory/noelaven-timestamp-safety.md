---
name: Noelaven timestamp safety
description: Why .getTime() crashes on Firestore values, and the safe utilities to use instead.
---

## Rule
Never call `.getTime()` directly on any value that comes from Firestore. Use the utilities in `src/lib/timestamp.ts`:
- `normalizeDate(value: unknown): Date | null`
- `safeGetTime(value: unknown): number` (returns 0 on null — safe for sort comparisons)
- `formatRelativeTime(value: unknown): string` (returns 'just now' on null)

## Why
In a pnpm monorepo, the Firebase SDK can be bundled from more than one module path (e.g. the app and a shared lib may each pull in their own copy). When that happens, a Firestore `Timestamp` created by bundle A fails `instanceof Timestamp` against the class from bundle B. The old `ts()` helper in `firestore.ts` used `instanceof`, fell through to `return v as Date`, and handed a raw Timestamp to `.getTime()` — crash.

The fix is duck-typing: check `typeof v.toDate === 'function'` instead of `instanceof`. This is immune to cross-bundle class identity issues.

## ts() in firestore.ts
The `ts()` helper has been updated to use duck-typing. It is the canonical converter for values coming out of Firestore documents. All other callers (sorts, display) should use the utilities above.

## How to apply
- Any new sort on `createdAt` or similar: `safeGetTime(a.createdAt) - safeGetTime(b.createdAt)`
- Any timestamp displayed as relative time: `formatRelativeTime(post.createdAt)`
- Any `Date | null` needed for `date-fns` functions: `normalizeDate(value)` — check for null before passing to `format()`

## Files patched (as of this session)
- `src/lib/timestamp.ts` — new file, source of truth
- `src/lib/firestore.ts` — `ts()` rewritten with duck-typing
- `src/pages/Home.tsx` — `formatRelativeTime` now imported from timestamp.ts
- `src/pages/Profile.tsx` — `relDate()` + post sort use normalizeDate/safeGetTime
- `src/pages/Chat.tsx` — message grouping window uses safeGetTime
- `src/lib/stories.ts` — story group sorts use safeGetTime
