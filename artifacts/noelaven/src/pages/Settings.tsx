import React, { useState, useRef, useEffect } from 'react';
import {
  User, Bell, Lock, Shield, AlertTriangle, LogOut,
  ChevronRight, Paintbrush, FileText, HelpCircle, Check, Camera,
  X, ChevronDown, Sun, Moon, Monitor, Eye, EyeOff, Send,
  UserPlus, UserCheck, Settings2, ArrowLeftRight, Trash2,
  Crown, Download, Mail, BellOff,
} from 'lucide-react';
import { FounderBadge } from '@/components/ui/FounderBadge';
import { auth } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation, Link } from 'wouter';
import { GradientAvatar } from '@/components/ui/GradientAvatar';
import type { SavedAccount } from '@/lib/accountStore';
import { removeSavedAccount, getSavedAccounts } from '@/lib/accountStore';
import { motion, AnimatePresence } from 'framer-motion';
import { uploadImage, isCloudinaryConfigured } from '@/lib/cloudinary';
import { isFirebaseConfigured } from '@/lib/firebase';
import { registerFCMToken, registerMessagingServiceWorker } from '@/lib/fcmToken';
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
          <div className={cn('w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0', variant === 'error' ? 'bg-[#111]/20' : 'bg-[#F5C542]')}>
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
      className={cn('relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0', on ? 'bg-[#F5C542]' : 'bg-[#222]')}
    >
      <motion.span
        animate={{ x: on ? 20 : 2 }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className="absolute top-1 w-4 h-4 rounded-full bg-[#111] shadow-sm"
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
      <div className="px-4 pb-5 pt-1 border-t border-[#1a1a1a] space-y-3">
        {children}
      </div>
    </motion.div>
  );
}

// ─── Notification prefs (stored in localStorage) ──────────────────────────────

const NOTIF_KEY = 'nlv_notif_prefs';

const DEFAULT_NOTIF_PREFS = {
  likes: true, comments: true, replies: true, followers: true,
  messages: true, mentions: true, storyReplies: true, dailySpark: true,
  communityInvites: true, reactions: true, email: false,
};

function loadNotifPrefs() {
  try {
    const raw = localStorage.getItem(NOTIF_KEY);
    return raw ? { ...DEFAULT_NOTIF_PREFS, ...JSON.parse(raw) } : { ...DEFAULT_NOTIF_PREFS };
  } catch { return { ...DEFAULT_NOTIF_PREFS }; }
}

function saveNotifPrefs(prefs: Record<string, boolean>) {
  try { localStorage.setItem(NOTIF_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
}

// ─── Appearance pref (stored in localStorage) ─────────────────────────────────

const THEME_KEY = 'nlv_theme';

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Settings() {
  const { signOut, currentUser, updateUser, savedAccounts, startAddAccount, switchToAccount, isFounder } = useAuth();
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

  // Change email
  const [newEmail, setNewEmail] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  // Delete account
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);

  // Download data
  const [downloadingData, setDownloadingData] = useState(false);

  // Appearance
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() =>
    (localStorage.getItem(THEME_KEY) as 'light' | 'dark' | 'system') ?? 'light'
  );

  // Notifications
  const [notifPrefs, setNotifPrefs] = useState(loadNotifPrefs);

  // Push notification permission state (re-check on mount and after enabling)
  const [pushPermission, setPushPermission] = useState<NotificationPermission>(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [enablingPush, setEnablingPush] = useState(false);

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setPushPermission(Notification.permission);
    }
  }, [activePanel]);

  async function handleEnablePush() {
    if (!currentUser || !isFirebaseConfigured) return;
    setEnablingPush(true);
    try {
      await registerMessagingServiceWorker();
      const permission = await Notification.requestPermission();
      setPushPermission(permission);
      if (permission === 'granted') {
        // Clear the "dismissed" key so the prompt won't fight with this
        localStorage.removeItem('nlv_notif_prompt_dismissed');
        await registerFCMToken(currentUser.id);
        showToast('Push notifications enabled!', 'success');
      }
    } catch (err) {
      console.error('[FCM] enable push failed:', err);
    } finally {
      setEnablingPush(false);
    }
  }

  // Sign out confirmation
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);

  // Multi-account sheets
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  // Local copy of saved accounts so we can remove without page reload
  const [localAccounts, setLocalAccounts] = useState(() => getSavedAccounts());

  // Privacy
  const [privateAccount, setPrivateAccount] = useState(false);
  const [msgPrivacy, setMsgPrivacy] = useState<'everyone' | 'following'>('everyone');

  // Report form
  const [reportText, setReportText] = useState('');
  const [reportCategory, setReportCategory] = useState('bug');
  const [sendingReport, setSendingReport] = useState(false);

  async function handleChangeEmail() {
    if (!newEmail.trim() || !auth?.currentUser) return;
    setSavingEmail(true);
    try {
      const { updateEmail } = await import('firebase/auth');
      await updateEmail(auth.currentUser, newEmail.trim());
      showToast('Email updated! Check your inbox to verify.');
      setNewEmail('');
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/requires-recent-login') {
        showToast('Sign out and sign back in to change your email.', 'error');
      } else {
        showToast('Could not update email. Try again.', 'error');
      }
    } finally { setSavingEmail(false); }
  }

  async function handleDownloadData() {
    setDownloadingData(true);
    try {
      const data = {
        exportedAt: new Date().toISOString(),
        profile: currentUser ? {
          id: currentUser.id, displayName: currentUser.displayName,
          handle: currentUser.handle, bio: currentUser.bio,
          joinedAt: currentUser.joinedAt,
        } : null,
        notice: 'Full post/story/message history is processed server-side and emailed within 24 hours.',
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'noelaven-data.json'; a.click();
      URL.revokeObjectURL(url);
      showToast('Profile data exported.');
    } catch { showToast('Export failed. Try again.', 'error'); }
    finally { setDownloadingData(false); }
  }

  async function handleDeleteAccount() {
    if (!auth?.currentUser) return;
    setDeletingAccount(true);
    try {
      const { deleteUser } = await import('firebase/auth');
      await deleteUser(auth.currentUser);
      showToast('Account deleted.');
      await signOut();
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code;
      if (code === 'auth/requires-recent-login') {
        showToast('Sign out and sign in again to confirm deletion.', 'error');
      } else { showToast('Could not delete account. Try again.', 'error'); }
    } finally { setDeletingAccount(false); setDeleteConfirm(false); }
  }

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
    setSignOutConfirmOpen(true);
  }

  async function confirmSignOut() {
    setSignOutConfirmOpen(false);
    await signOut();
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
    // Also persist to Firestore so server-side notification writes respect prefs
    if (isFirebaseConfigured && currentUser) {
      import('@/lib/firestore').then(({ saveUserNotifPrefs }) => {
        saveUserNotifPrefs(currentUser.id, next).catch(() => {});
      });
    }
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
    /** If set, tapping calls this function instead of opening an accordion panel. */
    onPress?: () => void;
    danger?: boolean;
  };

  const sections: { title: string; items: SectionItem[] }[] = [
    {
      title: 'Accounts',
      items: [
        {
          icon: UserPlus,
          label: 'Add Account',
          desc: 'Sign in to another Noelaven account',
          key: 'add-account',
          onPress: startAddAccount,
        },
        {
          icon: ArrowLeftRight,
          label: 'Switch Account',
          desc: savedAccounts.length > 1
            ? `${savedAccounts.length} accounts saved on this device`
            : 'Manage signed-in accounts',
          key: 'switch-account',
          onPress: () => setSwitcherOpen(true),
        },
        {
          icon: UserCheck,
          label: 'Manage Account',
          desc: 'Email, membership, and account info',
          key: 'manage-account',
          onPress: () => setManageOpen(true),
        },
        {
          icon: LogOut,
          label: 'Sign Out',
          desc: `Signed in as @${currentUser?.handle ?? '…'}`,
          key: 'sign-out',
          danger: true,
          onPress: handleSignOut,
        },
      ],
    },
    {
      title: 'Account',
      items: [
        { icon: User,     label: 'Personal Information', desc: 'Name, handle, and bio',            key: 'personal'  },
        { icon: Shield,   label: 'Security',             desc: 'Password & email',                   key: 'security'  },
        { icon: Download, label: 'Download My Data',     desc: 'Export your profile & posts',        key: 'download'  },
        { icon: Trash2,   label: 'Delete Account',       desc: 'Permanently remove your account',    key: 'delete', danger: true },
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
    <div className="pb-32 min-h-screen bg-black px-4">
      <Toast message={toast} visible={toastVisible} variant={toastVariant} />

      {/* Header */}
      <div className="pt-6 pb-2 mb-6">
        <h1 className="text-[26px] font-black text-white tracking-tight">Settings</h1>
      </div>

      {/* Hidden file input */}
      <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarFile} />

      {/* Profile card */}
      {currentUser && (
        <div className="bg-[#111] rounded-[24px] border border-[#1a1a1a] shadow-sm p-5 mb-8 flex items-center gap-4">
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
            <h2 className="font-black text-[17px] text-white truncate">{currentUser.displayName}</h2>
            <p className="text-[13.5px] text-[rgba(255,255,255,0.45)] truncate">@{currentUser.handle}</p>
            {isCloudinaryConfigured && (
              <button type="button" onClick={() => avatarInputRef.current?.click()}
                className="text-[12px] text-[#F5C542] font-semibold mt-0.5 hover:text-purple-700 transition-colors">
                Change photo
              </button>
            )}
          </div>
          <Link href={`/profile/${currentUser.id}`}>
            <motion.button whileTap={{ scale: 0.93 }}
              className="px-4 py-2 rounded-full text-[13px] font-bold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #C9982A, #F5C542)', boxShadow: '0 3px 12px rgba(245,197,66,0.30)' }}>
              View
            </motion.button>
          </Link>
        </div>
      )}

      {/* Founder Control Center — only for the Founder account */}
      <AnimatePresence>
        {isFounder && (
          <motion.div
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="rounded-[22px] overflow-hidden mb-6 shadow-lg"
            style={{ background: 'linear-gradient(135deg, #3B0764 0%, #5B21B6 45%, #92400E 100%)' }}
          >
            <div className="p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-[#111]/20 flex items-center justify-center ring-2 ring-white/10">
                  <Crown size={20} className="text-yellow-300 drop-shadow" />
                </div>
                <div>
                  <p className="text-[16px] font-black text-white leading-tight">Founder Control Center</p>
                  <p className="text-[11.5px] text-white/60 mt-0.5">Full platform access · All actions logged</p>
                </div>
              </div>
              <div className="space-y-2">
                <Link href="/moderation">
                  <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[#111]/10 hover:bg-[#111]/20 transition-colors text-left">
                    <Shield size={15} className="text-[#F5C542] flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] font-bold text-white">Moderation Dashboard</p>
                      <p className="text-[11px] text-white/55">Reports · Suspensions · Bans</p>
                    </div>
                    <ChevronRight size={13} className="text-white/40 flex-shrink-0" />
                  </button>
                </Link>
                <Link href="/moderation">
                  <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[#111]/10 hover:bg-[#111]/20 transition-colors text-left">
                    <UserCheck size={15} className="text-blue-200 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13.5px] font-bold text-white">Moderation Log</p>
                      <p className="text-[11px] text-white/55">Full audit trail of all actions</p>
                    </div>
                    <ChevronRight size={13} className="text-white/40 flex-shrink-0" />
                  </button>
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Sections */}
      <div className="space-y-7">
        {sections.map(section => (
          <div key={section.title}>
            <p className="text-[11.5px] font-black text-[rgba(255,255,255,0.45)] uppercase tracking-widest mb-2.5 px-1">
              {section.title}
            </p>
            <div className="bg-[#111] rounded-[22px] border border-[#1a1a1a] shadow-sm overflow-hidden">
              {section.items.map((item) => (
                <div key={item.key}>
                  <motion.button
                    whileTap={{ scale: 0.99 }}
                    onClick={() => {
                      if (item.onPress) { item.onPress(); return; }
                      if (item.key === 'safety') { setLocation('/safety'); return; }
                      togglePanel(item.key);
                    }}
                    className="w-full flex items-center gap-3.5 px-4 py-4 text-left hover:bg-[#111] transition-colors border-b border-[#1a1a1a] last:border-0 group"
                  >
                    <div className={cn(
                      'w-10 h-10 rounded-[14px] flex items-center justify-center flex-shrink-0 transition-colors',
                      item.danger
                        ? 'bg-red-50 group-hover:bg-red-100'
                        : activePanel === item.key
                          ? 'bg-[rgba(245,197,66,0.15)]'
                          : 'bg-[#1a1a1a] group-hover:bg-[rgba(245,197,66,0.08)]'
                    )}>
                      <item.icon size={19} className={cn(
                        'transition-colors',
                        item.danger
                          ? 'text-red-500'
                          : activePanel === item.key
                            ? 'text-[#F5C542]'
                            : 'text-[#BDBDBD] group-hover:text-[#F5C542]'
                      )} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('font-semibold text-[14.5px]', item.danger ? 'text-red-500' : 'text-white')}>{item.label}</p>
                      <p className="text-[12px] text-[rgba(255,255,255,0.45)] mt-0.5">{item.desc}</p>
                    </div>
                    {/* Action items show ChevronRight; accordion items show ChevronDown */}
                    {(item.onPress || item.key === 'safety') ? (
                      item.danger
                        ? null
                        : <ChevronRight size={17} className="text-[rgba(255,255,255,0.35)] flex-shrink-0" />
                    ) : (
                      <ChevronDown
                        size={17}
                        className={cn('text-[rgba(255,255,255,0.35)] transition-all flex-shrink-0', activePanel === item.key ? 'rotate-180 text-[#F5C542]' : 'group-hover:text-[#BDBDBD]')}
                      />
                    )}
                  </motion.button>

                  <AnimatePresence>
                    {!item.onPress && activePanel === item.key && (
                      <Panel key={item.key}>

                        {/* ── Personal Information ── */}
                        {item.key === 'personal' && (
                          <div className="space-y-3 pt-1">
                            <div>
                              <label className="text-[11.5px] font-bold text-[#BDBDBD] uppercase tracking-wide">Display Name</label>
                              <input
                                value={displayName}
                                onChange={e => setDisplayName(e.target.value)}
                                maxLength={50}
                                className="mt-1.5 w-full px-3.5 py-2.5 rounded-xl border border-[#2a2a2a] text-[14px] text-white outline-none focus:border-[#F5C542] focus:ring-2 focus:ring-[rgba(245,197,66,0.15)] transition-all bg-[#111]"
                              />
                            </div>
                            <div>
                              <label className="text-[11.5px] font-bold text-[#BDBDBD] uppercase tracking-wide">Handle</label>
                              <div className="relative mt-1.5">
                                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[rgba(255,255,255,0.45)] text-[14px]">@</span>
                                <input
                                  value={handle}
                                  onChange={e => setHandle(e.target.value.replace(/[^a-zA-Z0-9_.]/g, ''))}
                                  maxLength={30}
                                  className="w-full pl-7 pr-3.5 py-2.5 rounded-xl border border-[#2a2a2a] text-[14px] text-white outline-none focus:border-[#F5C542] focus:ring-2 focus:ring-[rgba(245,197,66,0.15)] transition-all bg-[#111]"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="text-[11.5px] font-bold text-[#BDBDBD] uppercase tracking-wide">Bio</label>
                              <textarea
                                value={bio}
                                onChange={e => setBio(e.target.value)}
                                maxLength={160}
                                rows={3}
                                className="mt-1.5 w-full px-3.5 py-2.5 rounded-xl border border-[#2a2a2a] text-[14px] text-white outline-none focus:border-[#F5C542] focus:ring-2 focus:ring-[rgba(245,197,66,0.15)] transition-all bg-[#111] resize-none"
                              />
                              <p className="text-right text-[11px] text-[rgba(255,255,255,0.45)] mt-0.5">{bio.length}/160</p>
                            </div>
                            <motion.button
                              whileTap={{ scale: 0.97 }}
                              onClick={handleSaveInfo}
                              disabled={savingInfo}
                              className="w-full py-3 rounded-xl font-bold text-[14px] text-white transition-opacity disabled:opacity-60"
                              style={{ background: 'linear-gradient(135deg, #C9982A, #F5C542)' }}
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
                              <label className="text-[11.5px] font-bold text-[#BDBDBD] uppercase tracking-wide">Current Password</label>
                              <div className="relative mt-1.5">
                                <input
                                  type={showPw ? 'text' : 'password'}
                                  value={currentPw}
                                  onChange={e => setCurrentPw(e.target.value)}
                                  placeholder="Enter current password"
                                  className="w-full px-3.5 pr-10 py-2.5 rounded-xl border border-[#2a2a2a] text-[14px] text-white outline-none focus:border-[#F5C542] focus:ring-2 focus:ring-[rgba(245,197,66,0.15)] transition-all bg-[#111]"
                                />
                                <button type="button" onClick={() => setShowPw(v => !v)}
                                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[rgba(255,255,255,0.45)]">
                                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                                </button>
                              </div>
                            </div>
                            <div>
                              <label className="text-[11.5px] font-bold text-[#BDBDBD] uppercase tracking-wide">New Password</label>
                              <input
                                type={showPw ? 'text' : 'password'}
                                value={newPw}
                                onChange={e => setNewPw(e.target.value)}
                                placeholder="At least 6 characters"
                                className="mt-1.5 w-full px-3.5 py-2.5 rounded-xl border border-[#2a2a2a] text-[14px] text-white outline-none focus:border-[#F5C542] focus:ring-2 focus:ring-[rgba(245,197,66,0.15)] transition-all bg-[#111]"
                              />
                            </div>
                            <div>
                              <label className="text-[11.5px] font-bold text-[#BDBDBD] uppercase tracking-wide">Confirm New Password</label>
                              <input
                                type={showPw ? 'text' : 'password'}
                                value={confirmPw}
                                onChange={e => setConfirmPw(e.target.value)}
                                placeholder="Repeat new password"
                                className="mt-1.5 w-full px-3.5 py-2.5 rounded-xl border border-[#2a2a2a] text-[14px] text-white outline-none focus:border-[#F5C542] focus:ring-2 focus:ring-[rgba(245,197,66,0.15)] transition-all bg-[#111]"
                              />
                            </div>
                            <motion.button
                              whileTap={{ scale: 0.97 }}
                              onClick={handleChangePassword}
                              disabled={savingPw || !isFirebaseConfigured}
                              className="w-full py-3 rounded-xl font-bold text-[14px] text-white transition-opacity disabled:opacity-50"
                              style={{ background: 'linear-gradient(135deg, #C9982A, #F5C542)' }}
                            >
                              {savingPw ? 'Changing…' : 'Change Password'}
                            </motion.button>

                            {/* ── Change Email ── */}
                            <div className="border-t border-[#222] pt-4 mt-2">
                              <p className="text-[11.5px] font-black text-[#BDBDBD] uppercase tracking-wide mb-3 flex items-center gap-1.5">
                                <Mail size={11} /> Change Email
                              </p>
                              {!isFirebaseConfigured && (
                                <p className="text-[13px] text-amber-600 bg-amber-50 rounded-xl px-3 py-2.5 mb-2">
                                  Email changes require a live account.
                                </p>
                              )}
                              <input
                                type="email"
                                value={newEmail}
                                onChange={e => setNewEmail(e.target.value)}
                                placeholder="New email address"
                                className="w-full px-3.5 py-2.5 rounded-xl border border-[#2a2a2a] text-[14px] text-white outline-none focus:border-[#F5C542] focus:ring-2 focus:ring-[rgba(245,197,66,0.15)] transition-all bg-[#111]"
                              />
                              <motion.button
                                whileTap={{ scale: 0.97 }}
                                onClick={handleChangeEmail}
                                disabled={savingEmail || !isFirebaseConfigured || !newEmail.trim()}
                                className="mt-2 w-full py-3 rounded-xl font-bold text-[14px] text-white transition-opacity disabled:opacity-50"
                                style={{ background: 'linear-gradient(135deg, #C9982A, #F5C542)' }}
                              >
                                {savingEmail ? 'Updating…' : 'Update Email'}
                              </motion.button>
                            </div>
                          </div>
                        )}

                        {/* ── Download My Data ── */}
                        {item.key === 'download' && (
                          <div className="space-y-3 pt-1">
                            <p className="text-[13px] text-[#BDBDBD] leading-relaxed">
                              Download a copy of your profile data. A full export of your posts, stories, and messages
                              is processed server-side and emailed within 24 hours.
                            </p>
                            <motion.button
                              whileTap={{ scale: 0.97 }}
                              onClick={handleDownloadData}
                              disabled={downloadingData}
                              className="w-full py-3 rounded-xl font-bold text-[14px] text-white transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
                              style={{ background: 'linear-gradient(135deg, #C9982A, #F5C542)' }}
                            >
                              <Download size={15} />
                              {downloadingData ? 'Exporting…' : 'Download My Data'}
                            </motion.button>
                          </div>
                        )}

                        {/* ── Delete Account ── */}
                        {item.key === 'delete' && (
                          <div className="space-y-3 pt-1">
                            <div className="bg-red-50 border border-red-100 rounded-xl px-3.5 py-3">
                              <p className="text-[13px] font-bold text-red-700 mb-1">⚠️ This action is irreversible</p>
                              <p className="text-[12.5px] text-red-600 leading-relaxed">
                                Your account, posts, stories, and all associated data will be permanently deleted.
                                This cannot be undone.
                              </p>
                            </div>
                            {!deleteConfirm ? (
                              <motion.button
                                whileTap={{ scale: 0.97 }}
                                onClick={() => setDeleteConfirm(true)}
                                disabled={!isFirebaseConfigured}
                                className="w-full py-3 rounded-xl font-bold text-[14px] text-white bg-red-500 hover:bg-red-600 transition-all disabled:opacity-50"
                              >
                                {isFirebaseConfigured ? 'Delete My Account' : 'Requires live account'}
                              </motion.button>
                            ) : (
                              <div className="space-y-2">
                                <p className="text-[13px] font-bold text-[#BDBDBD]">Type <span className="font-black text-red-500 font-mono">DELETE</span> to confirm:</p>
                                <input
                                  type="text"
                                  value={deleteInput}
                                  onChange={e => setDeleteInput(e.target.value)}
                                  placeholder="DELETE"
                                  className="w-full px-3.5 py-2.5 rounded-xl border border-red-200 text-[14px] text-white outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 bg-red-50 transition-all font-mono"
                                />
                                <div className="flex gap-2">
                                  <button onClick={() => { setDeleteConfirm(false); setDeleteInput(''); }}
                                    className="flex-1 py-3 rounded-xl border border-[#2a2a2a] font-bold text-[14px] text-[#BDBDBD] hover:bg-[#111]">
                                    Cancel
                                  </button>
                                  <motion.button
                                    whileTap={{ scale: 0.97 }}
                                    onClick={handleDeleteAccount}
                                    disabled={deletingAccount || deleteInput !== 'DELETE'}
                                    className="flex-1 py-3 rounded-xl font-bold text-[14px] text-white bg-red-500 hover:bg-red-600 transition-all disabled:opacity-50"
                                  >
                                    {deletingAccount ? 'Deleting…' : 'Confirm Delete'}
                                  </motion.button>
                                </div>
                              </div>
                            )}
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
                                  theme === t ? 'border-[#F5C542] bg-[rgba(245,197,66,0.08)]' : 'border-[#1a1a1a] bg-[#111] hover:bg-[#1a1a1a]'
                                )}
                              >
                                {t === 'light' && <Sun size={17} className="text-amber-400 flex-shrink-0" />}
                                {t === 'dark'  && <Moon size={17} className="text-indigo-400 flex-shrink-0" />}
                                {t === 'system' && <Monitor size={17} className="text-[rgba(255,255,255,0.45)] flex-shrink-0" />}
                                <span className="text-[14px] font-semibold text-white capitalize flex-1">{t === 'system' ? 'System default' : `${t.charAt(0).toUpperCase() + t.slice(1)} mode`}</span>
                                {theme === t && <Check size={15} className="text-[#F5C542] flex-shrink-0" />}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* ── Notifications ── */}
                        {item.key === 'notifications' && (
                          <div className="pt-1 space-y-3">
                            {/* Push permission banner — shown when permission not yet granted */}
                            {isFirebaseConfigured && pushPermission !== 'granted' && (
                              <div className="rounded-2xl bg-[rgba(245,197,66,0.08)] border border-[rgba(245,197,66,0.2)] p-3.5 flex items-center gap-3">
                                <div className="w-9 h-9 rounded-[10px] bg-[rgba(245,197,66,0.15)] flex items-center justify-center flex-shrink-0">
                                  <BellOff size={17} className="text-[#F5C542]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-[13px] font-semibold text-white">
                                    {pushPermission === 'denied'
                                      ? 'Notifications blocked by browser'
                                      : 'Push notifications off'}
                                  </p>
                                  <p className="text-[11.5px] text-[#BDBDBD] leading-snug">
                                    {pushPermission === 'denied'
                                      ? 'Enable them in your browser/OS settings, then reload.'
                                      : "You won't receive alerts when the app is closed."}
                                  </p>
                                </div>
                                {pushPermission !== 'denied' && (
                                  <button
                                    onClick={handleEnablePush}
                                    disabled={enablingPush}
                                    className="flex-shrink-0 px-3 py-1.5 rounded-xl text-[12.5px] font-bold text-white bg-[#F5C542] hover:bg-[#F5C542] transition-colors disabled:opacity-60"
                                  >
                                    {enablingPush ? '…' : 'Enable'}
                                  </button>
                                )}
                              </div>
                            )}
                            {([
                              { key: 'reactions',       label: 'Reactions',           desc: 'When someone reacts to your posts or comments' },
                              { key: 'comments',        label: 'Comments & replies',  desc: 'When someone comments or replies to you' },
                              { key: 'followers',       label: 'New followers',        desc: 'When someone starts following you' },
                              { key: 'messages',        label: 'Direct messages',      desc: 'New message notifications' },
                              { key: 'mentions',        label: 'Mentions & tags',      desc: 'When someone mentions you in a post' },
                              { key: 'storyReplies',    label: 'Story replies',        desc: 'Replies and reactions to your stories' },
                              { key: 'dailySpark',      label: 'Daily Spark',          desc: 'Today\'s prompt and community activity' },
                              { key: 'communityInvites', label: 'Community invites',   desc: 'Invitations to join circles' },
                            ] as { key: string; label: string; desc: string }[]).map(row => (
                              <div key={row.key} className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-[13.5px] font-semibold text-white">{row.label}</p>
                                  <p className="text-[12px] text-[rgba(255,255,255,0.45)]">{row.desc}</p>
                                </div>
                                <Toggle on={notifPrefs[row.key] ?? true} onChange={v => handleNotifToggle(row.key, v)} />
                              </div>
                            ))}
                          </div>
                        )}

                        {/* ── Privacy (legacy — replaced by /safety page) ── */}
                        {item.key === '_privacy_legacy' && (
                          <div className="pt-1 space-y-4">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-[13.5px] font-semibold text-white">Private account</p>
                                <p className="text-[12px] text-[rgba(255,255,255,0.45)]">Only approved followers see your posts</p>
                              </div>
                              <Toggle on={privateAccount} onChange={setPrivateAccount} />
                            </div>
                            <div>
                              <p className="text-[13.5px] font-semibold text-white mb-2">Who can message you</p>
                              {(['everyone', 'following'] as const).map(opt => (
                                <button
                                  key={opt}
                                  onClick={() => setMsgPrivacy(opt)}
                                  className={cn(
                                    'w-full flex items-center gap-2 px-3.5 py-2.5 rounded-xl border mb-1.5 transition-all text-left',
                                    msgPrivacy === opt ? 'border-[#F5C542] bg-[rgba(245,197,66,0.08)]' : 'border-[#1a1a1a] bg-[#111]'
                                  )}
                                >
                                  <div className={cn('w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0',
                                    msgPrivacy === opt ? 'border-[#F5C542]' : 'border-gray-300')}>
                                    {msgPrivacy === opt && <div className="w-2 h-2 rounded-full bg-[#F5C542]" />}
                                  </div>
                                  <span className="text-[13.5px] font-medium text-white capitalize">{opt === 'following' ? 'People I follow' : 'Everyone'}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* ── Report a Problem ── */}
                        {item.key === 'report' && (
                          <div className="pt-1 space-y-3">
                            <div>
                              <label className="text-[11.5px] font-bold text-[#BDBDBD] uppercase tracking-wide">Category</label>
                              <select
                                value={reportCategory}
                                onChange={e => setReportCategory(e.target.value)}
                                className="mt-1.5 w-full px-3.5 py-2.5 rounded-xl border border-[#2a2a2a] text-[14px] text-white outline-none focus:border-[#F5C542] bg-[#111] appearance-none"
                              >
                                <option value="bug">Bug or glitch</option>
                                <option value="content">Inappropriate content</option>
                                <option value="account">Account issue</option>
                                <option value="other">Other</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[11.5px] font-bold text-[#BDBDBD] uppercase tracking-wide">Description</label>
                              <textarea
                                value={reportText}
                                onChange={e => setReportText(e.target.value)}
                                rows={4}
                                placeholder="Describe what happened…"
                                className="mt-1.5 w-full px-3.5 py-2.5 rounded-xl border border-[#2a2a2a] text-[14px] text-white outline-none focus:border-[#F5C542] focus:ring-2 focus:ring-[rgba(245,197,66,0.15)] transition-all bg-[#111] resize-none"
                              />
                            </div>
                            <motion.button
                              whileTap={{ scale: 0.97 }}
                              onClick={handleSendReport}
                              disabled={sendingReport || !reportText.trim()}
                              className="w-full py-3 rounded-xl font-bold text-[14px] text-white flex items-center justify-center gap-2 disabled:opacity-50"
                              style={{ background: 'linear-gradient(135deg, #C9982A, #F5C542)' }}
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
                                <p className="text-[13.5px] text-[#BDBDBD] leading-relaxed">{rule}</p>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* ── Help Center ── */}
                        {item.key === 'help' && (
                          <div className="pt-1 space-y-1">
                            {FAQ.map((faq, i) => (
                              <div key={i} className="border border-[#1a1a1a] rounded-xl overflow-hidden">
                                <button
                                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                                  className="w-full flex items-center justify-between px-3.5 py-3 text-left bg-[#111] hover:bg-[#1a1a1a] transition-colors"
                                >
                                  <span className="text-[13.5px] font-semibold text-white pr-2">{faq.q}</span>
                                  <ChevronDown size={15} className={cn('text-[rgba(255,255,255,0.45)] flex-shrink-0 transition-transform', openFaq === i && 'rotate-180')} />
                                </button>
                                <AnimatePresence>
                                  {openFaq === i && (
                                    <motion.div
                                      initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                                      className="overflow-hidden"
                                    >
                                      <p className="px-3.5 py-3 text-[13px] text-[#BDBDBD] leading-relaxed border-t border-[#1a1a1a]">{faq.a}</p>
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

        <p className="text-center text-[12px] text-[rgba(255,255,255,0.45)] pt-2 pb-1 font-medium">
          Noelaven v1.0.0 · Made with 💜
        </p>
      </div>

      {/* ── Account Switcher sheet ──────────────────────────────────────────── */}
      <AnimatePresence>
        {switcherOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-[70]"
              onClick={() => setSwitcherOpen(false)}
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-[75] bg-[#111] rounded-t-[28px] shadow-2xl px-5 pb-8 pt-4"
            >
              <div className="flex justify-center mb-3">
                <div className="w-10 h-1 rounded-full bg-[#222]" />
              </div>
              <p className="font-black text-[17px] text-white mb-1">Switch account</p>
              <p className="text-[13px] text-[rgba(255,255,255,0.45)] mb-5">Tap an account to sign in. You'll be asked to re-enter your password.</p>

              <div className="space-y-2 mb-5">
                {localAccounts.map(account => {
                  const isActive = account.uid === currentUser?.id;
                  return (
                    <div key={account.uid} className="flex items-center gap-3 p-3 rounded-2xl bg-[#111] border border-[#1a1a1a]">
                      <GradientAvatar name={account.displayName} src={account.avatarUrl} size={44} />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-[14px] text-white truncate">{account.displayName}</p>
                        <p className="text-[12px] text-[rgba(255,255,255,0.45)] truncate">@{account.handle}</p>
                      </div>
                      {isActive ? (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-[#F5C542] bg-[rgba(245,197,66,0.08)] px-2.5 py-1 rounded-full">
                          <UserCheck size={12} /> Active
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={async () => {
                              setSwitcherOpen(false);
                              await switchToAccount(account);
                            }}
                            className="text-[12px] font-bold text-white bg-[#F5C542] px-3 py-1.5 rounded-full"
                          >
                            Switch
                          </motion.button>
                          <button
                            aria-label="Remove account"
                            onClick={() => {
                              removeSavedAccount(account.uid);
                              setLocalAccounts(getSavedAccounts());
                            }}
                            className="w-7 h-7 rounded-full bg-[#1a1a1a] flex items-center justify-center text-[rgba(255,255,255,0.45)] hover:bg-red-50 hover:text-red-500 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {localAccounts.length === 0 && (
                  <p className="text-center text-[13px] text-[rgba(255,255,255,0.45)] py-4">No other accounts saved yet.</p>
                )}
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => { setSwitcherOpen(false); startAddAccount(); }}
                className="w-full py-3.5 rounded-2xl mb-3 font-bold text-[15px] text-white flex items-center justify-center gap-2"
                style={{ background: 'linear-gradient(135deg, #C9982A, #F5C542)' }}
              >
                <UserPlus size={17} />
                Add another account
              </motion.button>
              <button
                onClick={() => setSwitcherOpen(false)}
                className="w-full py-3 rounded-2xl bg-[#1a1a1a] text-[#BDBDBD] font-semibold text-[15px]"
              >
                Cancel
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Manage Account sheet ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {manageOpen && currentUser && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-[70]"
              onClick={() => setManageOpen(false)}
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-[75] bg-[#111] rounded-t-[28px] shadow-2xl px-5 pb-8 pt-4"
            >
              <div className="flex justify-center mb-4">
                <div className="w-10 h-1 rounded-full bg-[#222]" />
              </div>
              <div className="flex items-center gap-3 mb-6">
                <GradientAvatar name={currentUser.displayName} src={currentUser.avatarUrl || undefined} size={52} />
                <div>
                  <p className="font-black text-[17px] text-white">{currentUser.displayName}</p>
                  <p className="text-[13px] text-[rgba(255,255,255,0.45)]">@{currentUser.handle}</p>
                </div>
              </div>

              <div className="space-y-2 mb-6">
                {[
                  { label: 'Email', value: (currentUser as { email?: string }).email ?? (isFirebaseConfigured ? '—' : 'demo@noelaven.app') },
                  { label: 'Account type', value: 'Free' },
                  { label: 'Member since', value: currentUser.joinedAt ? new Date(currentUser.joinedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : '—' },
                  { label: 'User ID', value: currentUser.id.slice(0, 12) + '…' },
                ].map(row => (
                  <div key={row.label} className="flex items-center justify-between px-4 py-3 rounded-xl bg-[#111]">
                    <span className="text-[13px] text-[#BDBDBD] font-medium">{row.label}</span>
                    <span className="text-[13px] text-white font-semibold">{row.value}</span>
                  </div>
                ))}
              </div>

              <div className="rounded-2xl bg-red-50 border border-red-100 px-4 py-3 mb-5">
                <p className="text-[13px] text-red-700 font-semibold mb-0.5">Delete account</p>
                <p className="text-[12px] text-red-500">Account deletion is permanent. Email <span className="font-bold">support@noelaven.app</span> from your registered address to request deletion.</p>
              </div>

              <button
                onClick={() => setManageOpen(false)}
                className="w-full py-3 rounded-2xl bg-[#1a1a1a] text-[#BDBDBD] font-semibold text-[15px]"
              >
                Close
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Sign-out confirmation sheet ─────────────────────────────────────── */}
      <AnimatePresence>
        {signOutConfirmOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/40 z-[70]"
              onClick={() => setSignOutConfirmOpen(false)}
            />
            <motion.div
              initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-[75] bg-[#111] rounded-t-[28px] shadow-2xl px-5 pb-8 pt-4"
            >
              <div className="flex justify-center mb-4">
                <div className="w-10 h-1 rounded-full bg-[#222]" />
              </div>
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                  <LogOut size={22} className="text-red-500" />
                </div>
                <div>
                  <p className="font-bold text-[17px] text-white">Sign out?</p>
                  <p className="text-[13px] text-[rgba(255,255,255,0.45)] mt-0.5">You'll be returned to the login screen.</p>
                </div>
              </div>
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={confirmSignOut}
                className="w-full py-3.5 rounded-2xl mb-3 font-bold text-[15px] text-white bg-red-500 active:bg-red-600 flex items-center justify-center gap-2"
              >
                <LogOut size={17} />
                Sign out
              </motion.button>
              <button
                onClick={() => setSignOutConfirmOpen(false)}
                className="w-full py-3 rounded-2xl bg-[#1a1a1a] text-[#BDBDBD] font-semibold text-[15px]"
              >
                Cancel
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
