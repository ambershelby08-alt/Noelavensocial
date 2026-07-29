/**
 * MyReports — shows the current user's submitted report history.
 */
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Flag, ChevronLeft, AlertCircle, CheckCircle, Clock, XCircle,
  Megaphone, AlertTriangle, ShieldAlert, Eye, Zap, DollarSign,
  FileWarning, HelpCircle, MessageSquare,
} from 'lucide-react';
import { Link } from 'wouter';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { getUserReports, IndexBuildingError } from '@/lib/safety';
import type { Report, ReportStatus, ReportType, ReportReason } from '@/lib/mockData';
import { normalizeDate, safeGetTime } from '@/lib/timestamp';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relDate(raw: unknown): string {
  const ms = safeGetTime(raw);
  if (ms === 0) return '';
  const diff = Date.now() - ms;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  const d = normalizeDate(raw);
  return d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';
}

const STATUS_CONFIG: Record<ReportStatus, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  pending:   { label: 'Pending',   color: '#FF8C42', bg: '#FFF4EE', icon: Clock        },
  reviewing: { label: 'Reviewing', color: '#2980B9', bg: '#EAF4FB', icon: AlertCircle  },
  resolved:  { label: 'Resolved',  color: '#27AE60', bg: '#EDFAF3', icon: CheckCircle  },
  dismissed: { label: 'Dismissed', color: '#95A5A6', bg: '#F4F6F7', icon: XCircle      },
};

const TYPE_LABELS: Record<ReportType, string> = {
  user: 'Account', post: 'Post', comment: 'Comment', reply: 'Reply',
  story: 'Story', spark: 'Spark', dailySpark: 'Daily Spark', message: 'Message', profile: 'Profile',
};

const REASON_ICONS: Record<ReportReason, React.ElementType> = {
  'Spam':                         Megaphone,
  'Harassment':                   AlertTriangle,
  'Hate Speech':                  ShieldAlert,
  'Nudity or Sexual Content':     Eye,
  'Violence or Dangerous Content': Zap,
  'Misinformation':               AlertTriangle,
  'Scam or Fraud':                DollarSign,
  'Copyright Violation':          FileWarning,
  'Other':                        HelpCircle,
};

// ─── Report Card ──────────────────────────────────────────────────────────────

function ReportCard({ report }: { report: Report }) {
  const status = STATUS_CONFIG[report.status];
  const StatusIcon = status.icon;
  const ReasonIcon = REASON_ICONS[report.reason] ?? Flag;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#111] rounded-[22px] border border-[#1a1a1a] shadow-sm p-4"
    >
      {/* Header row */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0 mt-0.5">
          <ReasonIcon size={18} className="text-red-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12px] font-bold px-2 py-0.5 rounded-full bg-[#1a1a1a] text-[#BDBDBD]">
              {TYPE_LABELS[report.type]}
            </span>
            <span
              className="text-[11.5px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
              style={{ color: status.color, background: status.bg }}
            >
              <StatusIcon size={10} />
              {status.label}
            </span>
          </div>
          <p className="text-[14px] font-semibold text-white mt-1">{report.reason}</p>
          <p className="text-[11.5px] text-[rgba(255,255,255,0.45)] mt-0.5">{relDate(report.createdAt)}</p>
        </div>
      </div>

      {/* Preview */}
      {report.targetPreview && (
        <div className="bg-[#111] rounded-xl px-3 py-2.5 mb-3">
          <p className="text-[13px] text-[#BDBDBD] line-clamp-2 leading-relaxed">{report.targetPreview}</p>
        </div>
      )}

      {/* User notes */}
      {report.details && (
        <div className="border-t border-gray-50 pt-2.5">
          <p className="text-[11.5px] text-[rgba(255,255,255,0.45)] font-semibold mb-0.5">Your note</p>
          <p className="text-[13px] text-[#BDBDBD] leading-relaxed">{report.details}</p>
        </div>
      )}

      {/* Moderator note if resolved */}
      {report.moderatorNote && (
        <div className="mt-2.5 border-t border-gray-50 pt-2.5">
          <p className="text-[11.5px] text-[rgba(255,255,255,0.45)] font-semibold mb-0.5">Moderator response</p>
          <p className="text-[13px] text-[#BDBDBD] leading-relaxed">{report.moderatorNote}</p>
        </div>
      )}
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MyReports() {
  const { currentUser } = useAuth();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<ReportStatus | 'all'>('all');
  const [indexBuilding, setIndexBuilding] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);
    setIndexBuilding(false);
    getUserReports(currentUser.id)
      .then(data => { setReports(data); })
      .catch((err: unknown) => {
        if (err instanceof IndexBuildingError) setIndexBuilding(true);
        setReports([]);
      })
      .finally(() => setLoading(false));
  }, [currentUser]);

  const filtered = activeFilter === 'all'
    ? reports
    : reports.filter(r => r.status === activeFilter);

  const filters: { value: ReportStatus | 'all'; label: string }[] = [
    { value: 'all',      label: `All (${reports.length})` },
    { value: 'pending',  label: 'Pending'  },
    { value: 'resolved', label: 'Resolved' },
    { value: 'dismissed',label: 'Dismissed'},
  ];

  return (
    <div className="min-h-screen bg-black pb-32">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-black/95 backdrop-blur-sm px-4 pt-6 pb-3 flex items-center gap-3">
        <Link href="/safety">
          <button className="w-9 h-9 rounded-full bg-[#111] shadow-sm border border-[#1a1a1a] flex items-center justify-center">
            <ChevronLeft size={18} className="text-[#BDBDBD]" />
          </button>
        </Link>
        <div>
          <h1 className="text-[22px] font-black text-white leading-tight">My Reports</h1>
          <p className="text-[12px] text-[rgba(255,255,255,0.45)]">Reports you've submitted</p>
        </div>
      </div>

      {/* Filter chips */}
      <div className="px-4 pb-3">
        <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
          {filters.map(f => (
            <button
              key={f.value}
              onClick={() => setActiveFilter(f.value)}
              className={cn(
                'flex-shrink-0 px-4 py-2 rounded-full text-[13px] font-bold transition-all',
                activeFilter === f.value
                  ? 'text-white shadow-sm'
                  : 'bg-[#111] text-[#BDBDBD] border border-[#222]'
              )}
              style={activeFilter === f.value ? { background: 'linear-gradient(135deg, #EC4899, #7C3AED, #2563EB)' } : {}}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-[#111] rounded-[22px] h-28 animate-pulse" />
          ))
        ) : indexBuilding ? (
          <div className="bg-[#111] rounded-[24px] border border-amber-100 shadow-sm p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-4">
              <Clock size={26} className="text-amber-400" />
            </div>
            <p className="text-[16px] font-black text-white mb-2">
              Database indexes are building
            </p>
            <p className="text-[13px] text-[#BDBDBD] leading-relaxed mb-4">
              Firestore is building the indexes needed to query your reports.
              This is a one-time process that takes 1–5 minutes after first deployment.
            </p>
            <div className="bg-gray-900 rounded-xl px-3.5 py-2.5 text-left mb-4">
              <code className="text-[12px] text-green-400 font-mono">
                firebase deploy --only firestore:indexes
              </code>
            </div>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2.5 rounded-full font-bold text-[13.5px] text-white"
              style={{ background: 'linear-gradient(135deg, #EC4899, #7C3AED, #2563EB)' }}
            >
              Retry
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-[#1a1a1a] flex items-center justify-center mb-4">
              <Flag size={28} className="text-[rgba(255,255,255,0.35)]" />
            </div>
            <p className="text-[17px] font-black text-white mb-2">No reports yet</p>
            <p className="text-[13.5px] text-[rgba(255,255,255,0.45)] max-w-[220px] leading-relaxed">
              {activeFilter === 'all'
                ? 'Reports you submit from posts, profiles, or messages will appear here.'
                : `No ${activeFilter} reports.`}
            </p>
          </div>
        ) : (
          filtered.map(r => <ReportCard key={r.id} report={r} />)
        )}
      </div>

      <div className="px-6 pt-6 text-center">
        <p className="text-[11.5px] text-[rgba(255,255,255,0.45)] leading-relaxed">
          Reports are reviewed within 24 hours. All reports are anonymous.
        </p>
      </div>
    </div>
  );
}
