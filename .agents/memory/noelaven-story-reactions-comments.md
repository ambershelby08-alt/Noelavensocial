---
name: Noelaven story reactions and comments
description: Architecture for story reactions and comments — Firestore subcollections, service layer, and StoryViewer integration.
---

# Story Reactions & Comments Architecture

## Firestore structure
- `stories/{storyId}/reactions/{userId}` — one doc per user (userId is the doc ID)
  - Fields: `userId`, `reactionType` (emoji), `createdAt` (serverTimestamp)
  - Toggle pattern: read current doc; same emoji → deleteDoc; different/none → setDoc
- `stories/{storyId}/comments/{commentId}` — auto-ID
  - Fields: `authorId`, `authorName`, `authorAvatarUrl`, `text`, `createdAt`
  - Private (Instagram-style): only story author and comment author can read

## Service functions (stories.ts)
- `toggleStoryReaction(storyId, userId, reactionType)` — upsert or delete via getDoc+setDoc/deleteDoc
- `subscribeStoryReactions(storyId, cb)` — onSnapshot on reactions subcollection
- `addStoryComment(storyId, author, text)` — addDoc to comments subcollection
- `subscribeStoryComments(storyId, cb)` — onSnapshot ordered by createdAt asc

**Why:** Stories needed the same Noelaven reaction set (20 emojis) as posts. The `ReactionButton` component is designed for posts (emoji→[userId] map format) so a lighter inline tray was built directly in StoryViewer.

## StoryViewer v2 additions
- Tap areas now stop at `bottom: 88px` (not bottom-0) to leave room for the bottom bar
- **Non-owners**: reaction pill (tap→toggle tray) + comment input + send button
- **Owners**: reaction pill + viewer count + "View Activity" → ActivityPanel sheet
- ActivityPanel shows merged reactions+comments per user, names/avatars navigate to profile
- Progress bar pauses when reaction tray, activity panel, or comment input is focused
- Optimistic updates for both reactions and comments; errors roll back

## Notification types used
- `story_reaction` — fired when a viewer reacts (not to own story)
- `story_reply` — fired when a viewer comments

## Firestore rules
Added to `firestore.rules` under `match /stories/{storyId}`:
- reactions: read=isAuthenticated; create/update=isOwner(userId); delete=isOwner(userId)
- comments: read=story author OR comment author; create=isAuthenticated+own authorId; update/delete=comment author or moderator
