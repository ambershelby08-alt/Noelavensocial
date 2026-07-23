---
name: Noelaven cover photo
description: Cover photo editor and display — storage format, CSS rendering, z-index.
---

## Storage
`coverPosition: { x: number; y: number; zoom: number }` saved in Firestore via `updateUserDoc`.
- `x`, `y`: CSS objectPosition percentages (0–100). Centre = 50.
- `zoom`: CSS scale multiplier (≥ 1, default 1).

`coverUrl`: Cloudinary URL (or '' when removed).

## CSS rendering (Profile.tsx and CoverPhotoEditor.tsx)
```css
objectFit: cover;
objectPosition: x% y%;
transform: scale(zoom);
transformOrigin: x% y%;
```
Container must have `overflow-hidden` to clip zoomed image.

## CoverPhotoEditor.tsx (fullscreen, z-[70])
- Full-screen overlay `fixed inset-0 z-[70] bg-black`.
- Single-pointer drag pans focal point (objectPosition x/y).
- Two-pointer pinch changes zoom (1–5).
- 3:1 crop-frame overlay via flex-column (spacer | aspect-ratio:3/1 frame | spacer) with rule-of-thirds grid.
- Upload only on Save — Cancel is non-destructive.
- Props: `currentCoverUrl`, `currentPosition: { x, y, zoom }`, `onSave`, `onClose`. No gradient props.

**Why:** Pure CSS transform avoids Cloudinary round-trips on reposition; objectFit:cover fills the container naturally.

## Backward compatibility
`docToUser` in firestore.ts reads zoom with `?? 1` fallback — old docs without zoom display correctly.
`Profile.tsx` passes `currentPosition={user.coverPosition ?? { x: 50, y: 50, zoom: 1 }}` to the editor.
