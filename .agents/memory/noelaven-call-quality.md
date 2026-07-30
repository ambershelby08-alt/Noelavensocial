---
name: Noelaven call quality + missed-call improvements
description: connectionQuality field in CallState; missed_call push on endCall; pagehide handler; ForwardPickerSheet user search
---

## connectionQuality (task #41)
- Added `connectionQuality: 'good' | 'poor' | 'reconnecting' | null` to `CallState` interface in `useWebRTC.ts`
- Set in `handleIceState`: `connected`/`completed` → `'good'`; `disconnected` → `'poor'`
- Shown in `CallScreen.tsx` in the top-left badge (replaces "Connected/Connecting" with colored quality label)
- FloatingCallWindow not updated — low priority since call screen is the primary UI

## missed_call push notification (task #33)
- In `endCall` (useWebRTC.ts), when `!wasAnswered && call.remoteId && currentUser`, fires `writeNotification(remoteId, 'missed_call', currentUser, { convId, message })` via fire-and-forget
- `missed_call` is already a valid `NotificationType` — no schema change needed
- `call.remoteId` added to `endCall`'s `useCallback` dependency array

## pagehide missed-call fix (task #34)
- `CallContext.tsx` imports `updateCallStatus` from callSignaling
- `isRingingRef` (useRef) synced on every render; `pagehide` handler reads it to avoid stale closure
- On pagehide: if `activeCallIdRef.current` is set and `isRingingRef.current` is true, calls `updateCallStatus(callId, 'missed')` best-effort
- **Why:** browser may kill the tab before async completes; startup `cleanupStaleCallsForUser` is the fallback

## ForwardPickerSheet user search (task #35)
- Added `currentUser: User` prop (cast via `as unknown as User` at render site)
- Added `userQuery`/`userResults`/`selectedUsers` state + debounced `fsSearchUsers` call
- Filters out self + users already in existing DM conversations
- Shows "People" section above conversations when results exist; purple checkmarks vs yellow for convs
- `handleSend()` calls `fsEnsureDMConversation(currentUserId, userId)` for each new user before sending

## ensureDMConversation (firestore.ts)
- New export: `ensureDMConversation(uid1, uid2): Promise<string>` — computes `dm_{minUid}_{maxUid}`, calls `setDoc(..., { merge: true })` to create if missing, returns convId
- Safe to call even if conversation already exists
