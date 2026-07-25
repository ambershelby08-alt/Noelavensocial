---
name: Noelaven Liked & Saved Posts Architecture
description: How liked and saved posts are indexed, subscribed, and displayed in the Profile tab
---

## Rule
Never derive liked/saved posts by filtering the user's own post feed. They come from separate Firestore subcollection subscriptions.

## Firestore Paths
- **Liked index**: `users/{uid}/liked_posts/{postId}` — `{ postId, likedAt: serverTimestamp() }`
- **Saved index**: `users/{uid}/saved_posts/{postId}` — `{ savedAt: serverTimestamp() }`

## Write Gates
- **Likes**: `togglePostReaction` writes/deletes `liked_posts` entry INSIDE the transaction that updates `posts/{postId}.reactions`.
  - Toggle off (remove reaction) → `tx.delete(likeRef)`
  - Toggle on or switch emoji → `tx.set(likeRef, { postId, likedAt: serverTimestamp() }, { merge: true })`
- **Saves**: `togglePostSave` writes/deletes `saved_posts` entry (unchanged since original)
- Old `togglePostLike` (deprecated) also wrote `liked_posts` — backward compat preserved

## Read Layer
- `subscribeLikedPosts(userId, currentUserId, onData)` — subscribes to liked_posts orderBy likedAt desc, batch-fetches post docs, enriches liked/saved flags
- `subscribeSavedPosts(userId, currentUserId, onData)` — same pattern for saved_posts

## useProfile Hook
- `likedPosts` and `savedPosts` are separate state arrays (not derived from `posts`)
- Subscriptions only start when `isOwn === true` — never leak one account's data to another
- Both subscriptions restart when `userId` or `currentUserId` changes (account switch safety)

## Profile.tsx
- Destructures `{ likedPosts, savedPosts }` directly from `useProfile(userId)`
- Does NOT call `.filter(p => p.liked)` or `.filter(p => p.saved)` on hookPosts

## Why subscribeUserPosts was wrong for this
`subscribeUserPosts` fetches posts WHERE `authorId == userId` — it only returns posts the user WROTE, not posts they liked/saved from others. Even if enriched, it would miss the majority of liked/saved posts.

**Why:** Firestore cannot query "posts where any `reactions.*` array contains userId" — no multi-field array-contains query. The liked_posts subcollection is the index that makes this possible.
