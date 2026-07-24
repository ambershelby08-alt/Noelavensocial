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
import type { ReportType, ReportReason, ReportStatus, Report, ModerationLog, SafetySettings } from './mockData';

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
  return onSnapshot(q, snap => cb(snap.docs.map(d => d.data().blockedId as string)));
}

export function subscribeBlockedByUsers(userId: string, cb: (ids: string[]) => void): Unsubscribe {
  if (!isFirebaseConfigured || !db) { cb([]); return () => {}; }
  const q = query(collection(db, 'userBlocks'), where('blockedId', '==', userId));
  return onSnapshot(q, snap => cb(snap.docs.map(d => d.data().blockerId as string)));
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
  return onSnapshot(q, snap => cb(snap.docs.map(d => d.data().mutedId as string)));
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
  return onSnapshot(q, snap => cb(snap.docs.map(d => d.data().restrictedId as string)));
}

// ─── Safety settings ──────────────────────────────────────────────────────────

export function subscribeSafetySettings(userId: string, cb: (s: SafetySettings) => void): Unsubscribe {
  if (!isFirebaseConfigured || !db) {
    cb(loadObj(K.settings, defaultSafetySettings()));
    return () => {};
  }
  return onSnapshot(doc(db, 'userSafetySettings', userId), snap => {
    cb(snap.exists() ? { ...defaultSafetySettings(), ...snap.data() } as SafetySettings : defaultSafetySettings());
  });
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
  type: ReportType;
  targetId: string;
  targetOwnerId?: string;
  targetPreview?: string;
  reporterId: string;
  reason: ReportReason;
  details?: string;
}

export async function submitReport(input: ReportInput): Promise<void> {
  if (isFirebaseConfigured && db) {
    await addDoc(collection(db, 'reports'), {
      ...input, status: 'pending', createdAt: serverTimestamp(),
    });
  } else {
    try {
      const raw = localStorage.getItem(K.reports);
      const reports: Report[] = raw ? JSON.parse(raw) : [];
      reports.unshift({
        ...input, id: `r_${Date.now()}`,
        status: 'pending' as ReportStatus,
        createdAt: new Date() as unknown as Date,
      } as Report);
      localStorage.setItem(K.reports, JSON.stringify(reports));
    } catch {}
  }
}

function firestoreToReport(id: string, d: Record<string, unknown>): Report {
  return {
    id, ...d,
    createdAt: d.createdAt instanceof Timestamp ? d.createdAt.toDate() : new Date(d.createdAt as string),
    resolvedAt: d.resolvedAt instanceof Timestamp ? d.resolvedAt.toDate() : (d.resolvedAt ? new Date(d.resolvedAt as string) : undefined),
  } as Report;
}

export async function getUserReports(userId: string): Promise<Report[]> {
  if (isFirebaseConfigured && db) {
    const q = query(collection(db, 'reports'), where('reporterId', '==', userId), orderBy('createdAt', 'desc'), limit(50));
    const snap = await getDocs(q);
    return snap.docs.map(d => firestoreToReport(d.id, d.data() as Record<string, unknown>));
  }
  try {
    const raw = localStorage.getItem(K.reports);
    if (!raw) return [];
    return (JSON.parse(raw) as Report[])
      .filter(r => r.reporterId === userId)
      .map(r => ({ ...r, createdAt: new Date(r.createdAt) }));
  } catch { return []; }
}

export async function getPendingReports(statusFilter: ReportStatus | 'all' = 'pending'): Promise<Report[]> {
  if (isFirebaseConfigured && db) {
    const q = statusFilter === 'all'
      ? query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(100))
      : query(collection(db, 'reports'), where('status', '==', statusFilter), orderBy('createdAt', 'desc'), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map(d => firestoreToReport(d.id, d.data() as Record<string, unknown>));
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
  reportId: string, status: ReportStatus, moderatorId: string, moderatorNote?: string
): Promise<void> {
  if (isFirebaseConfigured && db) {
    await updateDoc(doc(db, 'reports', reportId), {
      status, moderatorId, moderatorNote: moderatorNote ?? null, resolvedAt: serverTimestamp(),
    });
  } else {
    try {
      const raw = localStorage.getItem(K.reports);
      if (!raw) return;
      const reports: Report[] = JSON.parse(raw).map((r: Report) =>
        r.id === reportId ? { ...r, status, moderatorNote, resolvedAt: new Date() } : r
      );
      localStorage.setItem(K.reports, JSON.stringify(reports));
    } catch {}
  }
}

// ─── Moderation actions ───────────────────────────────────────────────────────

async function logAction(
  moderatorId: string, action: string, targetId: string, targetType: string,
  reason: string, reportId?: string
): Promise<void> {
  const entry = {
    moderatorId, action, targetId, targetType, reason,
    reportId: reportId ?? null, createdAt: new Date().toISOString(),
  };
  if (isFirebaseConfigured && db) {
    await addDoc(collection(db, 'moderationActions'), { ...entry, createdAt: serverTimestamp() });
  } else {
    try {
      const existing: ModerationLog[] = JSON.parse(localStorage.getItem(K.modActions) ?? '[]');
      localStorage.setItem(K.modActions, JSON.stringify([{ id: `ma_${Date.now()}`, ...entry }, ...existing]));
    } catch {}
  }
}

export async function suspendUser(
  userId: string, moderatorId: string, reason: string, days = 30, reportId?: string
): Promise<void> {
  if (isFirebaseConfigured && db) {
    const expiresAt = new Date(); expiresAt.setDate(expiresAt.getDate() + days);
    await setDoc(doc(db, 'userSuspensions', userId), {
      moderatorId, reason, days, suspendedAt: serverTimestamp(), expiresAt, active: true,
    });
  }
  await logAction(moderatorId, `suspend_${days}d`, userId, 'user', reason, reportId);
}

export async function banUser(
  userId: string, moderatorId: string, reason: string, reportId?: string
): Promise<void> {
  if (isFirebaseConfigured && db) {
    await setDoc(doc(db, 'userSuspensions', userId), {
      moderatorId, reason, permanent: true, suspendedAt: serverTimestamp(), expiresAt: null, active: true,
    });
  }
  await logAction(moderatorId, 'permanent_ban', userId, 'user', reason, reportId);
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
  await logAction(moderatorId, 'remove_content', targetId, targetType, reason, reportId);
}

export async function getModerationLog(): Promise<ModerationLog[]> {
  if (isFirebaseConfigured && db) {
    const q = query(collection(db, 'moderationActions'), orderBy('createdAt', 'desc'), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({
      id: d.id, ...d.data(),
      createdAt: d.data().createdAt instanceof Timestamp ? d.data().createdAt.toDate() : new Date(),
    })) as ModerationLog[];
  }
  try {
    return (JSON.parse(localStorage.getItem(K.modActions) ?? '[]') as ModerationLog[])
      .map(r => ({ ...r, createdAt: new Date(r.createdAt) }));
  } catch { return []; }
}

// ─── Admin check ──────────────────────────────────────────────────────────────

export async function checkIsAdmin(userId: string): Promise<boolean> {
  if (!isFirebaseConfigured || !db) {
    // Demo mode: user-1 is admin
    return userId === 'user-1' || userId === 'demo-user';
  }
  try {
    const snap = await getDoc(doc(db, 'admins', userId));
    return snap.exists();
  } catch { return false; }
}
