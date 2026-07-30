---
name: Noelaven Post Composer
description: Architecture of the full-featured PostComposer component, its data layer, and how mentions/location flow.
---

## Component location
`artifacts/noelaven/src/components/ui/PostComposer.tsx`
Extracted from the old inline definition in Home.tsx. Import it as `import { PostComposer } from '@/components/ui/PostComposer'`.

## onPost signature
```ts
onPost(content, imageUrl?, audience?, mentionedUserIds?, location?)
```
`handleNewPost` in Home.tsx accepts all five args, passes mentions + location to `addPost`, then fires `fsWriteNotification(..., 'mention', ...)` per mentioned user.

## @Mention autocomplete
- Detects `/@(\w*)$/` before cursor on every `onChange`
- Debounced 200ms call to `searchUsers(query)` from `@/lib/firestore`
- `insertMention(user)` replaces the `@partial` text and stores `{ id, handle }` in `mentionedUsers` state
- At submit time, only users whose `@handle` still appears in the final text get notifications
- Mention button (AtSign icon) inserts `@` at cursor + immediately shows suggestions

## Emoji picker
- 6 category tabs (smileys, hearts, hands, nature, fun, food) — static data, no external library
- Inserts at cursor using `selectionStart/selectionEnd` + `requestAnimationFrame` restore
- Uses `emoji.length` (UTF-16 code units) for correct cursor positioning after multi-codepoint emoji

## Location picker
- "Use current location" → `navigator.geolocation` → Nominatim reverse-geocode
  (`https://nominatim.openstreetmap.org/reverse`)
- Place name search → Nominatim forward search with 400ms debounce
  (`https://nominatim.openstreetmap.org/search`)
- Falls back to "Use '<typed text>'" when search returns empty
- Location stored as `{ name, lat?, lng? }` on the post

## Data layer
- `Post` type (`mockData.ts`): `mentions?: string[]`, `location?: { name, lat?, lng? } | null`
- `createPost` (`firestore.ts`): accepts `mentions` + `location` in opts, writes both to Firestore
- `addPost` (`useFeed.ts`): passes `mentions` + `location` through to `fsCreatePost`
- `docToPost` maps both fields on read

## Post card display
- Location badge (pink MapPin + name) shown between image and action bar when `post.location?.name` is set
- Audience indicator shown inline with timestamp for non-public posts (Mutuals/Followers/Only Me)

## AUDIENCE_OPTIONS
Defined in `PostComposer.tsx` (exported) AND kept locally in `Home.tsx` for `SparkModal`.
Both are identical static arrays — duplication is intentional to avoid cross-file coupling.
