---
name: Noelaven DM conversation IDs
description: Deterministic DM conv IDs eliminate race conditions; no composite index needed for DM lookup.
---

## Rule
DM conversation document IDs are deterministic: `dm_{minUid}_{maxUid}` (UIDs sorted alphabetically).

**Why:** The original `addDoc` approach had a race condition — two users starting a DM simultaneously would both read zero results and both call `addDoc`, creating duplicate threads. With a fixed ID, `setDoc({ merge: true })` is idempotent.

## Implementation
- `getOrCreateDirectConversation` in `firestore.ts` uses `[userId, otherUserId].sort()` to derive the ID.
- Checks `getDoc(convRef)` first; if the doc exists, returns the ID immediately.
- Falls back to `setDoc(..., { merge: true })` — safe even if two clients race.

## Index notes
- The query for existing convs now uses only `where('participantIds', 'array-contains', userId)` — single field, no composite index.
- `type === 'direct'` is filtered client-side.

**How to apply:** Any new DM creation must use this deterministic ID pattern. Never use `addDoc` for DM conversations.
