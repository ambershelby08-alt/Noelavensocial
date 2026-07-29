/**
 * ModerationDashboard — full moderation panel accessible only to the Founder
 * and Firestore-granted admins.  All destructive actions require confirmation.
 */
import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'wouter';
import {
  ChevronLeft, Shield, AlertTriangle, Clock, CheckCircle, XCircle,
  UserX, Ban, Trash2, Eye, AlertCircle, RefreshCw, MessageSquare,
  Crown, ChevronDown, ChevronUp, UserCheck, Megaphone, Search,
  Activity, Filter, Flag, MoreVertical, Check, X,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import {
  subscribeReports, updateReportStatus, assignReport, updateReportPriority,
  suspendUser, banUser, unbanUser, sendWarning, restrictAccount,
  removeContent, restoreContent,
  getSuspendedUsers, getBannedUsers, getModerationLog, checkIsAdmin,
} from '@/lib/safety';
import { getUserByHandle } from '@/lib/firestore';
import type {
  Report, ReportStatus, ReportPriority, ModerationLog,
} from '@/lib/mockData';
import { isFounderUid } from '@/lib/founder';

// ─── Utilities ────────────────────────────────────────────────────────────────

function relDate(raw: unknown): string {
  if (!raw) return '';
  // Normalize Firestore Timestamp / Date / string safely
  const d: Date = (raw as { toDate?: () => Date })?.toDate?.()
    ?? (raw instanceof Date ? raw : new Date(raw as string));
  if (isNaN(d.getTime())) return '';
  const diff = Date.now() - d.getTime();
  if (diff < 60000)    return 'Just now';
  if (diff < 3600000)  return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const STATUS_CONFIG: Record<ReportStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  pending:   { label: 'Pending',      color: '#FF8C42', bg: '#FFF4EE', icon: Clock       },
  reviewing: { label: 'Under Review', color: '#2980B9', bg: '#EAF4FB', icon: AlertCircle },
  resolved:  { label: 'Resolved',     color: '#27AE60', bg: '#EDFAF3', icon: CheckCircle },
  dismissed: { label: 'Dismissed',    color: '#95A5A6', bg: '#F4F6F7', icon: XCircle     },
};

const PRIORITY_CONFIG: Record<ReportPriority, { label: string; color: string; bg: string }> = {
  low:    { label: 'Low',    color: '#27AE60', bg: '#EDFAF3' },
  medium: { label: 'Medium', color: '#FF8C42', bg: '#FFF4EE' },
  high:   { label: 'High',   color: '#E74C3C', bg: '#FDECEA' },
  urgent: { label: 'Urgent', color: '#FFFFFF', bg: '#E74C3C' },
};

// ─── Confirmation Modal ────────────────────────────────────────────────────────

type ConfirmAction = {
  type: 'dismiss' | 'remove_content' | 'send_warning' | 'restrict'
       | 'suspend' | 'ban' | 'unban' | 'restore' | 'assign' | 'resolve';
  reportId: string;
  targetId: string;          // content id or user id
  targetUserId?: string;
  targetType?: 'post' | 'comment' | 'user';
  label: string;
};

function ConfirmModal({
  action, onConfirm, onCancel, currentUserId,
}: {
  action: ConfirmAction;
  onConfirm: (reason: string, extra: { days?: number; notes?: string }) => void;
  onCancel: () => void;
  currentUserId: string;
}) {
  const [reason, setReason] = useState('');
  const [days, setDays] = useState(7);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  const needsDays = action.type === 'suspend';
  const needsNotes = action.type === 'resolve';

  const dangerTypes = new Set(['ban', 'suspend', 'remove_content']);
  const isDanger = dangerTypes.has(action.type);

  async function handleSubmit() {
    if (!reason.trim() && action.type !== 'assign') return;
    setBusy(true);
    try {
      await onConfirm(reason.trim(), needsDays ? { days } : needsNotes ? { notes } : {});
    } finally { setBusy(false); }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black/50 flex items-end justify-center p-4 sm:items-center"
      onClick={onCancel}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        className="w-full max-w-md bg-white rounded-3xl p-5 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className={cn('w-10 h-10 rounded-full flex items-center justify-center', isDanger ? 'bg-red-100' : 'bg-purple-100')}>
            <Shield size={18} className={isDanger ? 'text-red-500' : 'text-purple-500'} />
          </div>
          <div>
            <p className="text-[15px] font-black text-gray-900">{action.label}</p>
            <p className="text-[12px] text-gray-400">All moderation actions are logged.</p>
          </div>
        </div>

        {action.type === 'suspend' && (
          <div className="mb-3">
            <label className="text-[11.5px] font-bold text-gray-500 uppercase tracking-wide">Duration</label>
            <div className="flex gap-2 mt-2 flex-wrap">
              {[1, 7, 14, 30, 90].map(d => (
                <button key={d} onClick={() => setDays(d)}
                  className={cn('px-3 py-1.5 rounded-full text-[12.5px] font-bold border transition-all',
                    days === d ? 'bg-purple-500 text-white border-purple-500' : 'bg-gray-50 text-gray-600 border-gray-200')}>
                  {d === 1 ? '1 day' : d === 30 ? '30 days' : d === 90 ? '3 months' : `${d} days`}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mb-3">
          <label className="text-[11.5px] font-bold text-gray-500 uppercase tracking-wide">
            {action.type === 'resolve' ? 'Resolution Notes' : 'Reason'}
          </label>
          <textarea
            value={action.type === 'resolve' ? notes : reason}
            onChange={e => action.type === 'resolve' ? setNotes(e.target.value) : setReason(e.target.value)}
            placeholder={
              action.type === 'resolve' ? 'What was done? Visible to the reporter…'
              : action.type === 'ban' ? 'Required — explain the violation in detail…'
              : action.type === 'suspend' ? 'Required — reason for suspension…'
              : 'Brief reason for this action…'
            }
            rows={3}
            className="mt-1.5 w-full px-3.5 py-2.5 rounded-xl border border-black/[0.08] text-[13.5px] text-gray-900 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all bg-gray-50 resize-none"
          />
        </div>

        <div className="flex gap-2">
          <button onClick={onCancel}
            className="flex-1 py-3 rounded-xl border border-black/[0.08] font-bold text-[14px] text-gray-700 hover:bg-gray-50 transition-all">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={busy || (!reason.trim() && action.type !== 'assign' && action.type !== 'resolve')}
            title={(!reason.trim() && action.type !== 'assign' && action.type !== 'resolve') ? 'Please enter a reason first' : undefined}
            className={cn(
              'flex-1 py-3 rounded-xl font-bold text-[14px] text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed',
              isDanger ? 'bg-red-500 hover:bg-red-600' : 'bg-purple-500 hover:bg-purple-600'
            )}
          >
            {busy ? 'Processing…' : 'Confirm'}
          </button>
          {!reason.trim() && action.type !== 'assign' && action.type !== 'resolve' && (
            <p className="w-full text-center text-[11px] text-amber-500 font-medium mt-0.5">
              A reason is required
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Report Card ──────────────────────────────────────────────────────────────

function ReportCard({
  report, onAction, currentUserId,
}: {
  report: Report;
  onAction: (action: ConfirmAction) => void;
  currentUserId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const status = STATUS_CONFIG[report.status];
  const priority = PRIORITY_CONFIG[report.priority ?? 'medium'];
  const StatusIcon = status.icon;
  const isActive = report.status === 'pending' || report.status === 'reviewing';
  const isAssigned = report.assignedModeratorId === currentUserId;

  const targetTypeLabel = (report.targetType ?? report.type ?? 'content').replace('_', ' ');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-[22px] border border-black/[0.04] shadow-sm overflow-hidden"
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Flag size={16} className="text-red-400" />
          </div>
          <div className="flex-1 min-w-0">
            {/* Chips row */}
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 capitalize">
                {targetTypeLabel}
              </span>
              <span
                className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                style={{ color: priority.color === '#FFFFFF' ? '#E74C3C' : priority.color, background: priority.bg }}
              >
                {priority.label}
              </span>
              {report.assignedModeratorId && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                  {isAssigned ? '👋 Assigned to you' : 'Assigned'}
                </span>
              )}
            </div>

            <p className="text-[14px] font-bold text-gray-900">{report.reason}</p>
            {report.category && report.category !== report.reason && (
              <p className="text-[12px] text-gray-400">{report.category}</p>
            )}
            <p className="text-[11.5px] text-gray-400 mt-0.5">{relDate(report.createdAt)}</p>
          </div>

          {/* Status chip */}
          <span
            className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full flex-shrink-0"
            style={{ color: status.color, background: status.bg }}
          >
            <StatusIcon size={9} />
            {status.label}
          </span>
        </div>

        {/* Evidence preview */}
        {(report.evidence?.textSnapshot || report.targetPreview) && (
          <div className="mt-3 bg-gray-50 rounded-xl px-3 py-2.5 border-l-2 border-gray-200">
            <p className="text-[12.5px] text-gray-600 italic line-clamp-3">
              "{report.evidence?.textSnapshot ?? report.targetPreview}"
            </p>
            {report.targetType === 'post' && report.targetId && (
              <Link href={`/post/${report.targetId}`}>
                <span className="mt-1 inline-block text-[11.5px] font-semibold text-purple-500 hover:underline cursor-pointer">
                  View post →
                </span>
              </Link>
            )}
            {report.targetType === 'user' && (report.reportedUserId ?? report.targetOwnerId) && (
              <Link href={`/profile/${report.reportedUserId ?? report.targetOwnerId}`}>
                <span className="mt-1 inline-block text-[11.5px] font-semibold text-purple-500 hover:underline cursor-pointer">
                  View profile →
                </span>
              </Link>
            )}
          </div>
        )}

        {/* Reporter / Reported info */}
        <div className="mt-3 flex gap-4 text-[11.5px] text-gray-500">
          <span>Reporter: <span className="font-semibold text-gray-700">{report.reporterId.slice(0, 8)}…</span></span>
          {(report.reportedUserId ?? report.targetOwnerId) && (
            <span>Reported: <span className="font-semibold text-gray-700">{(report.reportedUserId ?? report.targetOwnerId)?.slice(0, 8)}…</span></span>
          )}
        </div>

        {/* Additional details */}
        {report.additionalDetails && (
          <p className="text-[12px] text-gray-500 mt-2 italic">"{report.additionalDetails}"</p>
        )}

        {/* Expand toggle */}
        {isActive && (
          <button
            onClick={() => setExpanded(v => !v)}
            className="mt-3 w-full flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50 text-[12.5px] font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <span>Actions</span>
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        )}
        {report.moderatorNote && (
          <div className="mt-2 px-3 py-2 bg-blue-50 rounded-xl">
            <p className="text-[12px] text-blue-600 font-medium">Mod note: {report.moderatorNote}</p>
          </div>
        )}
      </div>

      {/* Actions panel */}
      <AnimatePresence>
        {expanded && isActive && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-gray-100"
          >
            <div className="p-4 pt-3 grid grid-cols-2 gap-2">
              {/* Assign */}
              {!report.assignedModeratorId && (
                <ActionBtn label="Assign to Me" icon={UserCheck} color="#6B73FF"
                  onClick={() => onAction({ type: 'assign', reportId: report.id, targetId: report.reporterId, targetUserId: report.reportedUserId ?? undefined, label: 'Assign to yourself' })} />
              )}
              {/* Mark reviewing */}
              {report.status === 'pending' && (
                <ActionBtn label="Mark Reviewing" icon={Eye} color="#2980B9"
                  onClick={() => onAction({ type: 'assign', reportId: report.id, targetId: report.reporterId, targetUserId: report.reportedUserId ?? undefined, label: 'Mark as under review' })} />
              )}
              {/* Send Warning */}
              {(report.reportedUserId ?? report.targetOwnerId) && (
                <ActionBtn label="Send Warning" icon={Megaphone} color="#FF8C42"
                  onClick={() => onAction({ type: 'send_warning', reportId: report.id, targetId: report.reportedUserId ?? report.targetOwnerId ?? '', targetUserId: report.reportedUserId ?? report.targetOwnerId ?? undefined, targetType: 'user', label: 'Send warning to user' })} />
              )}
              {/* Restrict */}
              {(report.reportedUserId ?? report.targetOwnerId) && (
                <ActionBtn label="Restrict Account" icon={UserX} color="#9B59B6"
                  onClick={() => onAction({ type: 'restrict', reportId: report.id, targetId: report.reportedUserId ?? report.targetOwnerId ?? '', targetUserId: report.reportedUserId ?? report.targetOwnerId ?? undefined, targetType: 'user', label: 'Restrict account' })} />
              )}
              {/* Remove content */}
              {(report.targetType === 'post' || report.targetType === 'comment') && (
                <ActionBtn label="Remove Content" icon={Trash2} color="#E74C3C"
                  onClick={() => onAction({ type: 'remove_content', reportId: report.id, targetId: report.targetId, targetType: (report.targetType as 'post' | 'comment'), targetUserId: report.reportedUserId ?? undefined, label: 'Remove reported content' })} />
              )}
              {/* Suspend */}
              {(report.reportedUserId ?? report.targetOwnerId) && (
                <ActionBtn label="Suspend" icon={Clock} color="#E67E22"
                  onClick={() => onAction({ type: 'suspend', reportId: report.id, targetId: report.reportedUserId ?? report.targetOwnerId ?? '', targetUserId: report.reportedUserId ?? report.targetOwnerId ?? undefined, targetType: 'user', label: 'Suspend user' })} />
              )}
              {/* Permanent ban */}
              {(report.reportedUserId ?? report.targetOwnerId) && (
                <ActionBtn label="Perm Ban" icon={Ban} color="#C0392B"
                  onClick={() => onAction({ type: 'ban', reportId: report.id, targetId: report.reportedUserId ?? report.targetOwnerId ?? '', targetUserId: report.reportedUserId ?? report.targetOwnerId ?? undefined, targetType: 'user', label: 'Permanently ban user' })} />
              )}
              {/* Dismiss */}
              <ActionBtn label="Dismiss" icon={XCircle} color="#95A5A6"
                onClick={() => onAction({ type: 'dismiss', reportId: report.id, targetId: report.targetId, label: 'Dismiss this report' })} />
              {/* Resolve */}
              <ActionBtn label="Resolve with Notes" icon={CheckCircle} color="#27AE60"
                onClick={() => onAction({ type: 'resolve', reportId: report.id, targetId: report.targetId, label: 'Resolve report with notes' })} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ActionBtn({ label, icon: Icon, color, onClick }: {
  label: string; icon: React.ElementType; color: string; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-black/[0.06] bg-gray-50 hover:bg-gray-100 transition-colors text-left"
    >
      <Icon size={14} style={{ color }} className="flex-shrink-0" />
      <span className="text-[12.5px] font-semibold text-gray-700 leading-tight">{label}</span>
    </button>
  );
}

// ─── Log Entry ────────────────────────────────────────────────────────────────

function LogEntry({ entry }: { entry: ModerationLog }) {
  const actionColors: Record<string, string> = {
    permanent_ban: '#E74C3C', suspend_30d: '#E67E22', suspend_7d: '#E67E22',
    suspend_1d: '#FF8C42', send_warning: '#FF8C42', restrict_account: '#9B59B6',
    remove_content: '#E74C3C', restore_content: '#27AE60', dismiss: '#95A5A6',
    resolve: '#27AE60', assign: '#2980B9', unban: '#27AE60',
  };
  const color = actionColors[entry.action] ?? '#6B73FF';

  return (
    <div className="flex items-start gap-3 py-3 border-b border-gray-100 last:border-0">
      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: color + '20' }}>
        <Activity size={12} style={{ color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[12.5px] font-bold" style={{ color }}>
            {entry.action.replace(/_/g, ' ')}
          </span>
          <span className="text-[11.5px] text-gray-400">{relDate(entry.createdAt)}</span>
        </div>
        <p className="text-[12.5px] text-gray-600 mt-0.5">
          by <span className="font-semibold">{entry.moderatorId.slice(0, 8)}…</span>
          {' → '}<span className="font-semibold">{entry.targetType}: {entry.targetId.slice(0, 8)}…</span>
        </p>
        {entry.explanation && <p className="text-[12px] text-gray-400 mt-0.5 italic">"{entry.explanation}"</p>}
        {entry.reason && entry.reason !== entry.explanation && (
          <p className="text-[12px] text-gray-400 italic">Reason: {entry.reason}</p>
        )}
      </div>
    </div>
  );
}

// ─── Suspended / Banned User Card ─────────────────────────────────────────────

function SuspendedCard({ item, onUnban, type }: {
  item: { userId: string; reason: string; suspendedAt?: Date; bannedAt?: Date; expiresAt?: Date | null; days?: number };
  onUnban: (userId: string) => void;
  type: 'suspended' | 'banned';
}) {
  const when = type === 'banned' ? item.bannedAt : item.suspendedAt;
  return (
    <div className="bg-white rounded-[18px] border border-black/[0.04] shadow-sm p-4">
      <div className="flex items-start gap-3">
        <div className={cn('w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0', type === 'banned' ? 'bg-red-100' : 'bg-orange-100')}>
          {type === 'banned' ? <Ban size={16} className="text-red-500" /> : <Clock size={16} className="text-orange-500" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13.5px] font-bold text-gray-800 font-mono">{item.userId.slice(0, 20)}…</p>
          <p className="text-[12px] text-gray-500 mt-0.5">{item.reason}</p>
          {when && <p className="text-[11.5px] text-gray-400 mt-0.5">{type === 'banned' ? 'Banned' : 'Suspended'} {relDate(when)}</p>}
          {type === 'suspended' && item.expiresAt && (
            <p className="text-[11.5px] text-orange-500 mt-0.5">
              Expires {new Date(item.expiresAt).toLocaleDateString()}
            </p>
          )}
        </div>
        <button
          onClick={() => onUnban(item.userId)}
          className="px-3 py-1.5 rounded-full bg-green-50 text-green-600 text-[12px] font-bold border border-green-200 hover:bg-green-100 transition-colors"
        >
          Restore
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type TabId = 'pending' | 'reviewing' | 'resolved' | 'dismissed' | 'suspended' | 'banned' | 'log';

export default function ModerationDashboard() {
  const { currentUser, isFounder } = useAuth();
  const [isAdmin, setIsAdmin] = useState(isFounder);
  const [checkingAdmin, setCheckingAdmin] = useState(!isFounder);

  const [activeTab, setActiveTab] = useState<TabId>('pending');
  const [reports, setReports] = useState<Report[]>([]);
  const [suspended, setSuspended] = useState<Awaited<ReturnType<typeof getSuspendedUsers>>>([]);
  const [banned, setBanned] = useState<Awaited<ReturnType<typeof getBannedUsers>>>([]);
  const [log, setLog] = useState<ModerationLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [toast, setToast] = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [handleInput, setHandleInput] = useState('');
  const [resolvedUid, setResolvedUid] = useState<string | null>(null);
  const [resolvedHandle, setResolvedHandle] = useState<string | null>(null);
  const [handleLookupState, setHandleLookupState] = useState<'idle' | 'looking' | 'found' | 'notfound'>('idle');

  // Debounced handle → UID lookup
  useEffect(() => {
    const raw = handleInput.trim().replace(/^@/, '');
    if (!raw) {
      setResolvedUid(null);
      setResolvedHandle(null);
      setHandleLookupState('idle');
      return;
    }
    setHandleLookupState('looking');
    const t = setTimeout(async () => {
      const uid = await getUserByHandle(raw);
      if (uid) {
        setResolvedUid(uid);
        setResolvedHandle(raw);
        setHandleLookupState('found');
      } else {
        setResolvedUid(null);
        setResolvedHandle(null);
        setHandleLookupState('notfound');
      }
    }, 350);
    return () => clearTimeout(t);
  }, [handleInput]);

  // Check admin access
  useEffect(() => {
    if (!currentUser) return;
    if (isFounder) { setIsAdmin(true); setCheckingAdmin(false); return; }
    checkIsAdmin(currentUser.id).then(ok => { setIsAdmin(ok); setCheckingAdmin(false); });
  }, [currentUser, isFounder]);

  const showToast = (msg: string) => {
    setToast(msg); setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  };

  const loadTab = useCallback(async (tab: TabId) => {
    if (!isAdmin) return;
    if (['suspended', 'banned', 'log'].includes(tab)) {
      setLoading(true);
      try {
        if (tab === 'suspended') setSuspended(await getSuspendedUsers());
        else if (tab === 'banned')  setBanned(await getBannedUsers());
        else if (tab === 'log')     setLog(await getModerationLog());
      } catch (err: unknown) {
        showToast(`Error loading data: ${(err as Error)?.message ?? 'unknown'}`);
      } finally {
        setLoading(false);
      }
    }
    // Report tabs are handled by the real-time subscription below
  }, [isAdmin]);

  // Real-time subscription for report tabs — auto-updates when reports change
  useEffect(() => {
    if (!isAdmin) return;
    const reportTabs: Array<TabId> = ['pending', 'reviewing', 'resolved', 'dismissed'];
    if (!reportTabs.includes(activeTab)) {
      loadTab(activeTab);
      return;
    }
    setLoading(true);
    const status = activeTab as 'pending' | 'reviewing' | 'resolved' | 'dismissed';
    const unsub = subscribeReports(status, newReports => {
      setReports(newReports);
      setLoading(false);
    }, () => setLoading(false));
    return unsub;
  }, [activeTab, isAdmin, loadTab]);

  async function handleConfirm(reason: string, extra: { days?: number; notes?: string }) {
    if (!confirmAction || !currentUser) return;
    const { type, reportId, targetId, targetUserId, targetType } = confirmAction;
    try {
      if (type === 'assign') {
        await assignReport(reportId, currentUser.id);
        showToast('Report assigned to you');
      } else if (type === 'dismiss') {
        await updateReportStatus(reportId, 'dismissed', currentUser.id, reason);
        showToast('Report dismissed');
      } else if (type === 'resolve') {
        await updateReportStatus(reportId, 'resolved', currentUser.id, extra.notes, extra.notes);
        showToast('Report resolved');
      } else if (type === 'remove_content') {
        await removeContent(targetId, (targetType as 'post' | 'comment') ?? 'post', currentUser.id, reason, reportId);
        await updateReportStatus(reportId, 'resolved', currentUser.id, `Content removed: ${reason}`);
        showToast('Content removed');
      } else if (type === 'restore') {
        await restoreContent(targetId, (targetType as 'post' | 'comment') ?? 'post', currentUser.id, reason);
        showToast('Content restored');
      } else if (type === 'send_warning') {
        await sendWarning(targetUserId ?? targetId, currentUser.id, reason, reportId);
        showToast('Warning sent to user');
      } else if (type === 'restrict') {
        await restrictAccount(targetUserId ?? targetId, currentUser.id, reason, reportId);
        showToast('Account restricted');
      } else if (type === 'suspend') {
        await suspendUser(targetUserId ?? targetId, currentUser.id, reason, extra.days ?? 7, reportId);
        await updateReportStatus(reportId, 'resolved', currentUser.id, `User suspended ${extra.days ?? 7}d: ${reason}`);
        showToast(`User suspended for ${extra.days ?? 7} days`);
      } else if (type === 'ban') {
        await banUser(targetUserId ?? targetId, currentUser.id, reason, reportId);
        await updateReportStatus(reportId, 'resolved', currentUser.id, `User permanently banned: ${reason}`);
        showToast('User permanently banned');
      } else if (type === 'unban') {
        await unbanUser(targetId, currentUser.id, reason);
        showToast('User restored');
      }
      setConfirmAction(null);
      loadTab(activeTab);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      showToast(msg.includes('Founder') ? '⛔ Cannot moderate the Founder account.' : `Error: ${msg}`);
      setConfirmAction(null);
    }
  }

  // ── Not authorized ──
  if (!checkingAdmin && !isAdmin) {
    return (
      <div className="min-h-screen bg-[#FDF9F6] flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
          <Shield size={28} className="text-red-400" />
        </div>
        <h1 className="text-[20px] font-black text-gray-900 mb-2">Access Denied</h1>
        <p className="text-[14px] text-gray-500 mb-6">You don't have permission to access the moderation dashboard.</p>
        <Link href="/home"><button className="px-6 py-3 rounded-full bg-purple-500 text-white font-bold text-[14px]">Go Home</button></Link>
      </div>
    );
  }

  const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
    { id: 'pending',   label: 'Pending',      icon: Clock       },
    { id: 'reviewing', label: 'Reviewing',    icon: Eye         },
    { id: 'resolved',  label: 'Resolved',     icon: CheckCircle },
    { id: 'dismissed', label: 'Dismissed',    icon: XCircle     },
    { id: 'suspended', label: 'Suspended',    icon: UserX       },
    { id: 'banned',    label: 'Banned',       icon: Ban         },
    { id: 'log',       label: 'Log',          icon: Activity    },
  ];

  const reportTabs = new Set<TabId>(['pending', 'reviewing', 'resolved', 'dismissed']);

  // Filtered content — matches reason, preview, evidence text, AND the reported
  // user's UID / targetOwnerId so moderators can pull all reports against a user
  // by typing a partial UID into the search bar.  When a @handle has been resolved
  // to a UID, that UID is applied as an additional exact-match filter.
  const filteredReports = reports.filter(r => {
    if (resolvedUid) {
      // Handle filter takes precedence — show only reports involving that user.
      return (
        r.reportedUserId === resolvedUid ||
        r.targetOwnerId === resolvedUid ||
        r.reporterId === resolvedUid
      );
    }
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      r.reason.toLowerCase().includes(q) ||
      r.targetPreview?.toLowerCase().includes(q) ||
      r.evidence?.textSnapshot?.toLowerCase().includes(q) ||
      r.reportedUserId?.toLowerCase().includes(q) ||
      r.targetOwnerId?.toLowerCase().includes(q) ||
      r.reporterId?.toLowerCase().includes(q) ||
      r.category?.toLowerCase().includes(q) ||
      r.additionalDetails?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-[#FDF9F6] pb-32">
      {/* Toast */}
      <AnimatePresence>
        {toastVisible && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-gray-900 text-white text-[13.5px] font-semibold shadow-xl whitespace-nowrap flex items-center gap-2">
            <Check size={14} className="text-purple-400" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Confirmation modal */}
      <AnimatePresence>
        {confirmAction && (
          <ConfirmModal
            action={confirmAction}
            onConfirm={handleConfirm}
            onCancel={() => setConfirmAction(null)}
            currentUserId={currentUser?.id ?? ''}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="sticky top-0 z-40 bg-[#FDF9F6]/95 backdrop-blur-sm border-b border-black/[0.04] px-4 pt-4 pb-3">
        <div className="flex items-center gap-3 mb-3">
          <Link href="/settings">
            <button className="w-8 h-8 rounded-full bg-white border border-black/[0.06] flex items-center justify-center shadow-sm hover:shadow-md transition-all">
              <ChevronLeft size={17} className="text-gray-600" />
            </button>
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #7C3AED, #D4AF37)' }}>
              <Crown size={13} className="text-white" />
            </div>
            <div>
              <h1 className="text-[18px] font-black text-gray-900 leading-tight">Moderation</h1>
              {isFounder && <p className="text-[11px] text-purple-600 font-bold -mt-0.5">Founder View</p>}
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => loadTab(activeTab)} className="w-8 h-8 rounded-full bg-white border border-black/[0.06] flex items-center justify-center shadow-sm">
              <RefreshCw size={14} className="text-gray-500" />
            </button>
          </div>
        </div>

        {/* Search + handle filter (reports only) */}
        {reportTabs.has(activeTab) && (
          <div className="space-y-2 mb-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search} onChange={e => { setSearch(e.target.value); setHandleInput(''); setResolvedUid(null); }}
                placeholder="Search by reason, content, or user UID…"
                className="w-full pl-8 pr-3 py-2.5 rounded-xl bg-white border border-black/[0.06] text-[13.5px] text-gray-800 outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100 transition-all"
              />
            </div>
            {/* Handle-to-UID resolver */}
            <div className="relative">
              <Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={handleInput}
                onChange={e => { setHandleInput(e.target.value); setSearch(''); }}
                placeholder="Filter by @handle…"
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-white border border-black/[0.06] text-[13px] text-gray-800 outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100 transition-all"
              />
              {handleInput.trim() && (
                <button onClick={() => { setHandleInput(''); setResolvedUid(null); setHandleLookupState('idle'); }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={13} />
                </button>
              )}
            </div>
            {handleLookupState === 'found' && resolvedHandle && resolvedUid && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 border border-purple-200 rounded-xl text-[12px] text-purple-700 font-medium">
                <Check size={12} className="text-purple-500" />
                @{resolvedHandle} → {resolvedUid.slice(0, 12)}…
              </div>
            )}
            {handleLookupState === 'notfound' && handleInput.trim() && (
              <p className="text-[12px] text-red-500 pl-1">Handle not found</p>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-0.5 hide-scrollbar">
          {TABS.map(t => {
            const Icon = t.icon;
            const active = activeTab === t.id;
            return (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={cn('flex items-center gap-1.5 px-3 py-2 rounded-full text-[12px] font-bold flex-shrink-0 transition-all',
                  active ? 'text-white shadow-sm' : 'bg-white text-gray-500 border border-gray-100')}
                style={active ? { background: 'linear-gradient(135deg, #7C3AED, #D4AF37)' } : {}}
              >
                <Icon size={11} />
                {t.label}
                {active && reportTabs.has(t.id) && reports.length > 0 && (
                  <span className="bg-white/25 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full">
                    {reports.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {checkingAdmin || loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-[22px] h-28 animate-pulse" />
          ))
        ) : activeTab === 'log' ? (
          log.length === 0 ? (
            <EmptyState icon={Activity} title="No actions yet" desc="Moderation actions will appear here." />
          ) : (
            <div className="bg-white rounded-[22px] border border-black/[0.04] shadow-sm divide-y divide-gray-100 px-4">
              {log.map(e => <LogEntry key={e.id} entry={e} />)}
            </div>
          )
        ) : activeTab === 'suspended' ? (
          suspended.length === 0 ? (
            <EmptyState icon={UserX} title="No suspended users" desc="Suspended accounts will appear here." />
          ) : (
            suspended.map(s => (
              <SuspendedCard key={s.userId} type="suspended"
                item={{ ...s, suspendedAt: s.suspendedAt }}
                onUnban={uid => setConfirmAction({
                  type: 'unban', reportId: '', targetId: uid, label: 'Restore this user',
                })} />
            ))
          )
        ) : activeTab === 'banned' ? (
          banned.length === 0 ? (
            <EmptyState icon={Ban} title="No banned users" desc="Permanently banned accounts will appear here." />
          ) : (
            banned.map(b => (
              <SuspendedCard key={b.userId} type="banned"
                item={{ ...b, bannedAt: b.bannedAt }}
                onUnban={uid => setConfirmAction({
                  type: 'unban', reportId: '', targetId: uid, label: 'Unban this user',
                })} />
            ))
          )
        ) : filteredReports.length === 0 ? (
          <EmptyState
            icon={activeTab === 'pending' ? Flag : CheckCircle}
            title={activeTab === 'pending' ? 'No pending reports' : `No ${activeTab} reports`}
            desc={activeTab === 'pending' ? 'New user reports will appear here.' : 'Nothing here yet.'}
          />
        ) : (
          filteredReports.map(r => (
            <ReportCard key={r.id} report={r} onAction={setConfirmAction} currentUserId={currentUser?.id ?? ''} />
          ))
        )}
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <Icon size={28} className="text-gray-300" />
      </div>
      <p className="text-[17px] font-black text-gray-900 mb-2">{title}</p>
      <p className="text-[13.5px] text-gray-400 max-w-[220px] leading-relaxed">{desc}</p>
    </div>
  );
}
