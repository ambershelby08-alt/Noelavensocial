---
name: Noelaven Founder System
description: Founder UID, role initialization, FounderBadge, Firestore security rules, and moderation architecture.
---

## FOUNDER_UID
`OJzzcq17QLRreaEINhQ2czxhtQ23` — hardcoded in two authoritative places:
1. `src/lib/founder.ts` — `FOUNDER_UID` constant; `isFounderUid(uid)` helper; `ensureFounderRole()` sets Firestore docs
2. `firestore.rules` — `isFounder()` function (line ~7) hardcodes the same string server-side

**Why:** Security must be enforced by Firestore Security Rules (server-side), not solely by client code. The UID is duplicated intentionally so neither location alone is the trust boundary.

**How to apply:** Never check `user.isFounder` profile field or `user.displayName` to determine founder status — always use `isFounderUid(uid)` or the Firestore `isFounder()` function.

## AuthContext integration
- `isFounder: boolean` added to `AuthContextType` — computed as `isFounderUid(currentUser?.id)`
- On Founder sign-in, `ensureFounderRole()` is called (sets `roles/founder`, `users/{uid}` role fields, `admins/{uid}`)
- Import: `const { isFounder } = useAuth()`

## FounderBadge component
- Path: `src/components/ui/FounderBadge.tsx`
- Props: `userId`, `size` ('xs'|'sm'|'md'|'lg'), `showLabel`
- Renders **nothing** if `userId !== FOUNDER_UID` — completely safe to include anywhere
- Purple-gold gradient crown; tooltip on hover/tap
- Injected in: PostCard author (Home.tsx), comment author (Home.tsx), Profile displayName, Profile followers/following list

## Report schema (enhanced)
`Report` type in `mockData.ts` now includes:
- `reportedUserId`, `parentContentId`, `conversationId` (nullable strings)
- `evidence: { textSnapshot, mediaUrl, authorId }` (all nullable)
- `priority: 'low'|'medium'|'high'|'urgent'`
- `assignedModeratorId`, `resolution`, `moderationActionId`, `reviewedAt`, `resolvedAt` (all nullable)
- `ReportType` now includes `'reply'` and `'dailySpark'`
- Any Record<ReportType, …> map must include these two keys or TS will error

## safety.ts functions
New functions added (all Firestore-backed with localStorage demo fallback where applicable):
- `assignReport(reportId, moderatorId)` — sets status to 'reviewing'
- `updateReportPriority(reportId, priority)`
- `sendWarning(userId, moderatorId, reason, reportId?)`
- `restrictAccount(userId, moderatorId, reason, reportId?)`
- `removeContent(targetId, targetType, moderatorId, reason, reportId?)`
- `restoreContent(targetId, targetType, moderatorId, reason)`
- `getSuspendedUsers()` → non-permanent active suspensions
- `getBannedUsers()` → permanent active suspensions
- `unbanUser(userId, moderatorId, reason)`
- `checkIsAdmin()` — checks FOUNDER_UID first, then `admins/{uid}` Firestore doc

## ModerationDashboard
Full rebuild at `src/pages/ModerationDashboard.tsx`:
- Tabs: Pending | Under Review | Resolved | Dismissed | Suspended | Banned | Log
- Gate: `checkIsAdmin()` + `isFounder` from context; shows access-denied screen if neither
- Per-report: expandable actions panel, all 9 actions with ConfirmModal (reason required for ban/suspend/remove)
- ConfirmModal: suspension duration picker (1/7/14/30/90 days), reason textarea, danger styling

## Settings.tsx additions
- **Founder Control Center**: dark purple-gold card, visible only when `isFounder`, links to `/moderation`
- **Change Email**: inside Security panel, uses Firebase `updateEmail`; shows re-auth error gracefully
- **Download My Data**: exports profile JSON; note that full data is server-side (24h email)
- **Delete Account**: requires typing "DELETE" to confirm; uses Firebase `deleteUser`; handles re-auth error

## firestore.rules (at workspace root)
Key protections:
- `users/{uid}` update: blocks `role`, `isFounder`, `isAdmin`, `isModerator`, `suspended`, `banned` fields
- `reports`: users create own (reporterId == auth.uid); mods read all; reporters read own; status update by mods only
- `moderationActions`: mods can create/read; **no update or delete** (immutable audit log)
- `admins/{uid}`: only Founder can write
- `roles/{doc}`: only Founder can write
