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
import { getUserReports } from '@/lib/safety';
import type { Report, ReportStatus, ReportType, ReportReason } from '@/lib/mockData';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relDate(d: Date): string {
  const diff = Date.now() - d.getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
      className="bg-white rounded-[22px] border border-black/[0.04] shadow-sm p-4"
    >
      {/* Header row */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0 mt-0.5">
          <ReasonIcon size={18} className="text-red-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[12px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
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
          <p className="text-[14px] font-semibold text-gray-800 mt-1">{report.reason}</p>
          <p className="text-[11.5px] text-gray-400 mt-0.5">{relDate(report.createdAt)}</p>
        </div>
      </div>

      {/* Preview */}
      {report.targetPreview && (
        <div className="bg-gray-50 rounded-xl px-3 py-2.5 mb-3">
          <p className="text-[13px] text-gray-600 line-clamp-2 leading-relaxed">{report.targetPreview}</p>
        </div>
      )}

      {/* User notes */}
      {report.details && (
        <div className="border-t border-gray-50 pt-2.5">
          <p className="text-[11.5px] text-gray-400 font-semibold mb-0.5">Your note</p>
          <p className="text-[13px] text-gray-600 leading-relaxed">{report.details}</p>
        </div>
      )}

      {/* Moderator note if resolved */}
      {report.moderatorNote && (
        <div className="mt-2.5 border-t border-gray-50 pt-2.5">
          <p className="text-[11.5px] text-gray-400 font-semibold mb-0.5">Moderator response</p>
          <p className="text-[13px] text-gray-600 leading-relaxed">{report.moderatorNote}</p>
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

  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);
    getUserReports(currentUser.id)
      .then(setReports)
      .catch(() => setReports([]))
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
    <div className="min-h-screen bg-[#FDF9F6] pb-32">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#FDF9F6]/95 backdrop-blur-sm px-4 pt-6 pb-3 flex items-center gap-3">
        <Link href="/safety">
          <button className="w-9 h-9 rounded-full bg-white shadow-sm border border-black/[0.06] flex items-center justify-center">
            <ChevronLeft size={18} className="text-gray-600" />
          </button>
        </Link>
        <div>
          <h1 className="text-[22px] font-black text-gray-900 leading-tight">My Reports</h1>
          <p className="text-[12px] text-gray-400">Reports you've submitted</p>
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
                  : 'bg-white text-gray-500 border border-gray-100'
              )}
              style={activeFilter === f.value ? { background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)' } : {}}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-[22px] h-28 animate-pulse" />
          ))
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <Flag size={28} className="text-gray-300" />
            </div>
            <p className="text-[17px] font-black text-gray-900 mb-2">No reports yet</p>
            <p className="text-[13.5px] text-gray-400 max-w-[220px] leading-relaxed">
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
        <p className="text-[11.5px] text-gray-400 leading-relaxed">
          Reports are reviewed within 24 hours. All reports are anonymous.
        </p>
      </div>
    </div>
  );
}
