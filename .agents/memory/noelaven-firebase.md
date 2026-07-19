---
name: Noelaven Firebase demo mode
description: How Noelaven detects real vs. placeholder Firebase credentials and enters demo mode
---

## Rule
`isFirebaseConfigured` in `src/lib/firebase.ts` checks for placeholder strings explicitly. Shared env vars are set to placeholder values by default so the app runs in demo mode out of the box.

**Why:** Firebase initializes without error even with fake credentials, but auth flows hang if the app thinks it's configured when it isn't. Demo mode must activate before any auth listener is registered.

**How to apply:** When user provides real Firebase credentials, they must be set as Replit Secrets (not plain env vars), and the placeholder env vars in Shared must be deleted first to avoid conflicts. The six required secrets are: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`.

## Auth context pattern
- Demo mode: `currentUser` initialized synchronously from `mockUsers` (no loading delay). `isLoading` starts as `false`.
- Real Firebase: `isLoading` starts `true`, resolved by `onAuthStateChanged` (not yet wired — add when credentials are provided).
