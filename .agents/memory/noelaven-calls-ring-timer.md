---
name: Noelaven call ring timer and missed-call logic
description: Ring timer must be cancelled on answer; endCall must use status not isActive to gate missed-call writes.
---

# Call Ring Timer and Missed-Call Logic

## The bug pattern (fixed)
The 45 s ring timer set in `startCall` was never cancelled when the callee answered. It fired mid-call, wrote `missed` to Firestore, and called `cleanup()` — dropping the live call at ~45 s.

`endCall` also used `call.isActive` (only true after ICE reaches `connected`) to decide "missed vs ended". If the caller hung up during ICE negotiation after the callee answered, `isActive` was still false → "missed" was written incorrectly.

## Fix applied
**File: `artifacts/noelaven/src/hooks/useWebRTC.ts`**

1. **Cancel ring timer on answer** — In the `subscribeCall` handler inside `startCall`, when `remoteDoc.status === 'active'` or `remoteDoc.answer` is present, immediately cancel `timers.current.ring` and update caller's local `call.status → 'active'`.

2. **Belt-and-suspenders in ring timer** — The ring timer callback now reads the live Firestore call doc before writing missed. If status is no longer `'ringing'` (call was answered), it skips the missed write.

3. **`endCall` uses `wasAnswered`** — `const wasAnswered = call.isActive || call.status === 'active'`. `call.status` is set to `'active'` in caller's local state as soon as the answer is detected (fix #1), so this correctly distinguishes answered-but-ICE-not-yet-connected from never-answered.

## Why: call.status vs call.isActive
- `call.status === 'active'` — set when callee answers (before ICE)
- `call.isActive === true` — set only when ICE reaches `connected`/`completed`
- Never use `isActive` alone to gate missed-call writes; use `status` instead.

## Dependency added
`getCall` imported from `@/lib/callSignaling` (was exported but not imported in useWebRTC).
