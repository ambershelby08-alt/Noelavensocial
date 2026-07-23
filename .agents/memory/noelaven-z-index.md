---
name: Noelaven overlay z-index stack
description: The required z-index hierarchy for all fixed overlays in Home.tsx and AppShell.tsx; violating it causes modals to appear behind their own backdrop.
---

## Stack (low → high)

| Layer | z-index | Notes |
|---|---|---|
| BottomNav (AppShell) | 50 | Floating pill nav, md:hidden |
| Backdrop (Home.tsx shared) | 55 | Dims everything including nav |
| All bottom-sheet drawers | 60 | CommentsDrawer, SparkModal, ShareSheet, PostMenu, EditPost, StoryCreator |
| StoryViewer | 80 | Fullscreen — must be above all drawers |
| Toast notifications | 100 | Always on top |

## Why

The BottomNav is `z-50` and renders later in the DOM than page content, so any drawer also at `z-50` gets painted over by the nav. After the Backdrop was raised to `z-[55]` (to cover the nav), every drawer must be `z-[60]` or the backdrop renders on top of the drawer content — producing a blurred overlay with invisible modal. StoryViewer is fullscreen and must be above all drawers, so `z-[80]`.

## How to apply

Any new fixed overlay in Home.tsx must use `z-[60]`. Any new overlay that should appear above drawers (e.g. a confirmation dialog) must use `z-[70]` or higher. The StoryViewer is `z-[80]`. Never add `z-50` to a new sheet.

`pb-safe` is not a real Tailwind class in this project — always use `style={{ paddingBottom: 'max(env(safe-area-inset-bottom), Npx)' }}` on drawer footers.
