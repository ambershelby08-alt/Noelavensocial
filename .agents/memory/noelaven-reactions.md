---
name: Noelaven reaction system
description: Full replacement of the Like system with 20 Noelaven-branded reactions. Covers data model, Firestore helpers, component architecture, and notification format.
---

# Noelaven Reaction System

## Data model
- `Post.reactions?: Record<string, string[]>` — emoji → [userId, …] stored on the post doc
- `Post.myReaction?: string | null` — derived in `subscribeFeed` from scanning the reactions map
- `Post.liked` = `myReaction !== null` (derived, kept for backward compat)
- `Post.likes` = total reaction count across all emojis

**Why reactions live on the post doc (not a subcollection):** Avoids extra reads per post; reactions map is small enough (20 emojis × N users). Old `liked_posts` subcollection no longer needed.

## Firestore helpers
- `togglePostReaction(postId, userId, emoji)` — uses `runTransaction` for atomic switch/add/remove
  - Same emoji → remove (toggle off, likes--)
  - Different emoji → switch (remove old, add new, likes unchanged)
  - No previous → add new (likes++)
- `subscribeFeed` no longer reads `liked_posts` subcollection; derives `myReaction` inline
- `writeNotification` type updated to include `'reaction'`

## useFeed
- `toggleReaction(postId, emoji)` — optimistic update + Firestore call + revert on error
- Uses `postsRef` (a `useRef`) to avoid stale closure when reading current post state
- `toggleLike` kept as alias calling `toggleReaction(postId, '🌊')`

## Components
- `src/lib/reactions.ts` — REACTIONS array, helpers: `getLabelForEmoji`, `getTopReactions`, `myReactionEmoji`, `reactionPhrase`
- `src/components/ui/ReactionButton.tsx` — main button + long-press tray + special effects
  - Single tap = toggle 🌊 Vibe
  - Long press (480ms) = open 20-reaction tray (2 rows: Positive/Thoughtful)
  - Special effects: 🌊 ripple ring, 💜 Noelove glow + floating hearts, ✨ sparkle burst, 🔥 fire flicker
  - `CommentReactionButton` — lightweight variant for comments (no tray)
- `src/components/ui/ReactorsModal.tsx` — who-reacted sheet with emoji filter tabs

## PostCard changes
- `onLike` prop renamed to `onReact: (postId, emoji) => void`
- Removed local `liked`/`likesCount` state — parent (useFeed) handles optimistic updates
- `CommunityReveal` also updated: `onLike` → `onReact`

## Notification format
- Type: `'reaction'` (was `'like'`)
- Message: `"${displayName} ${emoji} ${reactionPhrase(emoji)} your post"`
  - e.g. "Ashley 🌊 Vibed your post", "Marcus 💜 Noeloved your post"
- `getIcon` in Notifications.tsx extracts emoji from message (second word)
- `linkForNotif` handles `'reaction'` → `/post/${postId}`

## Backward compat
- Old posts without `reactions` field: `reactions` is optional in Post interface
- Old `liked` flag derived from `myReaction !== null`
- Old `liked_posts` subcollection no longer written but not deleted

**How to apply:** When displaying any reaction count or adding reaction UI, always use `post.reactions ?? {}` and `post.myReaction ?? null`.
