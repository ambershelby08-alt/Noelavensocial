/**
 * Safety & Moderation library — Firestore operations for
 * blocking, muting, restricting, reporting, and safety settings.
 * Falls back to localStorage in demo mode (isFirebaseConfigured = false).
 */
import {
  collection, doc, setDoc, deleteDoc, getDocs, addDoc,
  onSnapshot, serverTimestamp, query, where, orderBy, limit,
  Timestamp, updateDoc, getDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './firebase';
import { FOUNDER_UID } from './founder';
import type {
  ReportType, ReportReason, ReportStatus, ReportPriority,
  ReportEvidence, Report, ModerationLog, ModerationActionType,
  SafetySettings,
} from './mockData';

// ─── Index-building error ─────────────────────────────────────────────────────

/**
 * Thrown when a Firestore query fails because a required composite index
 * is still being built (or was never deployed).
 *
 * Callers should catch this and show a friendly "indexes still building" UI
 * rather than crashing or showing a generic error.
 */
export class IndexBuildingError extends Error {
  constructor(public readonly originalMessage?: string) {
    super('firestore_index_building');
    this.name = 'IndexBuildingError';
  }
}

/** Internal: re-throws as IndexBuildingError when the error signals a missing index. */
function rethrowIfIndexError(err: unknown): void {
  const code = (err as { code?: string })?.code ?? '';
  const msg  = (err as { message?: string })?.message ?? '';
  if (
    code === 'failed-precondition' ||
    msg.toLowerCase().includes('index') ||
    msg.toLowerCase().includes('requires an index')
  ) {
    throw new IndexBuildingError(msg);
  }
}

// ─── localStorage keys (demo mode) ───────────────────────────────────────────

const K = {
  blocked:    'nlv_blocked',
  muted:      'nlv_muted',
  restricted: 'nlv_restricted',
  settings:   'nlv_safety_settings',
  reports:    'nlv_reports',
  modActions: 'nlv_mod_actions',
};

function loadArr(key: string): string[] {
  try { return JSON.parse(localStorage.getItem(key) ?? '[]'); } catch { return []; }
}
function saveArr(key: string, arr: string[]) {
  try { localStorage.setItem(key, JSON.stringify(arr)); } catch {}
}
function loadObj<T>(key: string, def: T): T {
  try { return { ...def, ...JSON.parse(localStorage.getItem(key) ?? '{}') }; } catch { return def; }
}
function saveObj(key: string, obj: object) {
  try { localStorage.setItem(key, JSON.stringify(obj)); } catch {}
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

export function defaultSafetySettings(): SafetySettings {
  return {
    whoCanMessage:            'everyone',
    whoCanComment:            'everyone',
    whoCanMention:            'everyone',
    allowFollows:             true,
    contentFilterSensitivity: 'medium',
  };
}

// ─── Block ────────────────────────────────────────────────────────────────────

export async function blockUser(currentUserId: string, targetUserId: string): Promise<void> {
  if (isFirebaseConfigured && db) {
    await setDoc(doc(db, 'userBlocks', `${currentUserId}_${targetUserId}`), {
      blockerId: currentUserId, blockedId: targetUserId,
      createdAt: serverTimestamp(),
    });
  } else {
    const list = loadArr(K.blocked);
    if (!list.includes(targetUserId)) saveArr(K.blocked, [...list, targetUserId]);
  }
}

export async function unblockUser(currentUserId: string, targetUserId: string): Promise<void> {
  if (isFirebaseConfigured && db) {
    await deleteDoc(doc(db, 'userBlocks', `${currentUserId}_${targetUserId}`));
  } else {
    saveArr(K.blocked, loadArr(K.blocked).filter(id => id !== targetUserId));
  }
}

export function subscribeBlockedUsers(userId: string, cb: (ids: string[]) => void): Unsubscribe {
  if (!isFirebaseConfigured || !db) { cb(loadArr(K.blocked)); return () => {}; }
  const q = query(collection(db, 'userBlocks'), where('blockerId', '==', userId));
  return onSnapshot(q,
    snap => cb(snap.docs.map(d => d.data().blockedId as string)),
    err => console.error('[subscribeBlockedUsers]', err.code, err.message));
}

export function subscribeBlockedByUsers(userId: string, cb: (ids: string[]) => void): Unsubscribe {
  if (!isFirebaseConfigured || !db) { cb([]); return () => {}; }
  const q = query(collection(db, 'userBlocks'), where('blockedId', '==', userId));
  return onSnapshot(q,
    snap => cb(snap.docs.map(d => d.data().blockerId as string)),
    err => console.error('[subscribeBlockedByUsers]', err.code, err.message));
}

// ─── Mute ─────────────────────────────────────────────────────────────────────

export async function muteUser(currentUserId: string, targetUserId: string): Promise<void> {
  if (isFirebaseConfigured && db) {
    await setDoc(doc(db, 'userMutes', `${currentUserId}_${targetUserId}`), {
      muterId: currentUserId, mutedId: targetUserId,
      createdAt: serverTimestamp(),
    });
  } else {
    const list = loadArr(K.muted);
    if (!list.includes(targetUserId)) saveArr(K.muted, [...list, targetUserId]);
  }
}

export async function unmuteUser(currentUserId: string, targetUserId: string): Promise<void> {
  if (isFirebaseConfigured && db) {
    await deleteDoc(doc(db, 'userMutes', `${currentUserId}_${targetUserId}`));
  } else {
    saveArr(K.muted, loadArr(K.muted).filter(id => id !== targetUserId));
  }
}

export function subscribeMutedUsers(userId: string, cb: (ids: string[]) => void): Unsubscribe {
  if (!isFirebaseConfigured || !db) { cb(loadArr(K.muted)); return () => {}; }
  const q = query(collection(db, 'userMutes'), where('muterId', '==', userId));
  return onSnapshot(q,
    snap => cb(snap.docs.map(d => d.data().mutedId as string)),
    err => console.error('[subscribeMutedUsers]', err.code, err.message));
}

// ─── Restrict ─────────────────────────────────────────────────────────────────

export async function restrictUser(currentUserId: string, targetUserId: string): Promise<void> {
  if (isFirebaseConfigured && db) {
    await setDoc(doc(db, 'userRestrictions', `${currentUserId}_${targetUserId}`), {
      restrictorId: currentUserId, restrictedId: targetUserId,
      createdAt: serverTimestamp(),
    });
  } else {
    const list = loadArr(K.restricted);
    if (!list.includes(targetUserId)) saveArr(K.restricted, [...list, targetUserId]);
  }
}

export async function unrestrictUser(currentUserId: string, targetUserId: string): Promise<void> {
  if (isFirebaseConfigured && db) {
    await deleteDoc(doc(db, 'userRestrictions', `${currentUserId}_${targetUserId}`));
  } else {
    saveArr(K.restricted, loadArr(K.restricted).filter(id => id !== targetUserId));
  }
}

export function subscribeRestrictedUsers(userId: string, cb: (ids: string[]) => void): Unsubscribe {
  if (!isFirebaseConfigured || !db) { cb(loadArr(K.restricted)); return () => {}; }
  const q = query(collection(db, 'userRestrictions'), where('restrictorId', '==', userId));
  return onSnapshot(q,
    snap => cb(snap.docs.map(d => d.data().restrictedId as string)),
    err => console.error('[subscribeRestrictedUsers]', err.code, err.message));
}

// ─── Safety settings ──────────────────────────────────────────────────────────

export function subscribeSafetySettings(userId: string, cb: (s: SafetySettings) => void): Unsubscribe {
  if (!isFirebaseConfigured || !db) {
    cb(loadObj(K.settings, defaultSafetySettings()));
    return () => {};
  }
  return onSnapshot(doc(db, 'userSafetySettings', userId), snap => {
    cb(snap.exists() ? { ...defaultSafetySettings(), ...snap.data() } as SafetySettings : defaultSafetySettings());
  }, err => console.error('[subscribeSafetySettings]', err.code, err.message));
}

export async function updateSafetySettings(userId: string, settings: Partial<SafetySettings>): Promise<void> {
  if (isFirebaseConfigured && db) {
    await setDoc(doc(db, 'userSafetySettings', userId), settings, { merge: true });
  } else {
    saveObj(K.settings, { ...loadObj(K.settings, defaultSafetySettings()), ...settings });
  }
}

// ─── Reports ──────────────────────────────────────────────────────────────────

export interface ReportInput {
  /** Content type being reported */
  type: ReportType;
  targetType?: ReportType;
  targetId: string;
  /** Firebase UID of the account that owns the reported content */
  targetOwnerId?: string;
  reportedUserId?: string | null;
  /** Short text snapshot saved for evidence even if content is later deleted */
  targetPreview?: string;
  parentContentId?: string | null;
  conversationId?: string | null;
  reporterId: string;
  reason: ReportReason;
  category?: string;
  details?: string;
  additionalDetails?: string | null;
  evidence?: Partial<ReportEvidence>;
}

function emptyEvidence(): ReportEvidence {
  return { textSnapshot: null, mediaUrl: null, authorId: null };
}

export async function submitReport(input: ReportInput): Promise<void> {
  const targetType = input.targetType ?? input.type;
  const payload = {
    type:               targetType,
    targetType,
    targetId:           input.targetId,
    targetOwnerId:      input.targetOwnerId ?? null,
    reportedUserId:     input.reportedUserId ?? input.targetOwnerId ?? null,
    targetPreview:      input.targetPreview ?? null,
    parentContentId:    input.parentContentId ?? null,
    conversationId:     input.conversationId ?? null,
    reporterId:         input.reporterId,
    reason:             input.reason,
    category:           input.category ?? input.reason,
    details:            input.details ?? null,
    additionalDetails:  input.additionalDetails ?? null,
    evidence: {
      textSnapshot: input.evidence?.textSnapshot ?? input.targetPreview ?? null,
      mediaUrl:     input.evidence?.mediaUrl ?? null,
      authorId:     input.evidence?.authorId ?? input.targetOwnerId ?? null,
    },
    status:             'pending' as ReportStatus,
    priority:           'medium' as ReportPriority,
    assignedModeratorId: null,
    resolution:         null,
    moderationActionId: null,
    reviewedAt:         null,
    resolvedAt:         null,
    createdAt:          serverTimestamp(),
  };

  if (isFirebaseConfigured && db) {
    await addDoc(collection(db, 'reports'), payload);
  } else {
    try {
      const raw = localStorage.getItem(K.reports);
      const reports: Report[] = raw ? JSON.parse(raw) : [];
      reports.unshift({
        ...payload,
        id: `r_${Date.now()}`,
        createdAt: new Date() as unknown as Date,
      } as Report);
      localStorage.setItem(K.reports, JSON.stringify(reports));
    } catch {}
  }
}

function firestoreToReport(id: string, d: Record<string, unknown>): Report {
  function toDateOrNull(v: unknown): Date | null {
    if (!v) return null;
    if (v instanceof Timestamp) return v.toDate();
    if (typeof v === 'string') return new Date(v);
    return null;
  }
  return {
    id,
    ...d,
    targetType: (d.targetType ?? d.type) as ReportType,
    reportedUserId:      d.reportedUserId     ?? null,
    parentContentId:     d.parentContentId    ?? null,
    conversationId:      d.conversationId     ?? null,
    category:            d.category           ?? d.reason ?? '',
    additionalDetails:   d.additionalDetails  ?? null,
    evidence:            (d.evidence as ReportEvidence) ?? { textSnapshot: null, mediaUrl: null, authorId: null },
    priority:            (d.priority as ReportPriority) ?? 'medium',
    assignedModeratorId: d.assignedModeratorId ?? null,
    resolution:          d.resolution         ?? null,
    moderationActionId:  d.moderationActionId ?? null,
    createdAt:   toDateOrNull(d.createdAt)  ?? new Date(),
    reviewedAt:  toDateOrNull(d.reviewedAt),
    resolvedAt:  toDateOrNull(d.resolvedAt),
  } as Report;
}

export async function getUserReports(userId: string): Promise<Report[]> {
  if (isFirebaseConfigured && db) {
    try {
      // No orderBy — avoids a (reporterId, createdAt) composite index requirement.
      // Single-field WHERE on reporterId uses the auto-created single-field index.
      // Client-side sort is fine for the volumes a user ever generates.
      const q = query(collection(db, 'reports'), where('reporterId', '==', userId), limit(50));
      const snap = await getDocs(q);
      return snap.docs
        .map(d => firestoreToReport(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => {
          const bMs = (b.createdAt as unknown as { toDate?: () => Date })?.toDate?.()?.getTime() ?? (b.createdAt instanceof Date ? b.createdAt.getTime() : 0);
          const aMs = (a.createdAt as unknown as { toDate?: () => Date })?.toDate?.()?.getTime() ?? (a.createdAt instanceof Date ? a.createdAt.getTime() : 0);
          return bMs - aMs;
        });
    } catch (err: unknown) {
      rethrowIfIndexError(err);
      throw err;
    }
  }
  try {
    const raw = localStorage.getItem(K.reports);
    if (!raw) return [];
    return (JSON.parse(raw) as Report[])
      .filter(r => r.reporterId === userId)
      .map(r => ({ ...r, createdAt: new Date(r.createdAt) }));
  } catch { return []; }
}

/**
 * Real-time subscription to reports by status.
 * Updates the ModerationDashboard whenever a report is filed or status changes.
 */
export function subscribeReports(
  statusFilter: ReportStatus | 'all',
  onData: (reports: Report[]) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  if (!isFirebaseConfigured || !db) {
    // Demo mode: one-time load from localStorage
    try {
      const raw = localStorage.getItem('nlv_reports');
      if (!raw) { onData([]); return () => {}; }
      const all: Report[] = JSON.parse(raw);
      onData((statusFilter === 'all' ? all : all.filter(r => r.status === statusFilter))
        .map(r => ({ ...r, createdAt: new Date(r.createdAt) })));
    } catch { onData([]); }
    return () => {};
  }

  const q = statusFilter === 'all'
    ? query(collection(db, 'reports'), limit(200))
    : query(collection(db, 'reports'), where('status', '==', statusFilter), limit(200));

  return onSnapshot(q, snap => {
    const sorted = snap.docs
      .map(d => firestoreToReport(d.id, d.data() as Record<string, unknown>))
      .sort((a, b) => {
        const bMs = (b.createdAt as unknown as { toDate?: () => Date })?.toDate?.()?.getTime() ?? (b.createdAt instanceof Date ? b.createdAt.getTime() : 0);
        const aMs = (a.createdAt as unknown as { toDate?: () => Date })?.toDate?.()?.getTime() ?? (a.createdAt instanceof Date ? a.createdAt.getTime() : 0);
        return bMs - aMs;
      });
    onData(sorted);
  }, err => {
    console.error('[subscribeReports]', err.code, err.message);
    onError?.(err);
  });
}

export async function getPendingReports(statusFilter: ReportStatus | 'all' = 'pending'): Promise<Report[]> {
  if (isFirebaseConfigured && db) {
    try {
      // Drop orderBy from status-filtered queries: combining WHERE status == X
      // with ORDER BY createdAt DESC requires a composite index that may not be
      // deployed. The auto-created single-field index on `status` is enough for
      // the equality filter; we sort client-side after fetching.
      const q = statusFilter === 'all'
        ? query(collection(db, 'reports'), limit(200))
        : query(collection(db, 'reports'), where('status', '==', statusFilter), limit(200));
      const snap = await getDocs(q);
      return snap.docs
        .map(d => firestoreToReport(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => {
          const bMs = (b.createdAt as unknown as { toDate?: () => Date })?.toDate?.()?.getTime() ?? (b.createdAt instanceof Date ? b.createdAt.getTime() : 0);
          const aMs = (a.createdAt as unknown as { toDate?: () => Date })?.toDate?.()?.getTime() ?? (a.createdAt instanceof Date ? a.createdAt.getTime() : 0);
          return bMs - aMs;
        });
    } catch (err: unknown) {
      rethrowIfIndexError(err);
      throw err;
    }
  }
  try {
    const raw = localStorage.getItem(K.reports);
    if (!raw) return [];
    const all: Report[] = JSON.parse(raw);
    return (statusFilter === 'all' ? all : all.filter(r => r.status === statusFilter))
      .map(r => ({ ...r, createdAt: new Date(r.createdAt) }));
  } catch { return []; }
}

export async function updateReportStatus(
  reportId: string, status: ReportStatus, moderatorId: string,
  moderatorNote?: string, resolution?: string
): Promise<void> {
  if (isFirebaseConfigured && db) {
    await updateDoc(doc(db, 'reports', reportId), {
      status,
      moderatorId,
      moderatorNote: moderatorNote ?? null,
      resolution: resolution ?? null,
      resolvedAt: serverTimestamp(),
      reviewedAt: serverTimestamp(),
    });
  } else {
    try {
      const raw = localStorage.getItem(K.reports);
      if (!raw) return;
      const reports: Report[] = JSON.parse(raw).map((r: Report) =>
        r.id === reportId ? { ...r, status, moderatorNote, resolution, resolvedAt: new Date() } : r
      );
      localStorage.setItem(K.reports, JSON.stringify(reports));
    } catch {}
  }
}

export async function assignReport(reportId: string, moderatorId: string): Promise<void> {
  if (isFirebaseConfigured && db) {
    await updateDoc(doc(db, 'reports', reportId), {
      assignedModeratorId: moderatorId,
      status: 'reviewing',
      reviewedAt: serverTimestamp(),
    });
  }
}

export async function updateReportPriority(reportId: string, priority: ReportPriority): Promise<void> {
  if (isFirebaseConfigured && db) {
    await updateDoc(doc(db, 'reports', reportId), { priority });
  }
}

// ─── Moderation actions ───────────────────────────────────────────────────────

interface LogActionParams {
  moderatorId: string;
  action: ModerationActionType | string;
  targetId: string;
  targetType: string;
  targetUserId?: string;
  reason: string;
  explanation?: string;
  previousState?: string;
  newState?: string;
  reportId?: string;
}

async function logAction(params: LogActionParams): Promise<void> {
  const entry = {
    moderatorId:   params.moderatorId,
    action:        params.action,
    targetId:      params.targetId,
    targetType:    params.targetType,
    targetUserId:  params.targetUserId ?? null,
    reason:        params.reason,
    explanation:   params.explanation ?? null,
    previousState: params.previousState ?? null,
    newState:      params.newState ?? null,
    reportId:      params.reportId ?? null,
  };
  if (isFirebaseConfigured && db) {
    await addDoc(collection(db, 'moderationActions'), { ...entry, createdAt: serverTimestamp() });
  } else {
    try {
      const existing: ModerationLog[] = JSON.parse(localStorage.getItem(K.modActions) ?? '[]');
      localStorage.setItem(K.modActions, JSON.stringify([
        { id: `ma_${Date.now()}`, ...entry, createdAt: new Date().toISOString() },
        ...existing,
      ]));
    } catch {}
  }
}

export async function suspendUser(
  userId: string, moderatorId: string, reason: string, days = 30, reportId?: string
): Promise<string> {
  if (userId === FOUNDER_UID) throw new Error('Cannot suspend the Founder account.');
  let actionId = '';
  if (isFirebaseConfigured && db) {
    const expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + days);
    await setDoc(doc(db, 'userSuspensions', userId), {
      moderatorId, reason, days, suspendedAt: serverTimestamp(), expiresAt, active: true, permanent: false,
    });
  }
  const action = days === 1 ? 'suspend_1d' : days === 7 ? 'suspend_7d' : days === 30 ? 'suspend_30d' : 'suspend_custom';
  await logAction({
    moderatorId, action, targetId: userId, targetType: 'user', targetUserId: userId,
    reason, explanation: `Suspended for ${days} day(s)`, previousState: 'active', newState: `suspended_${days}d`,
    reportId,
  });
  return actionId;
}

export async function banUser(
  userId: string, moderatorId: string, reason: string, reportId?: string
): Promise<void> {
  if (userId === FOUNDER_UID) throw new Error('Cannot ban the Founder account.');
  if (isFirebaseConfigured && db) {
    await setDoc(doc(db, 'userSuspensions', userId), {
      moderatorId, reason, permanent: true, suspendedAt: serverTimestamp(), expiresAt: null, active: true,
    });
  }
  await logAction({
    moderatorId, action: 'permanent_ban', targetId: userId, targetType: 'user', targetUserId: userId,
    reason, explanation: 'Permanently banned', previousState: 'active', newState: 'banned', reportId,
  });
}

export async function unbanUser(
  userId: string, moderatorId: string, reason: string
): Promise<void> {
  if (isFirebaseConfigured && db) {
    await updateDoc(doc(db, 'userSuspensions', userId), { active: false });
  }
  await logAction({
    moderatorId, action: 'unban', targetId: userId, targetType: 'user', targetUserId: userId,
    reason, previousState: 'banned', newState: 'active',
  });
}

export async function sendWarning(
  userId: string, moderatorId: string, reason: string, reportId?: string
): Promise<void> {
  if (isFirebaseConfigured && db) {
    await addDoc(collection(db, 'userWarnings'), {
      userId, moderatorId, reason, createdAt: serverTimestamp(),
    });
  }
  await logAction({
    moderatorId, action: 'send_warning', targetId: userId, targetType: 'user', targetUserId: userId,
    reason, reportId,
  });
}

export async function restrictAccount(
  userId: string, moderatorId: string, reason: string, reportId?: string
): Promise<void> {
  if (userId === FOUNDER_UID) throw new Error('Cannot restrict the Founder account.');
  if (isFirebaseConfigured && db) {
    await setDoc(doc(db, 'userRestrictions', `mod_${userId}`), {
      restrictorId: moderatorId, restrictedId: userId, byModerator: true,
      reason, createdAt: serverTimestamp(),
    });
  }
  await logAction({
    moderatorId, action: 'restrict_account', targetId: userId, targetType: 'user', targetUserId: userId,
    reason, reportId,
  });
}

export async function removeContent(
  targetId: string, targetType: 'post' | 'comment',
  moderatorId: string, reason: string, reportId?: string
): Promise<void> {
  if (isFirebaseConfigured && db) {
    const col = targetType === 'post' ? 'posts' : 'comments';
    await updateDoc(doc(db, col, targetId), {
      removedByMod: true, removalReason: reason, removedAt: serverTimestamp(),
    });
  }
  await logAction({
    moderatorId, action: 'remove_content', targetId, targetType,
    reason, reportId,
  });
}

export async function restoreContent(
  targetId: string, targetType: 'post' | 'comment',
  moderatorId: string, reason: string
): Promise<void> {
  if (isFirebaseConfigured && db) {
    const col = targetType === 'post' ? 'posts' : 'comments';
    await updateDoc(doc(db, col, targetId), {
      removedByMod: false, restoredAt: serverTimestamp(),
    });
  }
  await logAction({
    moderatorId, action: 'restore_content', targetId, targetType,
    reason, previousState: 'removed', newState: 'visible',
  });
}

export async function getSuspendedUsers(): Promise<Array<{
  userId: string; reason: string; days?: number; permanent?: boolean;
  suspendedAt: Date; expiresAt: Date | null;
}>> {
  if (!isFirebaseConfigured || !db) return [];
  try {
    // Only filter on `active` (single-field auto-index). Filtering on two
    // equality fields (active + permanent) requires a composite index.
    // We filter `permanent` client-side instead.
    const q = query(collection(db, 'userSuspensions'), where('active', '==', true));
    const snap = await getDocs(q);
    return snap.docs
      .filter(d => d.data().permanent !== true)
      .map(d => ({
        userId: d.id,
        reason: d.data().reason,
        days: d.data().days,
        permanent: false,
        suspendedAt: (d.data().suspendedAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
        expiresAt: (d.data().expiresAt as { toDate?: () => Date })?.toDate?.() ?? null,
      }));
  } catch (err: unknown) {
    rethrowIfIndexError(err);
    return [];
  }
}

export async function getBannedUsers(): Promise<Array<{
  userId: string; reason: string; bannedAt: Date;
}>> {
  if (!isFirebaseConfigured || !db) return [];
  try {
    // Same pattern: filter only on `active` to avoid composite index; check
    // `permanent` client-side.
    const q = query(collection(db, 'userSuspensions'), where('active', '==', true));
    const snap = await getDocs(q);
    return snap.docs
      .filter(d => d.data().permanent === true)
      .map(d => ({
        userId: d.id,
        reason: d.data().reason,
        bannedAt: (d.data().suspendedAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
      }));
  } catch (err: unknown) {
    rethrowIfIndexError(err);
    return [];
  }
}

export async function getModerationLog(): Promise<ModerationLog[]> {
  if (isFirebaseConfigured && db) {
    const q = query(collection(db, 'moderationActions'), orderBy('createdAt', 'desc'), limit(200));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      id: d.id, ...d.data(),
      createdAt: (d.data().createdAt as { toDate?: () => Date })?.toDate?.() ?? new Date(),
    })) as ModerationLog[];
  }
  try {
    return (JSON.parse(localStorage.getItem(K.modActions) ?? '[]') as ModerationLog[])
      .map(r => ({ ...r, createdAt: new Date(r.createdAt) }));
  } catch { return []; }
}

// ─── Admin / Founder check ────────────────────────────────────────────────────

export async function checkIsAdmin(userId: string): Promise<boolean> {
  // Founder is always admin — checked by UID, not profile data
  if (userId === FOUNDER_UID) return true;

  if (!isFirebaseConfigured || !db) {
    // Demo mode: user-1 is admin
    return userId === 'user-1' || userId === 'demo-user';
  }
  try {
    const snap = await getDoc(doc(db, 'admins', userId));
    return snap.exists();
  } catch { return false; }
}
