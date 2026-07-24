---
name: Noelaven Safety & Moderation
description: Full safety/moderation system — block/mute/restrict/report, SafetyContext, SafetySettings page, ModerationDashboard, MyReports, content filter, spam detection.
---

## What was built

### New files
- `src/lib/safety.ts` — Firestore + localStorage ops: block, unblock, mute, unmute, restrict, unrestrict, submitReport, getUserReports, getPendingReports, updateReportStatus, suspendUser, banUser, removeContent, getModerationLog, checkIsAdmin. All operations fall back to localStorage in demo mode.
- `src/lib/moderation.ts` — checkSpamRisk / recordPostAttempt (5 posts / 10 min window), filterContent (sensitivity: off|low|medium|high). Word lists are intentionally minimal stubs — replace with a real content moderation API in production.
- `src/contexts/SafetyContext.tsx` — Provides blockedIds, blockedByIds, mutedIds, restrictedIds, safetySettings, and all action functions (blockUser, unblockUser, muteUser, unmuteUser, restrictUser, unrestrictUser, updateSafetySettings). Exposes isBlocked(), isMuted(), isRestricted(), canInteract() helpers. SafetyProvider wraps AuthenticatedApp in AppRouter.
- `src/components/ui/ReportSheet.tsx` — Multi-step report bottom-sheet (reason → details → submitting → success). Props: open, onClose, targetId, targetType, targetOwnerId, targetPreview, reporterId, onSubmitted.
- `src/pages/SafetySettings.tsx` — Full Safety & Privacy settings page at /safety. Sections: Privacy Controls (whoCanMessage/Comment/Mention, allowFollows), Content Filter (4-level sensitivity), Blocked/Muted/Restricted user lists with inline action buttons. Links to /my-reports.
- `src/pages/MyReports.tsx` — User's submitted reports at /my-reports. Status filter chips, report cards with type badge + status badge + content preview + moderator note.
- `src/pages/ModerationDashboard.tsx` — Admin-only at /moderation. Checks isAdmin() before rendering. Tabs: Reports queue (filter by status, actions: Dismiss/Remove/Suspend 30d/Ban) and Activity Log.

### Updated files
- `src/lib/mockData.ts` — Added types: ReportType, ReportReason, ReportStatus, ModerationActionType, Report, ModerationLog, SafetySettings interfaces.
- `src/components/layout/AppRouter.tsx` — Added SafetyProvider wrapping AuthenticatedApp + routes /safety, /my-reports, /moderation.
- `src/pages/Home.tsx` — PostMenu now has: Mute @handle, Block @handle, Report post (opens ReportSheet), confirmBlock/confirmMute steps. Removed inline reportSelect step. useSafety() provides isBlocked/isMuted checks. ReportSheet rendered at page level when reportTarget is set.
- `src/pages/Profile.tsx` — MoreHorizontal button added to non-own profile header. Tapping opens a SafetyActionSheet with Mute/Restrict/Block/Report Profile actions. ReportSheet shown for profile reports.
- `src/pages/Settings.tsx` — Privacy item replaced with "Safety & Privacy" item (key: 'safety') that navigates to /safety. Inline privacy panel disabled.

## Key decisions

**Admin check**: `checkIsAdmin()` queries Firestore `admins/{userId}` doc. In demo mode, user-1 and demo-user are treated as admin.

**Block enforcement**: Blocks are currently enforced at the UI level (SafetyContext filters). Full Firestore security rules would require backend rules deployment.

**Mute semantics**: Muted users' posts are filtered from the feed. Muted users can still see your profile (soft block pattern).

**Demo mode persistence**: All safety data (blocks/mutes/restrictions/settings/reports) uses localStorage keys with `nlv_` prefix when Firebase is not configured.

**SafetyProvider placement**: Wraps inside `AuthenticatedApp` (after auth check, before CallProvider + AppShell). This ensures `useAuth()` is available when SafetyContext subscribes.

**Why:**
- Firestore security rules approach needed for full enforcement but out of scope for client-only implementation.
- localStorage fallback ensures demo mode users can test all safety flows without Firebase.
