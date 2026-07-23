---
name: Noelaven cover photo
description: Cover photo editor and display — layout, pointer-event architecture, storage format.
---

## Storage
`coverPosition: { x: number; y: number; zoom: number }` in Firestore.
- `x`, `y`: CSS objectPosition percentages (0–100). Centre = 50.
- `zoom`: CSS scale multiplier (≥ 1, default 1).
`coverUrl`: Cloudinary URL (or '' when removed).

## CSS rendering (Profile.tsx)
```css
objectFit: cover;
objectPosition: x% y%;
transform: scale(zoom);
transformOrigin: x% y%;
```
Container must have `overflow-hidden` to clip zoomed image.

## CoverPhotoEditor layout (z-[70], full-screen)

Five layers stacked in `position:absolute`:

1. **Drag surface** (`ref={containerRef}`, `position:absolute inset-0`, `touchAction:none`)
   - Image inside with objectFit:cover + scale + transformOrigin.
   - Receives onPointerDown/Move/Up. `setPointerCapture` ensures tracking across the full screen.

2. **Overlay** (`pointer-events:none`, `top:safe+56px`, `bottom:200px`)
   - Flex-column: dim-above (flex-1) | 3:1 frame | dim-below (flex-1 with instruction pill).
   - Frame has white border (3px), corner accent squares (18×18px), rule-of-thirds grid, "Profile cover preview" pill label.
   - Instruction: "☝️ Move and zoom your photo" + "Drag to reposition · Pinch to zoom" shown in the dim-below area.

3. **Title bar** (`position:absolute top-0`, `z-30`, `pointer-events:auto`)
   - "Cancel" text button (left) + "Edit Cover Photo" title pill (center) + spacer (right).
   - Gradient fade to transparent below it.

4. **Bottom controls** (`position:absolute bottom-0`, `z-30`, `pointer-events:auto`, `bg-black/88`)
   - Secondary row: "Change Photo" + "Remove Photo" buttons.
   - Primary: large "Save Cover Photo" button (full width, 17px padding, gradient).
   - Shows uploading/saved states. Error message above.

**Why pointer-events-none on overlay**: the drag surface sits underneath; buttons get pointer-events-auto so they intercept taps without affecting drags.

## Pointer-event safety (crash fix)
`dragAnchor.current` is snapshotted into a local `const anchor` BEFORE calling `setPos`.
`setPos` updater uses only plain captured numbers — never reads the ref.
Same pattern for `pinchAnchor.current` → `const anc`.

**Why**: React state updaters run asynchronously. `onPointerUp` nulls the ref between the guard check and the updater execution, causing "Cannot read properties of null".

## Backward compatibility
`docToUser` reads zoom with `?? 1` fallback.
`Profile.tsx` passes `currentPosition ?? { x:50, y:50, zoom:1 }` to editor.
