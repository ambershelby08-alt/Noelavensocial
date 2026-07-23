---
name: Noelaven StoryCreator queue
description: StoryCreator component design — queue UX, picker, thumbnail strip, + tile.
---

## Component: StoryCreator (`src/components/stories/StoryCreator.tsx`)

### UX contract
1. Empty state: large dashed upload area with "Add Photos or Videos" button.
2. After picking: horizontal thumbnail strip with numbered-badge tiles.
3. Last tile in the strip is always a `+` tile → `openPicker()`.
4. "Add another photo or video" row button shown below the strip (always visible after first pick).
5. "Share N Stories →" gradient CTA + "Cancel" text link at bottom.

### Single picker function
`openPicker()` creates an `<input type="file" multiple accept="image/*,video/*">`.
On iOS/Android this opens the native media picker with multi-select.
Files are categorized by MIME: `f.type.startsWith('video/')` → `'video'`, else `'image'`.
No separate "photos" vs "video" pickers — one button covers both.

### Blob URL lifecycle
- `blobUrls` ref tracks all created blob URLs.
- `removeItem(id)` immediately revokes the removed item's blob URL.
- `handleClose()` revokes all remaining blob URLs.
- `handleContinue()` clears the tracking set WITHOUT revoking — ownership passes to the parent (Home's storyQueue state).

### StoryPickItem type
```ts
{ id: string; file: File; previewUrl: string; mediaType: StoryMediaType }
```
`id` is a monotonic counter string (`uid()`), stable for React keys.

### Integration (Home.tsx)
`onMediaReady(items)` → `setStoryQueue(items)` + `setStoryQueueTotal(items.length)`.
StoryEditor is keyed by `storyQueueTotal - storyQueue.length` so it remounts for each segment.
After each publish, `storyQueue` is sliced by 1; when empty, `storyQueueTotal` resets to 0.
