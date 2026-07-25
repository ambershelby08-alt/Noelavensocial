---
name: Noelaven voice/video calls
description: WebRTC + Firestore signaling; ICE config; call phase state machine; TURN credential endpoint
---

## Architecture
- Signaling via Firestore `calls/{callId}` + subcollections `callerCandidates` / `calleeCandidates`
- `useWebRTC.ts` — all peer-connection logic; `CallContext.tsx` — singleton shared across app
- Demo mode simulates ring+connect when Firebase is not configured

## ICE / TURN

### Server: `GET /api/ice-config`
- Requires `Authorization: Bearer <Firebase ID token>` when Admin SDK is configured
- Returns `{ iceServers, expiresAt }` — STUN always present; TURN added when `TURN_URLS` + `TURN_SECRET` env vars are set
- Short-lived TURN creds use HMAC-SHA1 (coturn REST API format): `username = "${expiresAt}:${uid}"`, `credential = base64(HMAC-SHA1(secret, username))`
- Key: `TURN_URLS` (comma-separated), `TURN_SECRET`, optional `TURN_TTL` (default 86400 s)

### Client: `src/lib/iceConfig.ts`
- Caches config until 120 s before `expiresAt`; falls back to STUN-only on any error
- Call `clearIceConfigCache()` on sign-out
- `getIceConfig()` called before every `new RTCPeerConnection(...)` in both caller and callee paths

## Call Phase State Machine (local only — never written to Firestore)

```
null → ringing → connecting → connected ──────────────────────────► null (cleanup)
                                    └─► reconnecting ─► (recovered)→ connected
                                                     └─► failed ──────────────► null
```

- `connecting` — ICE in `checking`; 30 s timeout from PC creation
- `ringing` — offer sent (caller) or received, waiting for answer  
- `connected` — ICE `connected`/`completed`; timer starts; `isActive = true`
- `reconnecting` — ICE `disconnected`; 8 s grace; ICE restart attempted on `failed`
- `failed` — tear down after ICE restart times out (10 s)

**Why:** Phase is separate from Firestore `status` so UI can show granular connection quality without polluting the signaling doc.

## Cleanup
`cleanup()` in `useWebRTC`: stops all senders via `getSenders()`, closes PC, stops local tracks, unsubscribes all Firestore listeners, clears all 6 timers (interval, demo, ring, iceConnect, reconnect, iceRestart).

## ICE candidate queuing (caller path)
Candidates can arrive before `createCall()` resolves; they are pushed to `pendingCandidates[]` and flushed once `callId` is known.

## CallScreen phase display
Status line priority: failed (red) → reconnecting (amber, pulsing) → connecting (blue, pulsing) → ringing (purple, pulsing) → active (green timer).
