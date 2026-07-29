---
name: Noelaven phantom call bug
description: Three root causes of phantom incoming calls and the fixes applied
---

## Rule
Never let `subscribeIncomingCalls` deliver a call without passing all three guards.

## Four root causes (all fixed)

### 1. Stale `ringing` documents (primary cause)
When a caller's app crashes or loses connectivity before updating status, the document stays `ringing` forever. Every time the callee reconnects, Firestore re-delivers it and the phone rings again.
**Fix:** `callSignaling.ts` — `isCallStale()` checks `CALL_MAX_RING_AGE_MS = 45_000` and auto-expires to `missed` before delivering. Any call older than 45 s is silently expired.

### 2. Stale closure on active-call guard
`CallContext.tsx` used `rtc.call.callId` inside `setIncomingCall` — but because the callback is created once (no deps), it captured the value at mount time (always `null`). Active calls never blocked phantom calls.
**Fix:** `activeCallIdRef` updated on every render; the subscription callback reads `activeCallIdRef.current` (always live).

### 3. No deduplication across reconnects
Declined/expired calls re-rang when the callee refreshed before the caller's Firestore update propagated.
**Fix:** `handledCallIdsRef` (a `Set<string>`) persisted to `sessionStorage` under `nlv_handled_calls`. Every answered/declined/expired call ID is added; subscription ignores any ID in the set.

## How to apply
- All three guards live in `CallContext.tsx` subscription callback (in order: active call → stale → already handled → ring).
- `sessionStorage` key `nlv_handled_calls` stores last 20 call IDs per tab session.
- `CALL_MAX_RING_AGE_MS` in `callSignaling.ts` MUST equal `RING_TIMEOUT_MS` in `useWebRTC.ts`.
