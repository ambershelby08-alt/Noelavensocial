---
name: Noelaven voice/video calls
description: WebRTC + Firestore signaling architecture, confirmed bugs and fixes, ICE patterns, and UI layout decisions.
---

## Architecture

- **Signaling**: Firestore `calls/{callId}` doc — offer/answer written directly; ICE candidates in subcollections `callerCandidates` / `calleeCandidates`.
- **State machine**: `useWebRTC.ts` — single hook, shared via `CallContext`. `CallProvider` in `AppShell`.
- **ICE config**: fetched from `GET /api/ice-config` with Firebase ID token → `artifacts/api-server/src/routes/iceConfig.ts`. Static TURN credentials from `TURN_URLS`, `TURN_USERNAME`, `TURN_CREDENTIAL` secrets.
- **UI**: `CallScreen.tsx` (full-screen), `FloatingCallWindow.tsx` (minimized draggable), `IncomingCallBanner` (toast).

## Confirmed bug — both panels showed local video (fixed 2026-07-25)

**Root cause**: `CallScreen` conditionally mounts video elements based on `hasRemote`. When `hasRemote` flips `false→true`, React unmounts the ringing layout and mounts the active layout (brand-new `<video>` elements). The old `useEffect` wiring (`[call.remoteStream]` dep) did not re-fire because `call.remoteStream` reference hadn't changed — the freshly mounted remote `<video>` got no `srcObject`.

**Fix**: All video elements use **callback refs** (functions passed as `ref={fn}`) instead of `useRef` + `useEffect`. React calls the function with the element at mount time and with `null` when unmounted. When the ref function's deps change (stream or `swapped` state), React calls old ref with `null` and new ref with element — re-applying the stream. This is the canonical approach for stream-to-element binding in conditional layouts.

Key pattern:
```tsx
const setLargeVideo = useCallback((el: HTMLVideoElement | null) => {
  if (el) el.srcObject = largeStream ?? null;
}, [largeStream]); // dep changes → ref fires again
```

Also: `ontrack` now forces a **new MediaStream object reference** (`new MediaStream(remote.getTracks())`) so React detects the change and callback refs re-fire when tracks arrive after the ICE connection is established.

## Confirmed bug — calls ending prematurely (fixed 2026-07-25)

**Root cause**: `ICE_RECONNECT_GRACE_MS = 8_000` — too short for mobile/Wi-Fi packet loss. ICE entering `'disconnected'` briefly (normal during network changes) would trigger an 8 s countdown that often expired before the browser self-healed.

**Fix**: `ICE_RECONNECT_GRACE_MS = 20_000` (20 seconds).

Also: `pc.restartIce()` was previously gated on being the offer side. The W3C spec allows both sides to call it. Removed the gate — both caller and callee now attempt `restartIce()` on ICE `'failed'`, with a 15 s timeout before giving up.

## Callee detecting caller hang-up

Previously the callee only knew the call ended when ICE timed out (~20–30 s after the caller hung up). Fix: in `buildPc` (callee side), a `subscribeCall` listener is added that calls `cleanup()` immediately when `status === 'ended' || status === 'declined'`.

## Video swap + minimize

- **Swap**: `swapped` boolean in `CallScreen` (local state). `largeStream = swapped ? localStream : remoteStream`, `pipStream = swapped ? remoteStream : localStream`. Tap PiP or "Swap" button toggles it. Both panels always use `object-fit: cover`.
- **Minimize**: `isMinimized: boolean` in `CallState` (in `useWebRTC`). `toggleMinimize()` in context. `AppShell` renders `FloatingCallWindow` when minimized, `CallScreen` otherwise. Call is not interrupted.
- **FloatingCallWindow**: draggable via pointer capture + `transform` via `useState({ x, y })`. Clamped to viewport bounds. Shows remote video (callback ref), mute/hang-up/restore buttons. Positioned `fixed` at z-[300].

## Switch camera

`switchCamera()` in `useWebRTC`: calls `getUserMedia({ video: { facingMode: { exact: newFacing } } })`, replaces the video track in the peer connection via `sender.replaceTrack()`, swaps the track in `localRef.current`, creates a new `MediaStream` reference for state, so callback refs in `CallScreen` re-fire and the local preview updates. No-op if the device doesn't support the facing mode.

## TURN verification logging

Both `startCall` and `answerIncomingCall` log whether TURN servers are present in the ICE config:
```
[WebRTC] caller ICE servers: 4 — TURN present: true
```

## ICE connection state logs (diagnostic — keep until two-device test confirmed)

`handleIceState` logs `iceConnectionState`, `connectionState`, `signalingState`, local track count, remote track count on every ICE state change. Remove these logs after the two-device test confirms the fix.

## CallState fields

| Field | Type | Purpose |
|---|---|---|
| `isMinimized` | boolean | whether call is in floating window mode |
| `localStream` | MediaStream \| null | local camera/mic stream |
| `remoteStream` | MediaStream \| null | remote participant's stream — dedicated MediaStream, never shared with local |

## Files

- `artifacts/noelaven/src/hooks/useWebRTC.ts` — core hook
- `artifacts/noelaven/src/components/calls/CallScreen.tsx` — full-screen overlay
- `artifacts/noelaven/src/components/calls/FloatingCallWindow.tsx` — minimized draggable card
- `artifacts/noelaven/src/contexts/CallContext.tsx` — global context
- `artifacts/noelaven/src/lib/callSignaling.ts` — Firestore signaling helpers
- `artifacts/noelaven/src/lib/iceConfig.ts` — ICE config fetcher + cache
- `artifacts/api-server/src/routes/iceConfig.ts` + `artifacts/api-server/src/lib/turnCredentials.ts` — TURN credential builder
- `artifacts/noelaven/src/components/layout/AppShell.tsx` — renders CallScreen / FloatingCallWindow
