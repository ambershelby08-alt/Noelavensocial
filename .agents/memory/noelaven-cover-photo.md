---
name: Noelaven cover photo
description: Cover photo editor and display — layout, pointer-event architecture, storage format.
---

## Storage
`coverPosition: { x: number; y: number; zoom: number }` in Firestore.
- `x`, `y`: CSS objectPosition percentages (0–100). Centre = 50.
- `zoom`: CSS scale multiplier (≥ 1, default 1).
`coverUrl`: Cloudinary URL (or '' when removed).
Only one editor exists: `src/components/profile/CoverPhotoEditor.tsx`.

## CSS rendering (Profile.tsx)
```css
objectFit: cover;
objectPosition: x% y%;
transform: scale(zoom);
transformOrigin: x% y%;
```
Container must have `overflow-hidden` to clip zoomed image.

## CoverPhotoEditor layout (z-[70], full-screen flex-col using 100dvh)

Three flex children — no absolute pixel offsets, no `calc()`:

### ① Instruction bar (`flexShrink: 0`, ~72px)
- Left: "Cancel" text button (outlined pill)
- Center: "Move and zoom your photo" + "Drag to reposition · Pinch to zoom"
- Right: circular Save icon button (gradient when canSave, dim otherwise)
- `background: rgba(0,0,0,0.92)` + `backdropFilter: blur(12px)`

### ② Interactive zone (`flex: 1`, `minHeight: 0`)
- Image: `position:absolute inset-0`, `objectFit:cover`, `objectPosition:x% y%`, `scale(zoom)`, `transformOrigin:x% y%`, `pointerEvents:none`
- Dim overlay: `position:absolute inset-0 flex flex-col pointer-events-none`
  - `flex-1` black div (top dim, ~70% opacity)
  - `aspectRatio:'3/1'` div — the crop frame: white 2px border, 4 Corner L-marks (22×22px), rule-of-thirds grid, "Cover frame" pill label
  - `flex-1` black div (bottom dim)
- The crop frame is **always centered in ② by flexbox** — no pixel math, works on any screen height.

### ③ Bottom bar (`flexShrink: 0`, ~230px)
- Live cover preview: 3:1 strip with identical image CSS → real-time preview of saved result
- Secondary row: "Change Photo" + "Remove" half-width buttons
- Primary: "Save Cover Photo" full-width gradient button (56px tall)
- `background: rgba(0,0,0,0.92)` + `backdropFilter: blur(16px)`

## Pointer-event safety (crash fix — MUST NOT revert)
`dragAnchor`/`pinchAnchor` refs are snapshotted into plain local `const` values
**before** every `setPos(...)` call. The updater function reads ONLY those captured
values — never the ref itself.

**Why:** React state updaters are async. `onPointerUp` nulls the ref between the
guard check and updater execution → "Cannot read properties of null (reading 'posX')".

```ts
// CORRECT
const a = drag.current; if (!a) return;
const ox = a.ox, oy = a.oy;            // plain numbers
setPos(p => ({ ...p, x: clamp(ox - ..., 0, 100) }));

// WRONG — crashes
setPos(p => ({ ...p, x: clamp(drag.current!.ox - ...) }));
```

## Backward compatibility
`docToUser` reads zoom with `?? 1` fallback — old Firestore docs without zoom render correctly.
Profile.tsx passes `currentPosition ?? { x:50, y:50, zoom:1 }` to editor.
