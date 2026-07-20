---
name: Noelaven Cloudinary integration
description: Cloudinary image upload wiring — preset name, upload flows, and GradientAvatar src prop pattern.
---

## Cloudinary upload preset
- Cloud name: stored in `VITE_CLOUDINARY_CLOUD_NAME` secret
- Upload preset: stored in `VITE_CLOUDINARY_UPLOAD_PRESET` secret — confirmed unsigned preset named `Noelaven_uploads`
- Note: the secret originally had a typo (`Noelaven_uploadads`) that was corrected

**Why:** Unsigned presets are required for browser-side uploads (no backend signing needed). Data URLs (base64) are NOT allowed by this preset — only FormData File objects work.

## Upload utility
- `artifacts/noelaven/src/lib/cloudinary.ts` — `uploadImage(file, folder)` using FormData POST
- `isCloudinaryConfigured` exported boolean — gates all upload UI (image button disabled when false)
- After adding/changing Cloudinary secrets, **Vite must be restarted** to pick them up

## GradientAvatar src prop pattern
- `GradientAvatar` accepts `src?: string` — renders `<img>` when set, gradient initials otherwise
- **Every** GradientAvatar that represents a user with a potential avatarUrl must pass `src={user.avatarUrl || undefined}`
- Missing `src` props cause avatars to stay as gradient initials even after upload
- Files that had avatarUrl wired: Home.tsx (composer, stories, PostCard author, comments), Profile.tsx (header, EditProfileDrawer), Settings.tsx (profile card), AppShell.tsx (sidebar)

## Upload flows
1. **PostComposer (Home.tsx)** — image icon triggers hidden file input; `imageUrl` state; preview + X button; `onPost(content, imageUrl?)` signature; `handleNewPost(content, imageUrl?)` passes to `addPost(content, { imageUrl })`
2. **EditProfileDrawer (Profile.tsx)** — avatar circle click triggers hidden file input; `avatarUrl` state; `onSave` includes avatarUrl diff; `updateUser` writes to Firestore
3. **Settings.tsx** — avatar click + "Change photo" link trigger hidden file input; `updateUser({ avatarUrl })` + toast

**How to apply:** When adding new avatar displays, always pass `src={user.avatarUrl || undefined}`. When adding new upload surfaces, use `uploadImage(file, folder)` + hidden file input pattern.
