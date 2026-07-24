---
name: Noelaven Multi-Account
description: How saved accounts, Add Account, and Switch Account work across AuthContext, AppRouter, Login, and Settings.
---

## Architecture

### `src/lib/accountStore.ts`
Pure localStorage helpers — no Firebase, no credentials.

- `nlv_saved_accounts` — `SavedAccount[]` (uid, email, displayName, handle, avatarUrl?)
- `upsertSavedAccount(account)` — called in `resolveUser` after a successful profile load
- `removeSavedAccount(uid)` — called from Switch Account sheet "Remove" button
- `nlv_switch_email` — ephemeral key: set before signing out to switch, cleared on Login mount

### AuthContext additions
- `savedAccounts: SavedAccount[]` — local state seeded from `getSavedAccounts()`, refreshed after every `resolveUser`
- `addingAccount: boolean` — flag that tells AppRouter to show Login even if a user is signed in
- `startAddAccount()` — just sets `addingAccount = true`; no sign-out happens
- `switchToAccount(account)` — writes `nlv_switch_email`, signs out Firebase, resets all auth state; AppRouter then shows Login with email pre-filled
- `signIn` / `signInWithGoogle` both call `setAddingAccount(false)` so the flag resets after any login
- `resolveUser` calls `setAddingAccount(false)` after setting `currentUser`

### AppRouter
Added a guard before the existing `!currentUser` block:
```typescript
if (addingAccount) { return <Switch> Login routes </Switch>; }
```
This shows Login even while Firebase still has an active user, enabling "Add Account" without sign-out.

### Login.tsx
Reads `nlv_switch_email` from localStorage at component initialisation (before first render) and clears it immediately. Pre-fills the email field. Shows "Add account / Sign in to another account" heading when `addingAccount = true`.

### Settings.tsx "Accounts" section
New first section with 4 action rows (no accordion, `onPress` field):
- **Add Account** → `startAddAccount()` → AppRouter shows Login with "Add account" heading
- **Switch Account** → opens Switch Account bottom sheet listing all `savedAccounts`
- **Manage Account** → opens Manage Account sheet (email, type, join date, delete-account info)
- **Sign Out** → existing confirmation sheet; `danger: true` renders red icon + label

The standalone "Sign Out" button that was at the bottom of the page has been removed; Sign Out lives only in the Accounts section now.

### Profile.tsx
Own-profile header now shows a `<Settings2>` gear icon (Link to `/settings`) to the LEFT of the Edit button. Gear is always visible on own profile (both mobile and desktop).

## Key decisions

**No credential storage** — Firebase Auth doesn't support multi-session. Switching requires re-authentication. We only store display metadata (never email+password). The `nlv_switch_email` key pre-fills the email field to reduce friction.

**Why `addingAccount` flag instead of a new route** — Adding `/add-account` as a public route would be simpler to route to, but it would mean duplicating the Login component or making AppRouter aware of a special route. The flag keeps all auth-guard logic in one place and avoids any route leakage.

**`User.email` is now optional** — Added `email?: string` to the User interface in mockData.ts. Firestore user docs include email; the `SavedAccount` type needs it for switch pre-fill and Manage Account display.
