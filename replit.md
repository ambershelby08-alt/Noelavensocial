# Noelaven

A vibrant, full-featured social platform where people connect, create, and belong. Mission: build a healthier internet.

## Run & Operate

- `pnpm --filter @workspace/noelaven run dev` — run Noelaven frontend (port 22018)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS v4, Framer Motion, Wouter routing
- Backend (planned): Firebase Auth, Firestore, Firebase Storage
- UI: shadcn/ui + Radix, Lucide icons, Inter font
- State: React Context (AuthContext), TanStack Query

## Where things live

- `artifacts/noelaven/` — main Noelaven social platform app
- `artifacts/noelaven/src/pages/` — all page components (Home, Profile, Communities, Messages, Discover, Notifications, Settings, Login, Chat, CommunityFeed)
- `artifacts/noelaven/src/lib/firebase.ts` — Firebase config + `isFirebaseConfigured` check
- `artifacts/noelaven/src/lib/mockData.ts` — mock users, posts, communities, messages, notifications
- `artifacts/noelaven/src/contexts/AuthContext.tsx` — auth context (demo mode when Firebase not configured)
- `artifacts/noelaven/src/components/layout/` — AppShell, Sidebar, BottomNav, AppRouter
- `artifacts/api-server/` — Express API server (unused in current build, Firebase handles backend)
- `lib/db/` — PostgreSQL + Drizzle ORM (unused, Firebase is the database)

## Architecture decisions

- Firebase SDK is called directly from the frontend (no API server for social data)
- `isFirebaseConfigured` detects placeholder env vars so demo mode works out of the box
- Demo mode auto-logs in as "Jane Doe" (id: demo-user) with full mock data
- Auth context initializes synchronously in demo mode (no loading delay)
- Mobile-first: bottom nav on mobile, left sidebar on desktop

## Product

- **Home Feed**: Daily Spark card, post composer, infinite feed with like/comment/share/save
- **Profile**: Cover photo, avatar, bio, interests, followers, achievement badges, edit profile
- **Communities**: Browse, create, join, community feeds with rules and moderators
- **Messages**: Chat list, 1:1 and group chats, typing indicator, emoji reactions, image sharing
- **Discover**: Search users/communities, trending topics, suggested friends, recommended creators
- **Notifications**: Likes, comments, follows, community invites, Daily Spark reminders
- **Settings**: Account, privacy, notifications, theme, accessibility, blocked users, help center

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Set real Firebase env vars via Secrets to enable live auth/database: `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`
- The placeholder env vars set in Shared env intentionally trigger demo mode (non-placeholder detection in `firebase.ts`)
- CSS gradient utilities `.gradient-bg` and `.gradient-text` are defined in `index.css` bottom

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
