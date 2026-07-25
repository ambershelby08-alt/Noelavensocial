---
name: Noelaven Beta Stabilization Sprint
description: Key decisions and patterns from the full beta stabilization sweep
---

# Beta Sprint — Durable Lessons

## Timestamp safety (Task #12)
Use duck-typed `.toDate?.()` everywhere, not `instanceof Timestamp`. Pattern:
```ts
(v as { toDate?: () => Date })?.toDate?.() ?? new Date()
```
Also applied for `.getTime()` calls — always normalize first. Source of truth: `src/lib/timestamp.ts` (normalizeDate / safeGetTime).

## onSnapshot error handlers (Task #12)
Every `onSnapshot` call must pass a second callback: `err => console.error('[tag]', err.code, err.message)`. Silent listeners cause invisible failures. All listeners in firestore.ts, safety.ts, stories.ts, callSignaling.ts now have error handlers.

## Firestore security rules gap (Task #12)
`/comments/{commentId}` at the top level does NOT cover comments stored as `posts/{postId}/comments/{commentId}`. The subcollection rule must be nested inside `match /posts/{postId}`. Also added: calls/ICE candidates, user subcollections (saved/liked/joined), conversation typing subcollection.

## Message notification writes (Task #13)
`sendMessage` now accepts optional `senderProfile?: User` and writes `type:'message'` notifications for all recipients after the conversation update. Pass `currentUser` from `useMessages.ts` to activate.

## Chat scroll fix (Task #13)
Added `isInitialLoadRef` — first message arrival uses `behavior:'instant'`, subsequent arrivals (already at bottom) use `behavior:'smooth'`. Prevents visible jump on conversation open.

## Photo viewer in chat (Task #13)
`ImageBubble` now accepts `onOpen?: (url: string) => void`. Chat.tsx holds `viewingPhoto` state and renders a full-screen overlay with a Download link. The `BubbleProps` interface includes `onOpenPhoto`.

## Race condition in resolveUser (Task #15)
Added `resolveGen` counter inside the `onAuthStateChanged` closure. Each callback invocation increments the counter; `resolveUser` receives an `isCurrent()` predicate and discards stale results after the async `getUserDoc` await. Critical for rapid account switching.

## Notification wiring (Tasks #13/#14)
- `followUser` — optional `actor?: User` param writes `type:'follow'` notification
- `addComment` — optional `postAuthorId?: string` param writes `type:'comment'` notification
- `togglePostReaction` — optional `actorProfile?: User` param writes `type:'reaction'` on NEW reactions only (not switches/removes)
- **Do not double-notify**: Home.tsx already calls `fsWriteNotification` for comments; Profile.tsx calls `notifyFollow` separately — don't pass actor to these callsites

## Real-time ModerationDashboard (Task #16)
`subscribeReports(status, onData, onError)` in safety.ts uses `onSnapshot` for live updates. Dashboard report tabs (pending/reviewing/resolved/dismissed) use this; suspended/banned/log still use one-time fetch. Unreachable tabs clean up via `useEffect` return.

## Daily Spark midnight reset (Task #16)
Added a 30-second `setInterval` fallback alongside the existing `setTimeout` to recover after device sleep. Both are cleared in the effect cleanup.

## suggestedCreators in Discover (Task #16)
Replaced hardcoded `[]` with a dynamic `getDocs` query on `users` ordered by `followers DESC`, limited to 10, filtered to exclude self. Session-scoped (no real-time subscription).

## Firestore indexes added
- `reports (status ASC, createdAt DESC)`
- `reports (reportedUserId ASC, status ASC)`
- All are in `firestore.indexes.json` — must `firebase deploy --only firestore:indexes` to take effect in production.
