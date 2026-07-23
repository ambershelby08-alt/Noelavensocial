---
name: Noelaven messaging architecture
description: Production messaging layer — schema, Firestore helpers, hooks, and UI patterns
---

# Noelaven Messaging Architecture

## Message type (mockData.ts)
Full schema including: `status`, `replyToId`, `replyToPreview`, `editedAt`, `editedContent`,
`deletedFor[]`, `deletedForEveryone`, `mediaUrl`, `mediaType`, `voiceDuration`,
`voiceWaveformData`, `forwardedFrom`, `sharedPost`.

## Conversation type (mockData.ts)
Added: `lastMessageType`, `lastSenderId`, `pinnedBy[]`, `archivedBy[]`, `mutedBy[]`.

## Firestore helpers (firestore.ts)
Imports added: `arrayUnion`, `arrayRemove`, `endBefore`, `QueryDocumentSnapshot`.
New exports: `editMessage`, `deleteMessageForMe`, `deleteMessageForEveryone`,
`toggleMessageReaction`, `markMessageDelivered`, `pinConversation`, `archiveConversation`,
`muteConversation`, `leaveGroupConversation`, `blockUser`, `reportConversation`,
`setTypingStatus`, `subscribeTypingStatus`, `fetchOlderMessages`.
Updated: `sendMessage` now accepts full opts (replyToId, mediaUrl, sharedPost, etc.).
Updated: `subscribeMessages` uses `docToMessage` helper + `QueryDocumentSnapshot` pagination cursor.
Updated: `docToConversation` maps all new fields.

**Why:** sendMessage needed to stay backwards-compatible; all new fields are optional in Firestore
writes and default to null. Older documents without these fields gracefully return undefined.

## cloudinary.ts
Added `uploadMedia(fileOrBlob, folder, resourceType)` — handles image/video/audio.
'voice' added to `UploadFolder` union.

## Hooks
- `useMessages` — exposes: sendMessage(content, type, opts), editMessage, deleteForMe,
  deleteForEveryone, toggleReaction, notifyTyping, stopTyping, loadOlderMessages.
  Also returns: typingUserIds, hasOlderMessages, loadingOlder.
- `useConversations` — added: pinConversation, archiveConversation, muteConversation.
- `useVoiceRecorder` — Web Audio API + MediaRecorder; start/stop/cancel;
  returns blob, duration (secs), waveform (32 normalized bars).

## Chat.tsx patterns
- Early return guard `if (!currentUser) return null;` → immediately alias as `const cu = currentUser`
  for use in closures (TypeScript doesn't narrow through function scopes).
- `LocalMsg extends Message` with `pending?: boolean` and `localMediaUrl?: string`.
- Voice messages: tap mic → VoiceRecordingUI → stop → uploadMedia to Cloudinary → sendMessage.
- Long-press bubble → BubbleActionSheet (Reply, Edit, Copy, Delete for me, Delete for everyone).
- Delete-for-everyone limited to own messages within 30 min (canEditOrDeleteForEveryone).
- Calling buttons → ComingSoonSheet (not implemented yet).
- Safety menu (⋯ header button) → SafetyMenuSheet: mute, block, report, leave.

## Messages.tsx patterns
- Conversations sorted: pinned first, then unpinned, then archived (collapsed section).
- Long-press ConvItem → ConvActionSheet (pin, archive, mute, delete).
- lastMsgLabel() → converts lastMessageType to emoji prefix (📷/🎥/🎤/📌).
- Mute indicator (BellOff icon) in conversation row.

## AppShell.tsx
- In-app MsgToast watches conversations for new unread that appears while not viewing that conv.
- Only one toast at a time; auto-dismisses after 4s.

## Home.tsx ShareSheet
- "Send via Chats" opens ConvPickerSheet (multi-select conversations).
- Sends `post_share` message via `fsSendMessage` with `sharedPost` payload.
