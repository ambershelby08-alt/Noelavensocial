---
name: Noelaven Story Composer
description: Architecture of the story creation flow — StoryComposer replaces StoryCreator + StoryEditor in the "Add Story" path.
---

## Flow

```
StoriesRow "Add Story" tap
  → storyPickerRef.current.click()   (hidden input in Home.tsx, BEFORE any UI opens)
  → onChange fires → setComposerItems([...])
  → StoryComposer mounts (AnimatePresence, z-60)
      thumbnails | + Add More | ↑↓ reorder | × remove | Publish All
  → onPublishItem(item): upload to Cloudinary + publishStory()
  → onAllPublished(): setComposerItems([]) + setViewingGroupIdx(ownIdx)
  → StoryViewer opens (z-80)
```

## Why phantom clicks are impossible

The OS file picker fires from `storyPickerRef.current.click()` BEFORE StoryComposer mounts.
No backdrop exists during selection, so the phantom click from picker-close has nothing to hit.
The internal "+ Add More" picker in StoryComposer uses the same pattern (persistent JSX ref).

## Key files

- `src/components/stories/StoryComposer.tsx` — new component (replaces StoryCreator + StoryEditor in this flow)
- `src/pages/Home.tsx` — hidden `<input ref={storyPickerRef}>`, `composerItems` state, `openOwnStoriesAfterPublish` state
- `src/lib/cloudinary.ts` — `uploadStoryMedia(file)` handles both image and video endpoints

## Post-publish navigation

`openOwnStoriesAfterPublish` boolean + `useEffect` watching `storyGroups`:
when the Firestore subscription delivers the new story, the effect fires and calls `setViewingGroupIdx(ownIdx)`.
This handles the race where Firestore hasn't updated yet when `onAllPublished` fires.

## What was retired (files kept, not wired)

- `StoryCreator` — still exists, no longer imported by Home.tsx
- `StoryEditor` — still exists, no longer wired into Home.tsx story flow

## StoriesRow behavior (unchanged)

- `ownGroup` exists → tap opens StoryViewer (view existing stories)
- `ownGroup` null → tap triggers picker → StoryComposer
