import React, { useState, useRef } from 'react';
import {
  User, Bell, Lock, Shield, AlertTriangle, LogOut,
  ChevronRight, Paintbrush, FileText, HelpCircle, Check, Camera,
  X, ChevronDown, Sun, Moon, Monitor, Eye, EyeOff, Send,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation, Link } from 'wouter';
import { GradientAvatar } from '@/components/ui/GradientAvatar';
import { motion, AnimatePresence } from 'framer-motion';
import { uploadImage, isCloudinaryConfigured } from '@/lib/cloudinary';
import { isFirebaseConfigured } from '@/lib/firebase';
import { cn } from '@/lib/utils';

// ─── Toast ────────────────────────────────────────────────────────────────────

type ToastVariant = 'success' | 'error';

function Toast({ message, visible, variant = 'success' }: { message: string; visible: boolean; variant?: ToastVariant }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className={cn(
            'fixed bottom-28 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-white text-[13.5px] font-semibold shadow-xl whitespace-nowrap flex items-center gap-2',
            variant === 'error' ? 'bg-red-500' : 'bg-gray-900'
          )}
        >
          <div className={cn('w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0', variant === 'error' ? 'bg-white/20' : 'bg-purple-500')}>
            {variant === 'error' ? <X size={11} strokeWidth={3} className="text-white" /> : <Check size={11} strokeWidth={3} className="text-white" />}
          </div>
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Toggle switch ────────────────────────────────────────────────────────────

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      className={cn('relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0', on ? 'bg-purple-500' : 'bg-gray-200')}
    >
      <motion.span
        animate={{ x: on ? 20 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm"
      />
    </button>
  );
}

// ─── Panel wrapper ────────────────────────────────────────────────────────────

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ type: 'spring', damping: 28, stiffness: 260 }}
      className="overflow-hidden"
    >
      <div className="px-4 pb-5 pt-1 border-t border-black/[0.04] space-y-3">
        {children}
      </div>
    </motion.div>
  );
}

// ─── Notification prefs (stored in localStorage) ──────────────────────────────

const NOTIF_KEY = 'nlv_notif_prefs';

function loadNotifPrefs() {
  try {
    const raw = localStorage.getItem(NOTIF_KEY);
    return raw ? JSON.parse(raw) : { likes: true, comments: true, followers: true, messages: true, email: false };
  } catch { return { likes: true, comments: true, followers: true, messages: true, email: false }; }
}

function saveNotifPrefs(prefs: Record<string, boolean>) {
  try { localStorage.setItem(NOTIF_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
}

// ─── Appearance pref (stored in localStorage) ─────────────────────────────────

const THEME_KEY = 'nlv_theme';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Settings() {
  const { signOut, currentUser, updateUser } = useAuth();
  const [, setLocation] = useLocation();
  const [toast, setToast] = useState('');
  const [toastVariant, setToastVariant] = useState<ToastVariant>('success');
  const [toastVisible, setToastVisible] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Personal info form
  const [displayName, setDisplayName] = useState(currentUser?.displayName ?? '');
  const [handle, setHandle] = useState(currentUser?.handle ?? '');
  const [bio, setBio] = useState(currentUser?.bio ?? '');
  const [savingInfo, setSavingInfo] = useState(false);

  // Security form
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [savingPw, setSavingPw] = useState(false);

  // Appearance
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() =>
    (localStorage.getItem(THEME_KEY) as 'light' | 'dark' | 'system') ?? 'light'
  );

  // Notifications
  const [notifPrefs, setNotifPrefs] = useState(loadNotifPrefs);

  // Privacy
  const [privateAccount, setPrivateAccount] = useState(false);
  const [msgPrivacy, setMsgPrivacy] = useState<'everyone' | 'following'>('everyone');

  // Report form
  const [reportText, setReportText] = useState('');
  const [reportCategory, setReportCategory] = useState('bug');
  const [sendingReport, setSendingReport] = useState(false);

  function showToast(msg: string, variant: ToastVariant = 'success') {
    setToast(msg);
    setToastVariant(variant);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  }

  function togglePanel(key: string) {
    setActivePanel(prev => prev === key ? null : key);
  }

  function handleSignOut() {
    signOut();
    setLocation('/login');
  }

  async function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;
    setAvatarUploading(true);
    try {
      const url = await uploadImage(file, 'avatars');
      updateUser({ avatarUrl: url });
      showToast('Profile photo updated!');
    } catch {
      showToast('Upload failed — please try again', 'error');
    } finally {
      setAvatarUploading(false);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  }

  async function handleSaveInfo() {
    if (!currentUser) return;
    if (!displayName.trim()) { showToast('Display name cannot be empty', 'error'); return; }
    if (handle && !/^[a-zA-Z0-9_.]+$/.test(handle)) {
      showToast('Handle can only contain letters, numbers, . and _', 'error'); return;
    }
    setSavingInfo(true);
    try {
      updateUser({ displayName: displayName.trim(), handle: handle.trim() || currentUser.handle, bio: bio.trim() });
      showToast('Profile updated!');
      setActivePanel(null);
    } catch {
      showToast('Failed to save — please try again', 'error');
    } finally {
      setSavingInfo(false);
    }
  }

  async function handleChangePassword() {
    if (!newPw) { showToast('Enter a new password', 'error'); return; }
    if (newPw.length < 6) { showToast('Password must be at least 6 characters', 'error'); return; }
    if (newPw !== confirmPw) { showToast('Passwords don\'t match', 'error'); return; }
    if (!currentPw) { showToast('Enter your current password to confirm', 'error'); return; }

    if (!isFirebaseConfigured) {
      showToast('Password changes require a live account', 'error'); return;
    }

    setSavingPw(true);
    try {
      const { getAuth, reauthenticateWithCredential, EmailAuthProvider, updatePassword } = await import('firebase/auth');
      const fbAuth = getAuth();
      const user = fbAuth.currentUser;
      if (!user || !user.email) throw new Error('No authenticated user');
      const credential = EmailAuthProvider.credential(user.email, currentPw);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPw);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      showToast('Password changed!');
      setActivePanel(null);
    } catch (e: any) {
      const msg = e.code === 'auth/wrong-password' ? 'Current password is incorrect'
        : e.code === 'auth/too-many-requests' ? 'Too many attempts — try again later'
        : 'Failed to change password';
      showToast(msg, 'error');
    } finally {
      setSavingPw(false);
    }
  }

  function handleThemeChange(t: 'light' | 'dark' | 'system') {
    setTheme(t);
    localStorage.setItem(THEME_KEY, t);
    // Apply immediately to the document root
    const root = document.documentElement;
    if (t === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    showToast(t === 'dark' ? 'Dark mode on 🌙' : t === 'system' ? 'Following system theme' : 'Light mode on ☀️');
  }

  function handleNotifToggle(key: string, val: boolean) {
    const next = { ...notifPrefs, [key]: val };
    setNotifPrefs(next);
    saveNotifPrefs(next);
  }

  async function handleSendReport() {
    if (!reportText.trim()) { showToast('Please describe the problem', 'error'); return; }
    setSendingReport(true);
    try {
      if (isFirebaseConfigured && currentUser) {
        const { getFirestore, collection, addDoc, serverTimestamp } = await import('firebase/firestore');
        const db = getFirestore();
        await addDoc(collection(db, 'reports'), {
          userId: currentUser.id,
          category: reportCategory,
          text: reportText.trim(),
          createdAt: serverTimestamp(),
        });
      }
      setReportText('');
      showToast('Report sent — thank you! 🙏');
      setActivePanel(null);
    } catch {
      showToast('Could not send report — try again', 'error');
    } finally {
      setSendingReport(false);
    }
  }

  // ─── Section definitions ───────────────────────────────────────────────────

  type SectionItem = {
    icon: React.ElementType;
    label: string;
    desc: string;
    key: string;
    href?: string;
  };

  const sections: { title: string; items: SectionItem[] }[] = [
    {
      title: 'Account',
      items: [
        { icon: User,   label: 'Personal Information', desc: 'Name, handle, and bio', key: 'personal' },
        { icon: Shield, label: 'Security',             desc: 'Change your password',  key: 'security' },
      ],
    },
    {
      title: 'Preferences',
      items: [
        { icon: Paintbrush, label: 'Appearance',    desc: 'Light, dark, or system theme',      key: 'appearance'  },
        { icon: Bell,       label: 'Notifications', desc: 'Likes, comments, and messages',     key: 'notifications' },
        { icon: Shield,     label: 'Safety & Privacy', desc: 'Block, mute, content filter, and more', key: 'safety'  },
      ],
    },
    {
      title: 'Support',
      items: [
        { icon: AlertTriangle, label: 'Report a Problem',      desc: 'Help us fix issues',      key: 'report'     },
        { icon: FileText,      label: 'Community Guidelines',  desc: 'Rules and policies',      key: 'guidelines' },
        { icon: HelpCircle,    label: 'Help Center',           desc: 'FAQs and support',        key: 'help'       },
      ],
    },
  ];

  const FAQ = [
    { q: 'How do I change my username?', a: 'Go to Personal Information above, update your handle, and tap Save.' },
    { q: 'Can I make my account private?', a: 'Yes — open Privacy settings and toggle "Private account". Only approved followers will see your posts.' },
    { q: 'How do I delete my account?', a: 'Account deletion is permanent. Please email support@noelaven.app from your registered address.' },
    { q: 'Why can\'t I see my posts?', a: 'Posts may take a moment to appear. Pull to refresh the feed, or check your internet connection.' },
    { q: 'How do I report another user?', a: 'Tap the ••• menu on any post or profile and choose "Report". Your report is anonymous.' },
  ];

  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="pb-32 min-h-screen bg-[#FDF9F6] px-4">
      <Toast message={toast} visible={toastVisible} variant={toastVariant} />

      {/* Header */}
      <div className="pt-6 pb-2 mb-6">
        <h1 className="text-[26px] font-black text-gray-900 tracking-tight">Settings</h1>
      </div>

      {/* Hidden file input */}
      <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarFile} />

      {/* Profile card */}
      {currentUser && (
        <div className="bg-white rounded-[24px] border border-black/[0.05] shadow-sm p-5 mb-8 flex items-center gap-4">
          <button
            type="button"
            onClick={isCloudinaryConfigured ? () => avatarInputRef.current?.click() : undefined}
            className={`relative group flex-shrink-0 ${isCloudinaryConfigured ? 'cursor-pointer' : 'cursor-default'}`}
          >
            <GradientAvatar name={currentUser.displayName} src={currentUser.avatarUrl || undefined} size={64} />
            {avatarUploading ? (
              <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              </div>
            ) : isCloudinaryConfigured ? (
              <div className="absolute inset-0 rounded-full bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                <Camera size={18} className="text-white" />
              </div>
            ) : null}
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="font-black text-[17px] text-gray-900 truncate">{currentUser.displayName}</h2>
            <p className="text-[13.5px] text-gray-400 truncate">@{currentUser.handle}</p>
            {isCloudinaryConfigured && (
              <button type="button" onClick={() => avatarInputRef.current?.click()}
                className="text-[12px] text-purple-500 font-semibold mt-0.5 hover:text-purple-700 transition-colors">
                Change photo
              </button>
            )}
          </div>
          <Link href={`/profile/${currentUser.id}`}>
            <motion.button whileTap={{ scale: 0.93 }}
              className="px-4 py-2 rounded-full text-[13px] font-bold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)', boxShadow: '0 3px 12px rgba(107,115,255,0.30)' }}>
              View
            </motion.button>
          </Link>
        </div>
      )}

      {/* Sections */}
      <div className="space-y-7">
        {sections.map(section => (
          <div key={section.title}>
            <p className="text-[11.5px] font-black text-gray-400 uppercase tracking-widest mb-2.5 px-1">
              {section.title}
            </p>
            <div className="bg-white rounded-[22px] border border-black/[0.05] shadow-sm overflow-hidden">
              {section.items.map((item) => (
                <div key={item.key}>
                  <motion.button
                    whileTap={{ scale: 0.99 }}
                    onClick={() => item.key === 'safety' ? setLocation('/safety') : togglePanel(item.key)}
                    className="w-full flex items-center gap-3.5 px-4 py-4 text-left hover:bg-gray-50 transition-colors border-b border-black/[0.04] last:border-0 group"
                  >
                    <div className={cn(
                      'w-10 h-10 rounded-[14px] flex items-center justify-center flex-shrink-0 transition-colors',
                      activePanel === item.key ? 'bg-purple-100' : 'bg-gray-100 group-hover:bg-purple-50'
                    )}>
                      <item.icon size={19} className={cn('transition-colors', activePanel === item.key ? 'text-purple-600' : 'text-gray-500 group-hover:text-purple-500')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[14.5px] text-gray-900">{item.label}</p>
                      <p className="text-[12px] text-gray-400 mt-0.5">{item.desc}</p>
                    </div>
                    {item.key === 'safety' ? (
                      <ChevronRight size={17} className="text-gray-300 flex-shrink-0" />
                    ) : (
                      <ChevronDown
                        size={17}
                        className={cn('text-gray-300 transition-all flex-shrink-0', activePanel === item.key ? 'rotate-180 text-purple-400' : 'group-hover:text-gray-500')}
                      />
                    )}
                  </motion.button>

                  <AnimatePresence>
                    {activePanel === item.key && (
                      <Panel key={item.key}>

                        {/* ── Personal Information ── */}
                        {item.key === 'personal' && (
                          <div className="space-y-3 pt-1">
                            <div>
                              <label className="text-[11.5px] font-bold text-gray-500 uppercase tracking-wide">Display Name</label>
                              <input
                                value={displayName}
                                onChange={e => setDisplayName(e.target.value)}
                                maxLength={50}
                                className="mt-1.5 w-full px-3.5 py-2.5 rounded-xl border border-black/[0.08] text-[14px] text-gray-900 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all bg-gray-50"
                              />
                            </div>
                            <div>
                              <label className="text-[11.5px] font-bold text-gray-500 uppercase tracking-wide">Handle</label>
                              <div className="relative mt-1.5">
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-[14px]">@</span>
                                <input
                                  value={handle}
                                  onChange={e => setHandle(e.target.value.replace(/[^a-zA-Z0-9_.]/g, ''))}
                                  maxLength={30}
                                  className="w-full pl-7 pr-3.5 py-2.5 rounded-xl border border-black/[0.08] text-[14px] text-gray-900 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all bg-gray-50"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="text-[11.5px] font-bold text-gray-500 uppercase tracking-wide">Bio</label>
                              <textarea
                                value={bio}
                                onChange={e => setBio(e.target.value)}
                                maxLength={160}
                                rows={3}
                                className="mt-1.5 w-full px-3.5 py-2.5 rounded-xl border border-black/[0.08] text-[14px] text-gray-900 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all bg-gray-50 resize-none"
                              />
                              <p className="text-right text-[11px] text-gray-400 mt-0.5">{bio.length}/160</p>
                            </div>
                            <motion.button
                              whileTap={{ scale: 0.97 }}
                              onClick={handleSaveInfo}
                              disabled={savingInfo}
                              className="w-full py-3 rounded-xl font-bold text-[14px] text-white transition-opacity disabled:opacity-60"
                              style={{ background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)' }}
                            >
                              {savingInfo ? 'Saving…' : 'Save Changes'}
                            </motion.button>
                          </div>
                        )}

                        {/* ── Security ── */}
                        {item.key === 'security' && (
                          <div className="space-y-3 pt-1">
                            {!isFirebaseConfigured && (
                              <p className="text-[13px] text-amber-600 bg-amber-50 rounded-xl px-3 py-2.5">
                                Password changes require a live account — currently in demo mode.
                              </p>
                            )}
                            <div>
                              <label className="text-[11.5px] font-bold text-gray-500 uppercase tracking-wide">Current Password</label>
                              <div className="relative mt-1.5">
                                <input
                                  type={showPw ? 'text' : 'password'}
                                  value={currentPw}
                                  onChange={e => setCurrentPw(e.target.value)}
                                  placeholder="Enter current password"
                                  className="w-full px-3.5 pr-10 py-2.5 rounded-xl border border-black/[0.08] text-[14px] text-gray-900 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all bg-gray-50"
                                />
                                <button type="button" onClick={() => setShowPw(v => !v)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                              </div>
                            </div>
                            <div>
                              <label className="text-[11.5px] font-bold text-gray-500 uppercase tracking-wide">New Password</label>
                              <input
                                type={showPw ? 'text' : 'password'}
                                value={newPw}
                                onChange={e => setNewPw(e.target.value)}
                                placeholder="At least 6 characters"
                                className="mt-1.5 w-full px-3.5 py-2.5 rounded-xl border border-black/[0.08] text-[14px] text-gray-900 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all bg-gray-50"
                              />
                            </div>
                            <div>
                              <label className="text-[11.5px] font-bold text-gray-500 uppercase tracking-wide">Confirm New Password</label>
                              <input
                                type={showPw ? 'text' : 'password'}
                                value={confirmPw}
                                onChange={e => setConfirmPw(e.target.value)}
                                placeholder="Repeat new password"
                                className="mt-1.5 w-full px-3.5 py-2.5 rounded-xl border border-black/[0.08] text-[14px] text-gray-900 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all bg-gray-50"
                              />
                            </div>
                            <motion.button
                              whileTap={{ scale: 0.97 }}
                              onClick={handleChangePassword}
                              disabled={savingPw || !isFirebaseConfigured}
                              className="w-full py-3 rounded-xl font-bold text-[14px] text-white transition-opacity disabled:opacity-50"
                              style={{ background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)' }}
                            >
                              {savingPw ? 'Changing…' : 'Change Password'}
                            </motion.button>
                          </div>
                        )}

                        {/* ── Appearance ── */}
                        {item.key === 'appearance' && (
                          <div className="pt-1 space-y-2">
                            {(['light', 'dark', 'system'] as const).map(t => (
                              <button
                                key={t}
                                onClick={() => handleThemeChange(t)}
                                className={cn(
                                  'w-full flex items-center gap-3 px-3.5 py-3 rounded-xl border transition-all text-left',
                                  theme === t ? 'border-purple-300 bg-purple-50' : 'border-black/[0.06] bg-gray-50 hover:bg-gray-100'
                                )}
                              >
                                {t === 'light' && <Sun size={17} className="text-amber-400 flex-shrink-0" />}
                                {t === 'dark'  && <Moon size={17} className="text-indigo-400 flex-shrink-0" />}
                                {t === 'system' && <Monitor size={17} className="text-gray-400 flex-shrink-0" />}
                                <span className="text-[14px] font-semibold text-gray-800 capitalize flex-1">{t === 'system' ? 'System default' : `${t.charAt(0).toUpperCase() + t.slice(1)} mode`}</span>
                                {theme === t && <Check size={15} className="text-purple-500 flex-shrink-0" />}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* ── Notifications ── */}
                        {item.key === 'notifications' && (
                          <div className="pt-1 space-y-3">
                            {([
                              { key: 'likes',     label: 'Likes & reactions',  desc: 'When someone likes your post' },
                              { key: 'comments',  label: 'Comments & replies', desc: 'When someone replies to you' },
                              { key: 'followers', label: 'New followers',       desc: 'When someone follows you' },
                              { key: 'messages',  label: 'Messages',            desc: 'New direct message alerts' },
                              { key: 'email',     label: 'Email digest',        desc: 'Weekly activity summary' },
                            ] as const).map(row => (
                              <div key={row.key} className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-[13.5px] font-semibold text-gray-900">{row.label}</p>
                                  <p className="text-[12px] text-gray-400">{row.desc}</p>
                                </div>
                                <Toggle on={notifPrefs[row.key]} onChange={v => handleNotifToggle(row.key, v)} />
                              </div>
                            ))}
                          </div>
                        )}

                        {/* ── Privacy (legacy — replaced by /safety page) ── */}
                        {item.key === '_privacy_legacy' && (
                          <div className="pt-1 space-y-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-[13.5px] font-semibold text-gray-900">Private account</p>
                                <p className="text-[12px] text-gray-400">Only approved followers see your posts</p>
                              </div>
                              <Toggle on={privateAccount} onChange={setPrivateAccount} />
                            </div>
                            <div>
                              <p className="text-[13.5px] font-semibold text-gray-900 mb-2">Who can message you</p>
                              {(['everyone', 'following'] as const).map(opt => (
                                <button
                                  key={opt}
                                  onClick={() => setMsgPrivacy(opt)}
                                  className={cn(
                                    'w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl border mb-1.5 transition-all text-left',
                                    msgPrivacy === opt ? 'border-purple-300 bg-purple-50' : 'border-black/[0.06] bg-gray-50'
                                  )}
                                >
                                  <div className={cn('w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                                    msgPrivacy === opt ? 'border-purple-500' : 'border-gray-300')}>
                                    {msgPrivacy === opt && <div className="w-2 h-2 rounded-full bg-purple-500" />}
                                  </div>
                                  <span className="text-[13.5px] font-medium text-gray-800 capitalize">{opt === 'following' ? 'People I follow' : 'Everyone'}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* ── Report a Problem ── */}
                        {item.key === 'report' && (
                          <div className="pt-1 space-y-3">
                            <div>
                              <label className="text-[11.5px] font-bold text-gray-500 uppercase tracking-wide">Category</label>
                              <select
                                value={reportCategory}
                                onChange={e => setReportCategory(e.target.value)}
                                className="mt-1.5 w-full px-3.5 py-2.5 rounded-xl border border-black/[0.08] text-[14px] text-gray-900 outline-none focus:border-purple-400 bg-gray-50 appearance-none"
                              >
                                <option value="bug">Bug or glitch</option>
                                <option value="content">Inappropriate content</option>
                                <option value="account">Account issue</option>
                                <option value="other">Other</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[11.5px] font-bold text-gray-500 uppercase tracking-wide">Description</label>
                              <textarea
                                value={reportText}
                                onChange={e => setReportText(e.target.value)}
                                rows={4}
                                placeholder="Describe what happened…"
                                className="mt-1.5 w-full px-3.5 py-2.5 rounded-xl border border-black/[0.08] text-[14px] text-gray-900 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 transition-all bg-gray-50 resize-none"
                              />
                            </div>
                            <motion.button
                              whileTap={{ scale: 0.97 }}
                              onClick={handleSendReport}
                              disabled={sendingReport || !reportText.trim()}
                              className="w-full py-3 rounded-xl font-bold text-[14px] text-white flex items-center justify-center gap-2 disabled:opacity-50"
                              style={{ background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)' }}
                            >
                              <Send size={15} />
                              {sendingReport ? 'Sending…' : 'Send Report'}
                            </motion.button>
                          </div>
                        )}

                        {/* ── Community Guidelines ── */}
                        {item.key === 'guidelines' && (
                          <div className="pt-1 space-y-2">
                            {[
                              { emoji: '💜', rule: 'Be kind and respectful to everyone in the community.' },
                              { emoji: '🚫', rule: 'No hate speech, harassment, or discrimination of any kind.' },
                              { emoji: '🔒', rule: 'Respect others\' privacy — don\'t share personal information without consent.' },
                              { emoji: '✅', rule: 'Only share content you own or have rights to use.' },
                              { emoji: '📣', rule: 'Keep conversations constructive — disagreement is fine, hostility is not.' },
                              { emoji: '🛡️', rule: 'Report violations using the ••• menu. We review every report.' },
                            ].map(({ emoji, rule }, i) => (
                              <div key={i} className="flex items-start gap-2.5 py-2">
                                <span className="text-lg leading-5 flex-shrink-0">{emoji}</span>
                                <p className="text-[13.5px] text-gray-700 leading-relaxed">{rule}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* ── Help Center ── */}
                        {item.key === 'help' && (
                          <div className="pt-1 space-y-1">
                            {FAQ.map((faq, i) => (
                              <div key={i} className="border border-black/[0.05] rounded-xl overflow-hidden">
                                <button
                                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                                  className="w-full flex items-center justify-between px-3.5 py-3 text-left bg-gray-50 hover:bg-gray-100 transition-colors"
                                >
                                  <span className="text-[13.5px] font-semibold text-gray-900 pr-2">{faq.q}</span>
                                  <ChevronDown size={15} className={cn('text-gray-400 flex-shrink-0 transition-transform', openFaq === i && 'rotate-180')} />
                                </button>
                                <AnimatePresence>
                                  {openFaq === i && (
                                    <motion.div
                                      initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                                      className="overflow-hidden"
                                    >
                                      <p className="px-3.5 py-3 text-[13px] text-gray-600 leading-relaxed border-t border-black/[0.04]">{faq.a}</p>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            ))}
                          </div>
                        )}

                      </Panel>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Sign out */}
        <div className="pt-2">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2.5 py-4 rounded-[20px] text-red-500 font-bold text-[15px] bg-red-50 hover:bg-red-100 border border-red-100 transition-colors"
          >
            <LogOut size={19} />
            Sign Out
          </motion.button>
          <p className="text-center text-[12px] text-gray-400 mt-5 font-medium">
            Noelaven v1.0.0 · Made with 💜
          </p>
        </div>
      </div>
    </div>
  );
}
