---
name: Noelaven Firebase integration
description: Architecture decisions for the full Firebase Auth + Firestore integration in Noelaven.
---

## What was built

- `src/lib/firestore.ts` — all Firestore CRUD + real-time subscriptions (posts, users, communities, conversations, messages, notifications, seed)
- `src/contexts/AuthContext.tsx` — fully rewritten; wraps Firebase `onAuthStateChanged`, email/password, Google sign-in, profile creation flow
- `src/hooks/useFeed.ts` — subscribes to posts collection with liked/saved subcollections
- `src/hooks/useProfile.ts` — resolves user doc + user posts via Firestore
- `src/hooks/useCommunities.ts` — subscribes to communities with joined subcollection
- `src/hooks/useConversations.ts` — subscribes to user's conversations
- `src/hooks/useMessages.ts` — subscribes to a conversation's messages subcollection
- `src/hooks/useNotifications.ts` — subscribes to per-user notifications
- All 6 pages (Home, Profile, Communities, Messages, Chat, Notifications) updated to use hooks instead of direct mockData imports

## Demo/fallback pattern

Every hook checks `isFirebaseConfigured` from `src/lib/firebase.ts`. When false (placeholder env vars), hooks return mock data and all writes are local-only. This keeps demo mode fully functional without Firebase.

**Why:** The app must run without Firebase credentials for demos and development; the `isFirebaseConfigured` guard is the single source of truth.

## Auth flow

1. `signUp` → Firebase creates user → `onAuthStateChanged` fires → no Firestore profile found → `isNewUser = true` → app routes to `CreateProfile`
2. `completeProfile` → writes Firestore user doc with handle/bio/interests → sets `currentUser`
3. `signIn` / `signInWithGoogle` → `onAuthStateChanged` fires → fetches profile → if profile has `handle` → `currentUser` set; else → `isNewUser = true`

## Firebase Console prerequisites (user must do these)

- Enable Email/Password auth provider
- Enable Google auth provider (add authorized domain)
- Create Firestore database (production or test mode)
- Set Firestore security rules (allow authenticated reads/writes)

## Firestore schema

| Collection | Key fields |
|---|---|
| `users/{uid}` | displayName, handle, bio, interests, followers, following, postCount, badges |
| `posts/{postId}` | authorId, content, likes, comments, shares, createdAt |
| `users/{uid}/liked_posts/{postId}` | likedAt |
| `users/{uid}/saved_posts/{postId}` | savedAt |
| `users/{uid}/joined_communities/{communityId}` | joinedAt |
| `communities/{communityId}` | name, description, category, memberCount |
| `conversations/{convId}` | type, participantIds, lastMessage |
| `conversations/{convId}/messages/{msgId}` | senderId, content, createdAt |
| `notifications/{notifId}` | userId, type, read |

## Seed

`seedCommunitiesIfNeeded()` in firestore.ts checks if communities collection is empty and populates from mockCommunities. Called once in AuthContext's useEffect when Firebase is configured.

**Why:** Avoids empty Communities page on first launch of a real Firebase instance.
