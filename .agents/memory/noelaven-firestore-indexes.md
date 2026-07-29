---
name: Noelaven Firestore composite index constraints
description: Service account lacks datastore.indexes.create; all composite-index queries must sort client-side instead.
---

## Rule
The Firebase service account (`FIREBASE_SERVICE_ACCOUNT_JSON`) has `datastore.indexes.list` but NOT `datastore.indexes.create`. The Firebase CLI also fails at the `serviceusage.googleapis.com` check-API step. Composite indexes CANNOT be deployed programmatically from this environment.

**Why:** IAM role is `Firebase Admin SDK Administrator Service Agent` — does not include `Cloud Datastore Index Admin`.

## How to apply
Any Firestore query that combines:
- `array-contains` on one field + `orderBy` on a different field, OR
- `where(field_A, '==', ...)` + `orderBy(field_B, ...)`

...requires a composite index. Instead:
1. Drop `orderBy(...)` and `limit(N)` from the Firestore query
2. Fetch the documents with only equality / array-contains filters
3. Sort and slice client-side after the snapshot arrives

**Example pattern (applied in firestore.ts):**
```ts
// BEFORE (throws failed-precondition / "requires an index")
query(collection(db, 'conversations'),
  where('participantIds', 'array-contains', userId),
  orderBy('lastMessageAt', 'desc'))

// AFTER (no composite index needed)
query(collection(db, 'conversations'),
  where('participantIds', 'array-contains', userId))
// then in the snapshot callback:
.sort((a, b) => getTime(b.lastMessageAt) - getTime(a.lastMessageAt))
```

## Already fixed
- `subscribeConversations` — removed `orderBy('lastMessageAt', 'desc')`
- `getOrCreateDirectConversation` — same query, same fix
- `checkTodaySparkAnswer` slow path — removed `orderBy('createdAt', 'desc') + limit(10)` on posts

## Known remaining queries that may need this fix
Any other query in `firestore.ts` or `callSignaling.ts` that combines equality + orderBy on different fields. Grep: `orderBy.*where\|where.*orderBy` in those files.
