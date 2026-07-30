---
name: Noelaven voice call audio
description: Root cause and fix for voice calls connecting but producing no audio; plus DTMF, hold, and speaker architecture.
---

# Voice call audio fix

## The rule
Voice calls require a hidden `<audio autoPlay>` element with `srcObject = remoteStream`. Without it the call connects but both sides hear nothing.

**Why:** Video calls play remote audio through the `<video autoPlay>` element. Voice calls have NO video element, so the `remoteStream` (which carries audio tracks) is never attached to any DOM element and never plays.

**How to apply:** In `CallScreen.tsx` the voice call path (`if (!isVideo)`) renders:
```tsx
<audio ref={setAudioEl} autoPlay playsInline className="sr-only" />
```
`setAudioEl` is a `useCallback` ref that sets `el.srcObject = call.remoteStream`. Because it depends on `[call.remoteStream]`, React re-fires it when the stream arrives, keeping srcObject in sync.

## Speaker routing
`setSinkId` must be applied to BOTH `largeVideoRef.current` (video calls) and `audioRef.current` (voice calls). The effect in `CallScreen.tsx` iterates both. Check `'setSinkId' in HTMLAudioElement.prototype` to detect support; if false, show "Speaker switching isn't supported on this device."

## DTMF
`sendDtmf(tones)` in `useWebRTC.ts` finds the audio sender via `pc.getSenders().find(s => s.track?.kind === 'audio')` and calls `sender.dtmf.insertDTMF(tones, 100, 70)`. Returns `false` if `sender.dtmf` is null (not all browsers / remote sides support DTMF).

## Hold
`toggleHold()` in `useWebRTC.ts` disables/enables all local tracks (`t.enabled = !onHold`), keeping the ICE connection alive. State field: `CallState.isOnHold`. UI: Hold/Resume button only shown when `call.isActive`.

## Add Call
Intentionally disabled — shows "Group calling is coming soon." toast. `CtrlBtn` has a `disabled` prop that reduces opacity and suppresses `whileTap`.
