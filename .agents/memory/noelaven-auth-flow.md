---
name: Noelaven auth flow gotchas
description: Subtle traps in the signup / new-account / completeProfile flow.
---

## completeProfile must clear addingAccount
`AuthContext.completeProfile()` must call `setAddingAccount(false)` in its success path. Without it:
- User signs up via the "Add Account" flow (addingAccount = true)
- Profile creation succeeds → isNewUser = false, currentUser is set
- AppRouter evaluates addingAccount AFTER the isNewUser guard, so it shows the Login page instead of the app
- The user is stuck in a redirect loop even though they are fully logged in

**Fixed**: `setAddingAccount(false)` is now called inside the `if (profile)` block of `completeProfile`.

## Signup.tsx must catch signUp errors
The `signUp` call can throw Firebase errors (email already in use, weak password, network failure). Without a try/catch, these are silently swallowed. The `handleSubmit` in Signup.tsx now wraps the call in try/catch and maps error messages to specific fields (email/password errors) or a general banner.

## AppRouter guard order matters
The guards are evaluated top-to-bottom:
1. `isNewUser && !currentUser` → CreateProfile
2. `addingAccount` → Login
3. `!currentUser` → Login (standard)

Any flag that is `true` during a transition can hijack routing. When adding new auth states, verify they don't fire during the success path of another flow.
