---
name: Noelaven offline handling
description: NetworkContext + OfflineScreen + NetworkBanner for Capacitor WebView offline app-store compliance.
---

# Offline handling architecture

## The rule
The Capacitor app loads from a remote URL (`noelaven.com`). Without in-app offline handling the WebView shows a browser "Webpage not available" error — an app store rejection risk under Apple Guideline 4.2.

**Why:** A "thin WebView wrapper" must demonstrate minimum functionality. A branded offline screen + reconnect flow satisfies the guideline.

## How to apply

### NetworkContext (`src/contexts/NetworkContext.tsx`)
- Uses `@capacitor/network` on native (iOS/Android) — subscribes via `Network.addListener('networkStatusChange', ...)`
- Falls back to `navigator.onLine` + `window 'online'/'offline'` events on web
- Exports `useNetwork() → { isOnline: boolean, isInitializing: boolean }`
- **Must be the outermost provider in App.tsx** so OfflineScreen can render before Auth/Firebase init

### OfflineScreen (`src/components/ui/OfflineScreen.tsx`)
- Full-screen branded overlay (dark + pink/purple gradient), z-[500]
- "Try Again" button: checks `navigator.onLine`, shows feedback if still offline
- Rendered via `<AnimatePresence>` in `AppShellWithNetwork` when `!isOnline`
- Inner app tree stays **mounted** (not conditionally rendered) so Firestore's `persistentLocalCache` can still serve cached data

### NetworkBanner (`src/components/ui/NetworkBanner.tsx`)
- Slim top bar (z-[490]) for mid-session drops: red "You're offline" persists; green "Back online" auto-dismisses after 2.5 s
- Tracks previous `isOnline` via `useRef` to distinguish "just went offline" vs "just came back"

### App.tsx wiring
```
NetworkProvider
  AppShellWithNetwork           ← reads useNetwork()
    NetworkBanner               ← always rendered (animates in/out)
    AnimatePresence > OfflineScreen  ← when !isOnline
    QueryClientProvider > ... > AppRouter
```

## Capacitor config note
`capacitor.config.ts` uses `server.url = 'https://noelaven.com'`. When this URL fails (offline cold launch), the OfflineScreen is already mounted from `main.tsx` through `App.tsx` before the WebView navigates, so it covers the error before the user sees it.
