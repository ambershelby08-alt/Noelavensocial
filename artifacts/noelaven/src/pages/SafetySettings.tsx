/**
 * SafetySettings — full Safety & Privacy settings page.
 * Covers: privacy controls, content filter, blocked/muted/restricted users.
 */
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield, Lock, UserX, VolumeX, EyeOff, MessageSquare,
  AtSign, Users2, MessageCircle, SlidersHorizontal,
  ChevronLeft, ChevronRight, Check, Trash2, Flag, FileText,
  UserCheck,
} from 'lucide-react';
import { Link } from 'wouter';
import { cn } from '@/lib/utils';
import { useSafety } from '@/contexts/SafetyContext';
import { useAuth } from '@/contexts/AuthContext';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { useUserProfile } from '@/contexts/UserCacheContext';
import type { SafetySettings } from '@/lib/mockData';

// ─── Who-can select ───────────────────────────────────────────────────────────

type Audience = SafetySettings['whoCanMessage'];

const AUDIENCE_OPTIONS: { value: Audience; label: string }[] = [
  { value: 'everyone',  label: 'Everyone' },
  { value: 'followers', label: 'Followers' },
  { value: 'friends',   label: 'Mutuals only' },
  { value: 'none',      label: 'No one' },
];

const FILTER_OPTIONS: { value: SafetySettings['contentFilterSensitivity']; label: string; desc: string }[] = [
  { value: 'off',    label: 'Off',    desc: 'No filtering applied' },
  { value: 'low',    label: 'Low',    desc: 'Only the most extreme content' },
  { value: 'medium', label: 'Medium', desc: 'Strong profanity and insults' },
  { value: 'high',   label: 'High',   desc: 'All profanity and harsh language' },
];

function AudienceSelect({
  label, icon: Icon, value, onChange,
}: {
  label: string;
  icon: React.ElementType;
  value: Audience;
  onChange: (v: Audience) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = AUDIENCE_OPTIONS.find(o => o.value === value)!;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-3.5 px-4 py-4 active:bg-gray-50 border-t border-gray-50 first:border-t-0"
      >
        <div className="w-9 h-9 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0">
          <Icon size={17} className="text-purple-500" />
        </div>
        <div className="flex-1 text-left">
          <p className="text-[14.5px] font-semibold text-gray-800">{label}</p>
          <p className="text-[12px] text-purple-600 font-semibold mt-0.5">{current.label}</p>
        </div>
        <ChevronRight size={16} className={cn('text-gray-300 transition-transform', open && 'rotate-90')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pl-[3.25rem] pr-4 pb-3 space-y-1">
              {AUDIENCE_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-left transition-colors',
                    value === opt.value ? 'bg-purple-50 text-purple-700' : 'hover:bg-gray-50 text-gray-600'
                  )}
                >
                  <span className="text-[13.5px] font-semibold flex-1">{opt.label}</span>
                  {value === opt.value && <Check size={14} className="text-purple-500" />}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Section card ─────────────────────────────────────────────────────────────

function SectionCard({ title, icon: Icon, children, className }: {
  title: string; icon: React.ElementType; children: React.ReactNode; className?: string;
}) {
  return (
    <div className={cn('bg-white rounded-[24px] border border-black/[0.04] shadow-sm overflow-hidden', className)}>
      <div className="px-5 pt-4 pb-2 flex items-center gap-2">
        <Icon size={16} className="text-purple-500" />
        <h2 className="text-[13px] font-black text-gray-500 uppercase tracking-widest">{title}</h2>
      </div>
      {children}
    </div>
  );
}

// ─── User pill with action ────────────────────────────────────────────────────

function UserPill({
  userId, name, handle, action, actionLabel, actionColor,
}: {
  userId: string; name: string; handle: string;
  action: () => void; actionLabel: string; actionColor?: string;
}) {
  const [done, setDone] = useState(false);
  function handleAction() { action(); setDone(true); }

  if (done) return null;
  return (
    <motion.div
      layout
      exit={{ opacity: 0, height: 0 }}
      className="flex items-center gap-3 px-5 py-3.5 border-t border-gray-50 first:border-t-0"
    >
      <UserAvatar userId={userId} fallbackName={name} size={38} className="flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-gray-900 truncate">{name}</p>
        <p className="text-[12px] text-gray-400">@{handle}</p>
      </div>
      <button
        onClick={handleAction}
        className="text-[12px] font-black px-3 py-1.5 rounded-full border transition-colors"
        style={actionColor ? { color: actionColor, borderColor: actionColor + '50' } : {}}
      >
        {actionLabel}
      </button>
    </motion.div>
  );
}

// ─── User pill with live profile resolution ───────────────────────────────────

/**
 * Resolves a userId to a real display name and handle via the UserCacheContext,
 * falling back gracefully while the profile is loading.  Replaces the old
 * `getUserStubs` approach which hard-coded demo names and showed raw UIDs in
 * production Firebase mode.
 */
function ResolvedUserPill({
  userId, action, actionLabel, actionColor,
}: {
  userId: string; action: () => void; actionLabel: string; actionColor?: string;
}) {
  const profile = useUserProfile(userId);
  const name   = profile?.displayName ?? '…';
  const handle = profile?.handle ?? userId.slice(0, 10);
  return (
    <UserPill
      userId={userId} name={name} handle={handle}
      action={action} actionLabel={actionLabel} actionColor={actionColor}
    />
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SafetySettings() {
  const { currentUser } = useAuth();
  const {
    blockedIds, mutedIds, restrictedIds, safetySettings,
    unblockUser, unmuteUser, unrestrictUser, updateSafetySettings,
  } = useSafety();

  const [settings, setSettings] = useState(safetySettings);

  useEffect(() => { setSettings(safetySettings); }, [safetySettings]);

  async function change<K extends keyof SafetySettings>(key: K, val: SafetySettings[K]) {
    const next = { ...settings, [key]: val };
    setSettings(next);
    await updateSafetySettings({ [key]: val });
  }

  const blockedUserIds    = [...blockedIds];
  const mutedUserIds      = [...mutedIds];
  const restrictedUserIds = [...restrictedIds];

  return (
    <div className="min-h-screen bg-[#FDF9F6] pb-32">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#FDF9F6]/95 backdrop-blur-sm px-4 pt-6 pb-3 flex items-center gap-3">
        <Link href="/settings">
          <button className="w-9 h-9 rounded-full bg-white shadow-sm border border-black/[0.06] flex items-center justify-center">
            <ChevronLeft size={18} className="text-gray-600" />
          </button>
        </Link>
        <div>
          <h1 className="text-[22px] font-black text-gray-900 leading-tight">Safety & Privacy</h1>
          <p className="text-[12px] text-gray-400">Control who can interact with you</p>
        </div>
      </div>

      <div className="px-4 space-y-4 pt-2">

        {/* ── Privacy Controls ──────────────────────────────────────────── */}
        <SectionCard title="Privacy Controls" icon={Lock}>
          <AudienceSelect
            label="Who can message you"
            icon={MessageSquare}
            value={settings.whoCanMessage}
            onChange={v => change('whoCanMessage', v)}
          />
          <AudienceSelect
            label="Who can comment on your posts"
            icon={MessageCircle}
            value={settings.whoCanComment}
            onChange={v => change('whoCanComment', v)}
          />
          <AudienceSelect
            label="Who can @mention you"
            icon={AtSign}
            value={settings.whoCanMention}
            onChange={v => change('whoCanMention', v)}
          />

          {/* Allow follows toggle */}
          <button
            onClick={() => change('allowFollows', !settings.allowFollows)}
            className="w-full flex items-center gap-3.5 px-4 py-4 border-t border-gray-50 active:bg-gray-50"
          >
            <div className="w-9 h-9 rounded-full bg-purple-50 flex items-center justify-center flex-shrink-0">
              <Users2 size={17} className="text-purple-500" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-[14.5px] font-semibold text-gray-800">Allow new followers</p>
              <p className="text-[12px] text-gray-400 mt-0.5">Anyone can follow your profile</p>
            </div>
            <div
              className={cn(
                'w-11 h-6 rounded-full relative transition-colors duration-200 flex-shrink-0',
                settings.allowFollows ? 'bg-purple-500' : 'bg-gray-200'
              )}
            >
              <motion.div
                animate={{ x: settings.allowFollows ? 20 : 2 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                className="absolute top-[2px] w-5 h-5 rounded-full bg-white shadow-sm"
              />
            </div>
          </button>
        </SectionCard>

        {/* ── Content Filter ─────────────────────────────────────────────── */}
        <SectionCard title="Content Filter" icon={SlidersHorizontal}>
          <div className="px-5 pb-4 pt-2">
            <p className="text-[12.5px] text-gray-400 mb-3 leading-relaxed">
              Filter potentially offensive language from posts and comments you see.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {FILTER_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => change('contentFilterSensitivity', opt.value)}
                  className={cn(
                    'flex flex-col items-start gap-1 px-4 py-3 rounded-2xl border text-left transition-all',
                    settings.contentFilterSensitivity === opt.value
                      ? 'border-purple-300 bg-purple-50'
                      : 'border-gray-100 bg-gray-50 hover:bg-gray-100'
                  )}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className={cn(
                      'text-[13px] font-bold',
                      settings.contentFilterSensitivity === opt.value ? 'text-purple-700' : 'text-gray-700'
                    )}>
                      {opt.label}
                    </span>
                    {settings.contentFilterSensitivity === opt.value && (
                      <Check size={13} className="text-purple-500" />
                    )}
                  </div>
                  <span className="text-[11px] text-gray-400 leading-snug">{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </SectionCard>

        {/* ── Blocked Users ─────────────────────────────────────────────── */}
        <SectionCard title={`Blocked (${blockedUserIds.length})`} icon={UserX}>
          {blockedUserIds.length === 0 ? (
            <div className="px-5 py-6 text-center">
              <p className="text-[13px] text-gray-400">You haven't blocked anyone.</p>
            </div>
          ) : (
            <AnimatePresence>
              {blockedUserIds.map(id => (
                <ResolvedUserPill
                  key={id} userId={id}
                  action={() => unblockUser(id)} actionLabel="Unblock" actionColor="#6B73FF"
                />
              ))}
            </AnimatePresence>
          )}
        </SectionCard>

        {/* ── Muted Users ───────────────────────────────────────────────── */}
        <SectionCard title={`Muted (${mutedUserIds.length})`} icon={VolumeX}>
          {mutedUserIds.length === 0 ? (
            <div className="px-5 py-6 text-center">
              <p className="text-[13px] text-gray-400">You haven't muted anyone.</p>
            </div>
          ) : (
            <AnimatePresence>
              {mutedUserIds.map(id => (
                <ResolvedUserPill
                  key={id} userId={id}
                  action={() => unmuteUser(id)} actionLabel="Unmute" actionColor="#8E44AD"
                />
              ))}
            </AnimatePresence>
          )}
        </SectionCard>

        {/* ── Restricted Users ──────────────────────────────────────────── */}
        <SectionCard title={`Restricted (${restrictedUserIds.length})`} icon={EyeOff}>
          <div className="px-5 pt-2 pb-1">
            <p className="text-[12px] text-gray-400 leading-relaxed">
              Restricted users can see your public posts but their comments require your approval before others see them.
            </p>
          </div>
          {restrictedUserIds.length === 0 ? (
            <div className="px-5 py-4 text-center">
              <p className="text-[13px] text-gray-400">No restricted users.</p>
            </div>
          ) : (
            <AnimatePresence>
              {restrictedUserIds.map(id => (
                <ResolvedUserPill
                  key={id} userId={id}
                  action={() => unrestrictUser(id)} actionLabel="Unrestrict"
                />
              ))}
            </AnimatePresence>
          )}
        </SectionCard>

        {/* ── Quick links ───────────────────────────────────────────────── */}
        <div className="bg-white rounded-[24px] border border-black/[0.04] shadow-sm overflow-hidden">
          <Link href="/my-reports">
            <button className="w-full flex items-center gap-3.5 px-5 py-4 active:bg-gray-50">
              <div className="w-9 h-9 rounded-full bg-red-50 flex items-center justify-center">
                <Flag size={17} className="text-red-500" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-[14.5px] font-semibold text-gray-800">My Reports</p>
                <p className="text-[12px] text-gray-400">Track reports you've submitted</p>
              </div>
              <ChevronRight size={16} className="text-gray-300" />
            </button>
          </Link>
          <Link href="/settings">
            <button className="w-full flex items-center gap-3.5 px-5 py-4 border-t border-gray-50 active:bg-gray-50">
              <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                <FileText size={17} className="text-gray-500" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-[14.5px] font-semibold text-gray-800">Community Guidelines</p>
                <p className="text-[12px] text-gray-400">Rules and policies for Noelaven</p>
              </div>
              <ChevronRight size={16} className="text-gray-300" />
            </button>
          </Link>
        </div>

        <p className="text-center text-[11.5px] text-gray-400 pb-2 px-4 leading-relaxed">
          All actions are private. Blocked and muted users are never notified.
        </p>
      </div>
    </div>
  );
}
