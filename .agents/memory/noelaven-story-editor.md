---
name: Noelaven story editor
description: Full-screen story editor architecture — layers, crop, trim, toolbar extension pattern.
---

# Story editor architecture

## Data flow
`Home` → `StoryCreator` (media picker, `onMediaReady`) → `StoryEditor` (fullscreen, z-[90]) → uploads to Cloudinary → calls `useStories.publishStory()` with full payload → Firestore.

## Type ownership
`EditorLayer`, `CropData`, `TrimData` are defined in `src/components/stories/editor/types.ts`. `src/lib/stories.ts` imports them from there and re-exports. Use `@/lib/stories` as the single import point for callers outside the editor directory.

## Toolbar extension pattern
`TOOLBAR_TABS: ToolbarTabDef[]` in `editor/index.tsx` — push a new entry + implement a panel in `renderPanel()`. BottomToolbar renders "Soon" labels for `available: false` entries automatically. No shell changes needed.

## Z-index stack (full order)
- BottomNav: z-50
- Backdrop: z-[55]
- All bottom-sheet drawers: z-[60]
- StoryViewer: z-[80]
- StoryEditor: z-[90]
- Toast: z-[100]

## Layer storage
Stored as JSON array in Firestore `layers` field. Crop = `{ x, y, w, h }` in %. Trim = `{ start, end }` in seconds. Rendered as HTML/CSS at view time (no Cloudinary transform needed).

**Why:** Same approach as Instagram/Snapchat — keeps source data editable, avoids re-upload on every edit.

## GestureLayer
Uses Pointer Events API (not touch events) — works identically on mouse and touch. setPointerCapture ensures drag continues off-element. Positions in %, canvasRef required for px↔% conversion.
