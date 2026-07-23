---
name: Noelaven story editor
description: Full story editor architecture — types, components, hooks, and integration points.
---

## Architecture

- `StoryCreator` — media picker sheet only. Calls `onMediaReady(items: StoryPickItem[])` with an array for multi-select (images) or single (video).
- `StoryEditor` — fullscreen editing surface (z-[90]). Props: `file`, `previewUrl`, `mediaType`, `currentIndex`, `total`, `onPublish`, `onClose`.
- `StoryViewer` — fullscreen viewer (z-[80]). Progress bar uses photo=5000ms or video duration from `onLoadedMetadata`. Filter CSS applied via `filterCSS(story.filterName)`.

## Editor components (under `src/components/stories/editor/`)
- `types.ts` — canonical types: `TextLayer`, `StickerLayer`, `EditorLayer`, `CropData`, `TrimData`, `FilterPreset` (string union), `EditorState`, etc.
- `filters.ts` — `FILTER_DEFS`, `FilterPreset` type, `filterCSS()` helper; 9 presets.
- `useEditorState.ts` — `useReducer` hook; actions: ADD/UPDATE/DELETE/SELECT layer, SET_CROP, SET_TRIM, SET_FILTER, UNDO, SET_VIDEO_DURATION.
- `GestureLayer.tsx`, `BottomToolbar.tsx`, `TextPanel.tsx`, `EmojiPanel.tsx`, `CropOverlay.tsx`, `VideoTrimmer.tsx`, `FilterPanel.tsx`, `MusicPanel.tsx`, `EditorCanvas.tsx`, `index.tsx`.

## `index.tsx` import rule
**Why:** `filterCSS` must be a top-level import — `require('./filters')` fails in ESM/Vite.
**How to apply:** Always import `filterCSS` at the file top, not inside component logic.

## Multi-story queue (Home.tsx)
`storyQueue: StoryPickItem[]` + `storyQueueTotal: number` — advances after each `onPublish`. StoryEditor key includes queue position so it remounts fresh per segment.

## Data stored in Firestore story doc
`layers[]`, `cropData`, `trimData`, `filterName` (string preset), `mediaType`, `mediaUrl`, `caption`.

## `publishStory` signature
`publishStory(mediaUrl, mediaType, caption, layers, cropData, trimData, filterName)` — all params optional except first three.
