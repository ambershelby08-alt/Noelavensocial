/**
 * ModerationDashboard — admin-only moderation console.
 * Shows pending reports and the moderation action log.
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, ChevronLeft, Flag, CheckCircle, XCircle, Trash2,
  UserX, AlertCircle, Clock, Eye, RefreshCw, FileText,
  ShieldAlert, Loader2,
} from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  getPendingReports, updateReportStatus, suspendUser,
  banUser, removeContent, getModerationLog, checkIsAdmin,
} from '@/lib/safety';
import type { Report, ReportStatus, ModerationLog } from '@/lib/mockData';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relDate(d: Date): string {
  const diff = Date.now() - d.getTime();
  if (diff < 60000)    return 'Just now';
  if (diff < 3600000)  return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const STATUS_CONFIG: Record<ReportStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  pending:   { label: 'Pending',   color: '#FF8C42', bg: '#FFF4EE', icon: Clock       },
  reviewing: { label: 'Reviewing', color: '#2980B9', bg: '#EAF4FB', icon: AlertCircle },
  resolved:  { label: 'Resolved',  color: '#27AE60', bg: '#EDFAF3', icon: CheckCircle },
  dismissed: { label: 'Dismissed', color: '#95A5A6', bg: '#F4F6F7', icon: XCircle     },
};

// ─── Stat chip ────────────────────────────────────────────────────────────────

function StatChip({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex-1 bg-white rounded-2xl p-4 shadow-sm border border-black/[0.04] text-center">
      <p className="text-[24px] font-black" style={{ color }}>{count}</p>
      <p className="text-[11.5px] text-gray-400 font-semibold mt-0.5">{label}</p>
    </div>
  );
}

// ─── Action button ────────────────────────────────────────────────────────────

function ActionBtn({
  icon: Icon, label, color, bg, onClick, loading,
}: {
  icon: React.ElementType; label: string; color: string; bg: string;
  onClick: () => void; loading?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-2xl transition-all active:scale-95 border"
      style={{ background: bg, borderColor: color + '30' }}
    >
      {loading
        ? <Loader2 size={16} className="animate-spin" style={{ color }}/>
        : <Icon size={16} style={{ color }} />
      }
      <span className="text-[11px] font-bold whitespace-nowrap" style={{ color }}>{label}</span>
    </button>
  );
}

// ─── Report row ───────────────────────────────────────────────────────────────

function ReportRow({
  report, onAction,
}: {
  report: Report;
  onAction: (reportId: string, action: 'dismiss' | 'remove' | 'suspend' | 'ban') => Promise<void>;
}) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  async function act(action: 'dismiss' | 'remove' | 'suspend' | 'ban') {
    setLoadingAction(action);
    await onAction(report.id, action).catch(console.error);
    setLoadingAction(null);
    if (action === 'dismiss') setDismissed(true);
  }

  if (dismissed) return null;

  const status = STATUS_CONFIG[report.status];
  const StatusIcon = status.icon;

  return (
    <motion.div
      layout exit={{ opacity: 0, height: 0 }}
      className="bg-white rounded-[20px] border border-black/[0.04] shadow-sm p-4"
    >
      {/* Header */}
      <div className="flex items-start gap-2.5 mb-2.5">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 uppercase">
              {report.type}
            </span>
            <span
              className="text-[10.5px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
              style={{ color: status.color, background: status.bg }}
            >
              <StatusIcon size={9} />
              {status.label}
            </span>
            <span className="text-[11px] text-gray-400 ml-auto">{relDate(report.createdAt)}</span>
          </div>
          <p className="text-[14px] font-bold text-gray-900">{report.reason}</p>
          {report.targetPreview && (
            <p className="text-[12.5px] text-gray-500 mt-1 line-clamp-2 bg-gray-50 rounded-xl px-3 py-2 leading-relaxed">
              {report.targetPreview}
            </p>
          )}
          {report.details && (
            <p className="text-[12px] text-gray-400 mt-1.5 italic">"{report.details}"</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mt-3 flex-wrap">
        <ActionBtn
          icon={XCircle} label="Dismiss" color="#95A5A6" bg="#F4F6F7"
          onClick={() => act('dismiss')} loading={loadingAction === 'dismiss'}
        />
        <ActionBtn
          icon={Trash2} label="Remove" color="#E74C3C" bg="#FFF0EF"
          onClick={() => act('remove')} loading={loadingAction === 'remove'}
        />
        <ActionBtn
          icon={UserX} label="Suspend 30d" color="#E67E22" bg="#FFF4EE"
          onClick={() => act('suspend')} loading={loadingAction === 'suspend'}
        />
        <ActionBtn
          icon={ShieldAlert} label="Perm Ban" color="#C0392B" bg="#FFF0EF"
          onClick={() => act('ban')} loading={loadingAction === 'ban'}
        />
      </div>
    </motion.div>
  );
}

// ─── Log row ──────────────────────────────────────────────────────────────────

function LogRow({ log }: { log: ModerationLog }) {
  const actionLabels: Record<string, { label: string; color: string }> = {
    dismiss:       { label: 'Dismissed',      color: '#95A5A6' },
    remove_content: { label: 'Removed Content', color: '#E74C3C' },
    suspend_30d:   { label: 'Suspended 30d',  color: '#E67E22' },
    permanent_ban: { label: 'Permanent Ban',   color: '#C0392B' },
    restore:       { label: 'Restored',        color: '#27AE60' },
  };
  const cfg = actionLabels[log.action] ?? { label: log.action, color: '#6B7280' };

  return (
    <div className="flex items-start gap-3 px-4 py-3.5 border-t border-gray-50 first:border-t-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span
            className="text-[11px] font-black px-2 py-0.5 rounded-full"
            style={{ color: cfg.color, background: cfg.color + '18' }}
          >
            {cfg.label}
          </span>
          <span className="text-[11px] text-gray-400 ml-auto">{relDate(log.createdAt)}</span>
        </div>
        <p className="text-[13px] text-gray-700 font-semibold">{log.targetType}: {log.targetId.slice(0, 12)}…</p>
        {log.reason && <p className="text-[12px] text-gray-400 mt-0.5">{log.reason}</p>}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Tab = 'reports' | 'log';
type StatusFilter = ReportStatus | 'all';

export default function ModerationDashboard() {
  const { currentUser } = useAuth();
  const [, setLocation] = useLocation();

  const [isAdmin, setIsAdmin]     = useState<boolean | null>(null);
  const [tab, setTab]             = useState<Tab>('reports');
  const [statusFilter, setFilter] = useState<StatusFilter>('pending');
  const [reports, setReports]     = useState<Report[]>([]);
  const [log, setLog]             = useState<ModerationLog[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Admin gate
  useEffect(() => {
    if (!currentUser) return;
    checkIsAdmin(currentUser.id).then(ok => {
      setIsAdmin(ok);
      if (!ok) setTimeout(() => setLocation('/'), 2000);
    });
  }, [currentUser]);

  async function loadData() {
    setLoading(true);
    try {
      const [r, l] = await Promise.all([
        getPendingReports(statusFilter === 'all' ? 'all' : statusFilter),
        getModerationLog(),
      ]);
      setReports(r);
      setLog(l);
    } catch { /* ignore */ }
    setLoading(false);
  }

  useEffect(() => { if (isAdmin) loadData(); }, [isAdmin, statusFilter]);

  async function refresh() {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }

  async function handleAction(
    reportId: string, action: 'dismiss' | 'remove' | 'suspend' | 'ban'
  ) {
    const report = reports.find(r => r.id === reportId);
    if (!currentUser || !report) return;

    if (action === 'dismiss') {
      await updateReportStatus(reportId, 'dismissed', currentUser.id);
    } else if (action === 'remove') {
      await Promise.all([
        removeContent(report.targetId, 'post', currentUser.id, report.reason, reportId),
        updateReportStatus(reportId, 'resolved', currentUser.id, 'Content removed'),
      ]);
    } else if (action === 'suspend') {
      if (report.targetOwnerId) {
        await Promise.all([
          suspendUser(report.targetOwnerId, currentUser.id, report.reason, 30, reportId),
          updateReportStatus(reportId, 'resolved', currentUser.id, 'User suspended 30 days'),
        ]);
      }
    } else if (action === 'ban') {
      if (report.targetOwnerId) {
        await Promise.all([
          banUser(report.targetOwnerId, currentUser.id, report.reason, reportId),
          updateReportStatus(reportId, 'resolved', currentUser.id, 'User permanently banned'),
        ]);
      }
    }

    // Re-load
    const [r, l] = await Promise.all([
      getPendingReports(statusFilter === 'all' ? 'all' : statusFilter),
      getModerationLog(),
    ]);
    setReports(r);
    setLog(l);
  }

  // ── Not-admin state ──────────────────────────────────────────────────────
  if (isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-purple-400" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center px-6">
        <ShieldAlert size={48} className="text-red-400 mb-4" />
        <p className="text-[20px] font-black text-gray-900 mb-2">Access Denied</p>
        <p className="text-[14px] text-gray-400">This area is for moderators only. Redirecting…</p>
      </div>
    );
  }

  const pending  = reports.filter(r => r.status === 'pending').length;
  const resolved = reports.filter(r => r.status === 'resolved').length;
  const dismissed = reports.filter(r => r.status === 'dismissed').length;

  const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
    { value: 'pending',   label: 'Pending'   },
    { value: 'reviewing', label: 'Reviewing' },
    { value: 'resolved',  label: 'Resolved'  },
    { value: 'dismissed', label: 'Dismissed' },
    { value: 'all',       label: 'All'       },
  ];

  return (
    <div className="min-h-screen bg-[#FDF9F6] pb-32">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#FDF9F6]/95 backdrop-blur-sm px-4 pt-6 pb-3">
        <div className="flex items-center gap-3 mb-4">
          <Link href="/settings">
            <button className="w-9 h-9 rounded-full bg-white shadow-sm border border-black/[0.06] flex items-center justify-center">
              <ChevronLeft size={18} className="text-gray-600" />
            </button>
          </Link>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-[22px] font-black text-gray-900">Moderation</h1>
              <span className="text-[11px] font-black px-2.5 py-1 rounded-full text-white" style={{ background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)' }}>
                Admin
              </span>
            </div>
            <p className="text-[12px] text-gray-400">Report queue and audit log</p>
          </div>
          <button
            onClick={refresh}
            className="w-9 h-9 rounded-full bg-white shadow-sm border border-black/[0.06] flex items-center justify-center"
          >
            <RefreshCw size={16} className={cn('text-gray-600', refreshing && 'animate-spin')} />
          </button>
        </div>

        {/* Stats */}
        <div className="flex gap-2 mb-4">
          <StatChip label="Pending"   count={pending}   color="#FF8C42" />
          <StatChip label="Resolved"  count={resolved}  color="#27AE60" />
          <StatChip label="Dismissed" count={dismissed} color="#95A5A6" />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-2xl p-1">
          {([['reports', Flag, 'Reports'], ['log', FileText, 'Activity Log']] as const).map(([t, Icon, label]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-[13px] font-bold transition-all',
                tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-400'
              )}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-2">
        {tab === 'reports' && (
          <>
            {/* Status filter chips */}
            <div className="flex gap-2 overflow-x-auto pb-3 hide-scrollbar">
              {STATUS_FILTERS.map(f => (
                <button
                  key={f.value}
                  onClick={() => setFilter(f.value)}
                  className={cn(
                    'flex-shrink-0 px-3.5 py-1.5 rounded-full text-[12.5px] font-bold transition-all',
                    statusFilter === f.value
                      ? 'text-white'
                      : 'bg-white text-gray-400 border border-gray-100'
                  )}
                  style={statusFilter === f.value ? { background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)' } : {}}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="bg-white rounded-[20px] h-36 animate-pulse" />
                ))}
              </div>
            ) : reports.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mb-4">
                  <CheckCircle size={32} className="text-green-400" />
                </div>
                <p className="text-[17px] font-black text-gray-900 mb-2">Queue is clear!</p>
                <p className="text-[13.5px] text-gray-400">No {statusFilter !== 'all' ? statusFilter : ''} reports.</p>
              </div>
            ) : (
              <AnimatePresence>
                <div className="space-y-3 pb-4">
                  {reports.map(r => (
                    <ReportRow key={r.id} report={r} onAction={handleAction} />
                  ))}
                </div>
              </AnimatePresence>
            )}
          </>
        )}

        {tab === 'log' && (
          <div className="bg-white rounded-[22px] border border-black/[0.04] shadow-sm overflow-hidden">
            {log.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-[14px] text-gray-400">No moderation actions yet.</p>
              </div>
            ) : (
              <AnimatePresence>
                {log.map(l => <LogRow key={l.id} log={l} />)}
              </AnimatePresence>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
