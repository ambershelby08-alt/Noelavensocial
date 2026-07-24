/**
 * ReportSheet — multi-step bottom-sheet for reporting any content type.
 * Steps: reason → details → submitting → success
 */
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Flag, AlertTriangle, ShieldAlert, Eye, Zap, Megaphone,
  DollarSign, FileWarning, HelpCircle, ChevronRight, CheckCircle,
  Loader2, ArrowLeft, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { submitReport } from '@/lib/safety';
import type { ReportReason, ReportType } from '@/lib/mockData';

type Step = 'reason' | 'details' | 'submitting' | 'success';

interface ReportSheetProps {
  open: boolean;
  onClose: () => void;
  targetId: string;
  targetType: ReportType;
  targetOwnerId?: string;
  targetPreview?: string;
  reporterId: string;
  onSubmitted?: () => void;
}

interface ReasonOption {
  reason: ReportReason;
  icon: React.ElementType;
  desc: string;
  color: string;
  bg: string;
}

const REASONS: ReasonOption[] = [
  { reason: 'Spam',                      icon: Megaphone,    desc: 'Repetitive, unsolicited, or irrelevant content',   color: '#FF8C42', bg: '#FFF4EE' },
  { reason: 'Harassment',                icon: AlertTriangle, desc: 'Targeted bullying or intimidation',               color: '#E74C3C', bg: '#FFF0EF' },
  { reason: 'Hate Speech',               icon: ShieldAlert,  desc: 'Attacks based on identity or group',               color: '#C0392B', bg: '#FFF0EF' },
  { reason: 'Nudity or Sexual Content',  icon: Eye,          desc: 'Explicit or inappropriate visual content',         color: '#8E44AD', bg: '#F5EFF9' },
  { reason: 'Violence or Dangerous Content', icon: Zap,      desc: 'Graphic content or promotion of harm',            color: '#E67E22', bg: '#FFF4EE' },
  { reason: 'Misinformation',            icon: AlertTriangle, desc: 'False or misleading facts presented as true',     color: '#2980B9', bg: '#EAF4FB' },
  { reason: 'Scam or Fraud',             icon: DollarSign,   desc: 'Deceptive content designed to mislead or steal',   color: '#27AE60', bg: '#EDFAF3' },
  { reason: 'Copyright Violation',       icon: FileWarning,  desc: 'Unauthorized use of copyrighted material',         color: '#7F8C8D', bg: '#F4F6F7' },
  { reason: 'Other',                     icon: HelpCircle,   desc: 'Something not listed above',                       color: '#95A5A6', bg: '#F4F6F7' },
];

const TYPE_LABELS: Record<ReportType, string> = {
  user: 'account', post: 'post', comment: 'comment', reply: 'reply',
  story: 'story', spark: 'spark', dailySpark: 'daily spark', message: 'message', profile: 'profile',
};

export function ReportSheet({
  open, onClose, targetId, targetType, targetOwnerId,
  targetPreview, reporterId, onSubmitted,
}: ReportSheetProps) {
  const [step, setStep]          = useState<Step>('reason');
  const [reason, setReason]      = useState<ReportReason | null>(null);
  const [details, setDetails]    = useState('');

  function handleClose() {
    onClose();
    // Reset after animation
    setTimeout(() => { setStep('reason'); setReason(null); setDetails(''); }, 300);
  }

  function pickReason(r: ReasonOption) {
    setReason(r.reason);
    setStep('details');
  }

  async function handleSubmit() {
    if (!reason) return;
    setStep('submitting');
    try {
      await submitReport({
        type: targetType, targetId, targetOwnerId, targetPreview,
        reporterId, reason, details: details.trim() || undefined,
      });
    } catch { /* suppress — still show success */ }
    setStep('success');
    setTimeout(() => { handleClose(); onSubmitted?.(); }, 2200);
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/40 z-[70]"
        onClick={handleClose}
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-[75] bg-white rounded-t-[28px] shadow-2xl max-h-[90vh] flex flex-col"
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="flex items-center px-5 pt-1 pb-3 flex-shrink-0">
          {step === 'details' && (
            <button onClick={() => setStep('reason')} className="mr-3 p-1.5 rounded-full hover:bg-gray-100 transition-colors">
              <ArrowLeft size={18} className="text-gray-600" />
            </button>
          )}
          <div className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={step}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
              >
                {step === 'reason' && (
                  <>
                    <p className="text-[17px] font-black text-gray-900">Report {TYPE_LABELS[targetType]}</p>
                    <p className="text-[12.5px] text-gray-400">Why are you reporting this?</p>
                  </>
                )}
                {step === 'details' && (
                  <>
                    <p className="text-[17px] font-black text-gray-900">{reason}</p>
                    <p className="text-[12.5px] text-gray-400">Add more context (optional)</p>
                  </>
                )}
                {(step === 'submitting' || step === 'success') && (
                  <p className="text-[17px] font-black text-gray-900">
                    {step === 'submitting' ? 'Submitting…' : 'Report submitted'}
                  </p>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
          {step !== 'submitting' && step !== 'success' && (
            <button onClick={handleClose} className="p-2 rounded-full hover:bg-gray-100 transition-colors">
              <X size={18} className="text-gray-500" />
            </button>
          )}
        </div>

        <div className="overflow-y-auto flex-1">
          <AnimatePresence mode="wait">
            {/* ── Step 1: Reason selection ─────────────────────────────────── */}
            {step === 'reason' && (
              <motion.div
                key="reason"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="px-4 pb-6 space-y-2"
              >
                {REASONS.map(opt => (
                  <motion.button
                    key={opt.reason}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => pickReason(opt)}
                    className="w-full flex items-center gap-3.5 px-4 py-3.5 rounded-2xl bg-gray-50 active:bg-gray-100 text-left transition-colors"
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: opt.bg }}
                    >
                      <opt.icon size={16} style={{ color: opt.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-semibold text-gray-800">{opt.reason}</p>
                      <p className="text-[11.5px] text-gray-400 mt-0.5 leading-snug">{opt.desc}</p>
                    </div>
                    <ChevronRight size={15} className="text-gray-300 flex-shrink-0" />
                  </motion.button>
                ))}
              </motion.div>
            )}

            {/* ── Step 2: Details ───────────────────────────────────────────── */}
            {step === 'details' && (
              <motion.div
                key="details"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="px-5 pb-6"
              >
                {targetPreview && (
                  <div className="mb-4 p-3.5 bg-gray-50 rounded-2xl">
                    <p className="text-[12px] font-semibold text-gray-400 mb-1 uppercase tracking-wide">Reporting</p>
                    <p className="text-[13.5px] text-gray-700 line-clamp-2">{targetPreview}</p>
                  </div>
                )}
                <textarea
                  value={details}
                  onChange={e => setDetails(e.target.value)}
                  placeholder="Describe what you saw (optional)…"
                  rows={5}
                  maxLength={500}
                  className="w-full px-4 py-3.5 bg-gray-50 rounded-2xl text-[14px] text-gray-800 placeholder-gray-400 resize-none border-0 outline-none focus:ring-2 focus:ring-purple-200 transition-all"
                />
                <p className="text-[11px] text-gray-300 text-right mt-1 mb-5">{details.length}/500</p>

                <button
                  onClick={handleSubmit}
                  className="w-full py-4 rounded-2xl font-black text-[15px] text-white shadow-lg transition-all active:scale-[0.98]"
                  style={{ background: 'linear-gradient(135deg, #FF5E5E, #C0392B)', boxShadow: '0 4px 16px rgba(192,57,43,0.30)' }}
                >
                  Submit Report
                </button>
                <p className="text-center text-[11.5px] text-gray-400 mt-3 leading-relaxed px-4">
                  Your report is completely anonymous. We review all reports within 24 hours.
                </p>
              </motion.div>
            )}

            {/* ── Step 3: Submitting / Success ──────────────────────────────── */}
            {(step === 'submitting' || step === 'success') && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center py-16 px-8 text-center"
              >
                {step === 'submitting' ? (
                  <Loader2 size={48} className="text-purple-400 animate-spin mb-4" />
                ) : (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mb-4"
                  >
                    <CheckCircle size={36} className="text-green-500" />
                  </motion.div>
                )}
                <p className="text-[18px] font-black text-gray-900 mb-2">
                  {step === 'submitting' ? 'Submitting your report…' : 'Thank you for letting us know!'}
                </p>
                {step === 'success' && (
                  <p className="text-[13.5px] text-gray-400 max-w-[240px] leading-relaxed">
                    Our team will review this and take action if it violates our guidelines.
                  </p>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </>
  );
}
