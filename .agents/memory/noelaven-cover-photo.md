---
name: Noelaven cover photo editor
description: Profile cover photo — upload, drag-to-reposition, remove, Firestore persistence.
---

# Cover photo architecture

## Data model
`User.coverUrl: string` — Cloudinary URL or '' (empty = gradient fallback).
`User.coverPosition?: { x: number; y: number }` — CSS object-position percentages (0–100). Defaults to { x: 50, y: 50 }. Stored in Firestore as `coverPosition` field.

## Firestore
`docToUser` in `firestore.ts` reads `coverPosition` with `?? { x: 50, y: 50 }` default.
`updateUserDoc` (unchanged) already spreads `Partial<User>` so `coverPosition` is saved automatically.
New users get `coverUrl: ''` in `createUserDoc`.

## Component
`src/components/profile/CoverPhotoEditor.tsx` — bottom sheet (z-[60]).
- Drag-to-reposition: Pointer Events on a 3:1 preview div; position stored as % mapped to CSS `object-position`.
- Upload flow: pick file → local `URL.createObjectURL` preview → upload to Cloudinary only on Save.
- Remove: calls `onSave({ coverUrl: '', coverPosition: { x:50, y:50 } })` directly (no Cloudinary delete).
- Demo mode: repositioning mock covers works; upload button disabled when Cloudinary not configured.

## Profile.tsx wiring
- "Edit Cover" pill button at bottom-left of cover area (own profile only), z-10.
- Cover image now has `objectPosition: x% y%` applied.
- `handleCoverSave` calls `updateUser({ coverUrl, coverPosition })`.
- Editor uses user's gradient colours as the fallback background in the preview.

**Why store position instead of cropping server-side:** Avoids re-upload on every reposition; CSS object-position is instantaneous and resolution-independent.
