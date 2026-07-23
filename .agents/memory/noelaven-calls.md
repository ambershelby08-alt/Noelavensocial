---
name: Noelaven voice/video calls
description: WebRTC + Firestore signaling architecture for voice and video calls. Replaces the ComingSoonSheet stub.
---

## Architecture

**Firestore collection: `calls/{callId}`**
- Fields: callerId, callerName, callerAvatar, calleeId, conversationId, type, status, offer (SDP), answer (SDP), createdAt
- Subcollections: `callerCandidates`, `calleeCandidates` — ICE candidates per side
- Status transitions: ringing → active / declined / ended / missed

**STUN**: `stun.l.google.com:19302` (free public, no account needed)

**Files:**
- `src/lib/callSignaling.ts` — Firestore helpers (createCall, answerCall, subscribeCall, subscribeIncomingCalls, addIceCandidate, subscribeIceCandidates)
- `src/hooks/useWebRTC.ts` — RTCPeerConnection lifecycle hook (startCall, answerIncomingCall, declineCall, endCall, toggleMute/Camera/Speaker)
- `src/contexts/CallContext.tsx` — singleton context wrapping useWebRTC; subscribes to incoming calls; `useCall()` exported
- `src/components/calls/CallScreen.tsx` — full-screen call overlay + `IncomingCallBanner` component

**Wiring:**
- `CallProvider` wraps `AuthenticatedApp` in `AppRouter.tsx`
- `AppShell.tsx` renders `<CallScreen>` and `<IncomingCallBanner>` via `useCall()`
- `Chat.tsx` calls `startCall()` from `useCall()` when phone/video header buttons are tapped

## Key implementation notes

**Why**: Caller creates SDP offer → uploads to Firestore → gets `callId` → ICE candidates queued in a `pendingCandidates` array until `callId` is available, then flushed. This avoids a double-PC race condition.

**Demo mode**: When Firebase is not configured, `startCall` simulates a 2-second ring then transitions to an active call state (no real media, timer starts).

**Permissions fallback**: If `getUserMedia` fails (no mic/cam permissions), falls back to a silent AudioContext stream so the call UI still shows without crashing.

**Composite index required**: `calls` collection needs index on `(calleeId ASC, status ASC)` — included in `firestore.indexes.json`.
