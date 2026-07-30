import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useCall } from '@/contexts/CallContext';
import { CallScreen, IncomingCallBanner } from '@/components/calls/CallScreen';
import { FloatingCallWindow } from '@/components/calls/FloatingCallWindow';
import { useFCMToken } from '@/hooks/useFCMToken';
import { NotificationPermissionPrompt } from '@/components/ui/NotificationPermissionPrompt';
import {
  Home,
  Compass,
  Users,
  MessageCircle,
  User as UserIcon,
  Bell,
  Settings,
  Sparkles,
  X,
  Search,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDailySparkStatus } from '@/contexts/DailySparkContext';
import { usePresence } from '@/hooks/usePresence';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { GradientAvatar } from '@/components/ui/GradientAvatar';
import { NoelavenLogo } from '@/components/ui/NoelavenLogo';
import { useConversations } from '@/hooks/useConversations';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { isFirebaseConfigured } from '@/lib/firebase';
import { subscribeUnreadNotificationCount } from '@/lib/firestore';
import { demoGetUserNotifs } from '@/lib/notifications';

// ─── Already-Answered Sheet ───────────────────────────────────────────────────

function AlreadyAnsweredSheet({ prompt, onClose }: { prompt: string; onClose: () => void }) {
  const [, setLocation] = useLocation();
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[59] bg-black/70"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: '100%' }}
        animate={{ y: 0 }}
        exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-[60] rounded-t-[28px] shadow-2xl"
        style={{ background: '#111111', border: '1px solid #222' }}
      >
        <div className="flex flex-col items-center px-6 py-8 text-center">
          <div className="w-10 h-1 rounded-full mb-5" style={{ background: '#333' }} />
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
            style={{ background: 'linear-gradient(135deg, #EC4899, #7C3AED, #2563EB)', boxShadow: '0 0 24px rgba(124,58,237,0.4)' }}
          >
            <Sparkles size={26} style={{ color: '#fff' }} />
          </div>
          <h2 className="font-black text-[20px] text-white mb-2">
            Already Sparked Today! ✨
          </h2>
          {prompt && (
            <p className="text-[13px] font-semibold mb-3 leading-relaxed max-w-xs italic" style={{ color: '#BDBDBD' }}>
              "{prompt}"
            </p>
          )}
          <p className="text-[13.5px] mb-7 leading-relaxed" style={{ color: '#BDBDBD' }}>
            You've shared your Daily Spark.<br />Come back tomorrow for a fresh prompt!
          </p>
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={() => { setLocation('/'); onClose(); }}
            className="w-full py-3.5 rounded-2xl text-white font-bold text-[15px] mb-3"
            style={{ background: 'linear-gradient(135deg, #EC4899, #7C3AED, #2563EB)', boxShadow: '0 4px 20px rgba(124,58,237,0.45)' }}
          >
            View Community Sparks
          </motion.button>
          <button
            onClick={onClose}
            className="text-[14px] font-semibold py-2"
            style={{ color: '#BDBDBD' }}
          >
            Come back tomorrow
          </button>
        </div>
      </motion.div>
    </>
  );
}

// ─── Floating Bottom Nav ──────────────────────────────────────────────────────

export function BottomNav({ totalUnread = 0, notifUnreadCount = 0 }: { totalUnread?: number; notifUnreadCount?: number }) {
  const [location, setLocation] = useLocation();
  const { hasAnsweredToday, prompt: sparkPrompt } = useDailySparkStatus();
  const [showAnsweredSheet, setShowAnsweredSheet] = useState(false);

  const { currentUser } = useAuth();

  const navItems = [
    { icon: Home,          path: '/',               label: 'Home'   },
    { icon: Compass,       path: '/discover',        label: 'Discover' },
    { icon: Sparkles,      path: '/?spark=1',        label: 'Spark', special: true },
    { icon: MessageCircle, path: '/messages',        label: 'Chats'  },
    { icon: UserIcon,      path: currentUser ? `/profile/${currentUser.id}` : '/login', label: 'Profile' },
  ];

  return (
    <>
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
      style={{ background: '#000', borderTop: '1px solid #1a1a1a' }}>
      <div className="flex justify-around items-center h-[60px] px-1">
        {navItems.map((item) => {
          const isActive = location === item.path || (item.path === '/' && location === '/');

          if (item.special) {
            return (
              <motion.button
                key={item.path}
                whileTap={{ scale: 0.88 }}
                onClick={() =>
                  hasAnsweredToday
                    ? setShowAnsweredSheet(true)
                    : setLocation('/?spark=1')
                }
                className="flex flex-col items-center justify-center w-14 h-full gap-0.5 cursor-pointer"
              >
                <item.icon
                  size={22}
                  strokeWidth={2}
                  style={{ color: isActive ? '#EC4899' : 'rgba(255,255,255,0.5)' }}
                  className="transition-colors duration-200"
                />
                <span
                  className="text-[10px] font-semibold transition-colors duration-200"
                  style={{ color: isActive ? '#EC4899' : 'rgba(255,255,255,0.4)' }}
                >
                  {item.label}
                </span>
              </motion.button>
            );
          }

          return (
            <Link key={item.path} href={item.path}>
              <div className="flex flex-col items-center justify-center w-14 h-[60px] gap-0.5 cursor-pointer relative">
                <item.icon
                  size={22}
                  strokeWidth={isActive ? 2.5 : 2}
                  style={{ color: isActive ? '#EC4899' : 'rgba(255,255,255,0.5)' }}
                  className="transition-colors duration-200"
                />
                {/* Unread message badge */}
                {item.path === '/messages' && totalUnread > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 rounded-full flex items-center justify-center text-[8px] font-black text-white px-1"
                    style={{ background: '#EC4899' }}>
                    {totalUnread > 9 ? '9+' : totalUnread}
                  </span>
                )}
                {/* Unread notification badge */}
                {item.path === '/notifications' && notifUnreadCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 rounded-full flex items-center justify-center text-[8px] font-black text-white px-1"
                    style={{ background: '#EC4899' }}>
                    {notifUnreadCount > 9 ? '9+' : notifUnreadCount}
                  </span>
                )}
                <span
                  className="text-[10px] font-semibold transition-colors duration-200"
                  style={{ color: isActive ? '#EC4899' : 'rgba(255,255,255,0.4)' }}
                >
                  {item.label}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
      {/* Safe-area spacer — fills the iPhone home-indicator zone */}
      <div style={{ height: 'env(safe-area-inset-bottom)' }} />
    </nav>
    <AnimatePresence>
      {showAnsweredSheet && (
        <AlreadyAnsweredSheet
          prompt={sparkPrompt}
          onClose={() => setShowAnsweredSheet(false)}
        />
      )}
    </AnimatePresence>
    </>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar({ totalUnread = 0, notifUnreadCount = 0 }: { totalUnread?: number; notifUnreadCount?: number }) {
  const [location, setLocation] = useLocation();
  const { currentUser, isDemoMode } = useAuth();
  const { hasAnsweredToday, prompt: sparkPrompt } = useDailySparkStatus();
  const [showAnsweredSheet, setShowAnsweredSheet] = useState(false);

  const navItems = [
    { icon: Home,          path: '/',                                              label: 'Home'          },
    { icon: Compass,       path: '/discover',                                      label: 'Discover'      },
    { icon: Users,         path: '/communities',                                   label: 'Communities'   },
    { icon: MessageCircle, path: '/messages',                                      label: 'Messages'      },
    { icon: Bell,          path: '/notifications',                                 label: 'Notifications' },
    { icon: UserIcon,      path: currentUser ? `/profile/${currentUser.id}` : '/login', label: 'Profile' },
    { icon: Settings,      path: '/settings',                                      label: 'Settings'      },
  ];

  return (
    <>
    <aside
      className="hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 pt-8 pb-6 px-4 z-40"
      style={{ background: '#000', borderRight: '1px solid #1a1a1a' }}
    >
      <div className="flex items-center px-3 mb-10">
        <Link href="/" aria-label="Go to Noelaven Home" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center">
          <NoelavenLogo variant="full" size="md" />
        </Link>
        {isDemoMode && (
          <span className="ml-auto text-[9px] uppercase font-black tracking-wider px-2 py-1 rounded-full"
            style={{ background: '#1a1a00', color: '#F5C542' }}>
            Demo
          </span>
        )}
      </div>

      <nav className="flex flex-col gap-1.5 flex-1">
        {navItems.map((item) => {
          const isActive = location === item.path || (item.path !== '/' && location.startsWith(item.path));
          return (
            <Link
              key={item.path}
              href={item.path}
              className={cn(
                'flex items-center gap-3.5 px-4 py-3 rounded-2xl transition-all duration-200 group relative',
              )}
              style={{
                background: isActive ? 'rgba(124,58,237,0.12)' : 'transparent',
                color: isActive ? '#fff' : 'rgba(255,255,255,0.6)',
              }}
            >
              <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} className="transition-transform duration-200 group-hover:scale-110" />
              <span className="text-[15px] font-semibold">{item.label}</span>
              {item.path === '/messages' && totalUnread > 0 && (
                <span className="ml-auto min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-black text-white px-1"
                  style={{ background: 'linear-gradient(135deg, #EC4899, #7C3AED)' }}>
                  {totalUnread > 9 ? '9+' : totalUnread}
                </span>
              )}
              {item.path === '/notifications' && notifUnreadCount > 0 && (
                <span className="ml-auto min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[9px] font-black text-white px-1"
                  style={{ background: 'linear-gradient(135deg, #EC4899, #7C3AED)' }}>
                  {notifUnreadCount > 9 ? '9+' : notifUnreadCount}
                </span>
              )}
              {isActive && (
                <motion.div
                  layoutId="sidebarIndicator"
                  className="absolute left-0 w-1 h-7 rounded-r-full"
                  style={{ background: 'linear-gradient(180deg, #EC4899, #7C3AED, #2563EB)' }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={() => hasAnsweredToday ? setShowAnsweredSheet(true) : setLocation('/?spark=1')}
        className="mt-auto w-full font-bold py-3.5 rounded-2xl transition-opacity hover:opacity-90 active:scale-95 duration-200 flex items-center justify-center gap-2 text-white"
        style={{ background: 'linear-gradient(135deg, #EC4899, #7C3AED, #2563EB)', boxShadow: '0 4px 20px rgba(124,58,237,0.45)' }}
      >
        <Sparkles size={18} />
        <span>{hasAnsweredToday ? 'Sparked Today ✨' : 'New Spark'}</span>
      </button>

      {currentUser && (
        <Link href={`/profile/${currentUser.id}`}
          className="mt-5 flex items-center gap-3 px-2 py-2 rounded-2xl transition-colors"
          style={{ background: 'transparent' }}
          onMouseEnter={e => (e.currentTarget.style.background = '#111')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <GradientAvatar name={currentUser.displayName} src={currentUser.avatarUrl || undefined} size={38} />
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-sm font-bold text-white truncate">{currentUser.displayName}</span>
            <span className="text-xs truncate" style={{ color: '#BDBDBD' }}>@{currentUser.handle}</span>
          </div>
        </Link>
      )}
    </aside>
    <AnimatePresence>
      {showAnsweredSheet && (
        <AlreadyAnsweredSheet prompt={sparkPrompt} onClose={() => setShowAnsweredSheet(false)} />
      )}
    </AnimatePresence>
    </>
  );
}

// ─── Mobile top header ────────────────────────────────────────────────────────

function MobileHeader({ notifUnreadCount = 0 }: { notifUnreadCount?: number }) {
  const { isDemoMode } = useAuth();
  return (
    <header
      className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 flex items-center justify-between px-5"
      style={{ background: '#000', borderBottom: '1px solid #1a1a1a' }}
    >
      {/* Left: logo + wordmark */}
      <Link href="/" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className="flex items-center gap-2.5">
        <img src="/noelaven-logo.png" alt="Noelaven" className="w-8 h-8 rounded-[10px] object-cover" />
        <span className="text-[20px] font-black text-white tracking-tight">Noelaven</span>
        {isDemoMode && (
          <span className="text-[9px] uppercase font-black tracking-wider px-2 py-0.5 rounded-full"
            style={{ background: '#1a1a00', color: '#F5C542' }}>Demo</span>
        )}
      </Link>
      {/* Right: search + bell */}
      <div className="flex items-center gap-4">
        <Link href="/discover">
          <Search size={22} style={{ color: 'rgba(255,255,255,0.8)' }} />
        </Link>
        <Link href="/notifications" className="relative">
          <Bell size={22} style={{ color: 'rgba(255,255,255,0.8)' }} />
          {notifUnreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[16px] h-4 rounded-full flex items-center justify-center text-[8px] font-black text-white px-1"
              style={{ background: '#EC4899' }}>
              {notifUnreadCount > 9 ? '9+' : notifUnreadCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}

// ─── In-app new-message toast ─────────────────────────────────────────────────

interface MsgToast {
  convId: string;
  senderName: string;
  preview: string;
  senderId: string;
}

function InAppMsgToast({ toast, onClose }: { toast: MsgToast; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, y: -60, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -60, scale: 0.92 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[999] w-[calc(100vw-32px)] max-w-sm"
    >
      <Link href={`/messages/${toast.convId}`} onClick={onClose}>
        <div
          className="flex items-center gap-3 rounded-[22px] px-4 py-3 cursor-pointer transition-colors"
          style={{ background: '#111', border: '1px solid #222', boxShadow: '0 8px 32px rgba(0,0,0,0.6)' }}
        >
          <UserAvatar userId={toast.senderId} fallbackName={toast.senderName} size={42} />
          <div className="flex-1 min-w-0">
            <p className="font-black text-[13.5px] text-white truncate">{toast.senderName}</p>
            <p className="text-[12.5px] truncate" style={{ color: '#BDBDBD' }}>{toast.preview}</p>
          </div>
          <button
            onClick={e => { e.preventDefault(); onClose(); }}
            className="p-1 rounded-full flex-shrink-0"
            style={{ background: '#222' }}
          >
            <X size={14} style={{ color: '#BDBDBD' }} />
          </button>
        </div>
      </Link>
    </motion.div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isLoading, currentUser } = useAuth();
  usePresence(currentUser?.id);
  const { conversations } = useConversations();
  const {
    call, endCall, toggleMute, toggleCamera, toggleSpeaker,
    toggleMinimize, toggleSwapped, switchCamera,
    toggleHold, sendDtmf,
    incomingCall, answerIncoming, declineIncoming,
  } = useCall();
  const [location, setLocation] = useLocation();
  const totalUnread = conversations.reduce((n, c) => n + c.unreadCount, 0);

  const [notifUnreadCount, setNotifUnreadCount] = useState(0);
  useEffect(() => {
    if (!currentUser) { setNotifUnreadCount(0); return; }
    if (isFirebaseConfigured) {
      return subscribeUnreadNotificationCount(currentUser.id, setNotifUnreadCount);
    }
    const demoUnread = demoGetUserNotifs(currentUser.id).filter((n: { read: boolean }) => !n.read).length;
    setNotifUnreadCount(demoUnread);
    return undefined;
  }, [currentUser?.id]);

  useFCMToken({ onForegroundMessage: () => {} });

  const [msgToast, setMsgToast] = useState<MsgToast | null>(null);
  const prevConvsRef = useRef<typeof conversations>([]);

  useEffect(() => {
    if (!currentUser) return;
    const prev = prevConvsRef.current;
    for (const conv of conversations) {
      const prevConv = prev.find(c => c.id === conv.id);
      if (
        conv.unreadCount > 0 &&
        (!prevConv || conv.unreadCount > prevConv.unreadCount) &&
        !location.includes(conv.id)
      ) {
        const other = conv.participants.find(p => p.id !== currentUser.id) ?? conv.participants[0];
        const senderName = conv.lastSenderId
          ? (conv.participants.find(p => p.id === conv.lastSenderId)?.displayName ?? other.displayName)
          : other.displayName;
        setMsgToast({ convId: conv.id, senderName, preview: conv.lastMessage || '…', senderId: conv.lastSenderId ?? other.id });
        break;
      }
    }
    prevConvsRef.current = conversations;
  }, [conversations, location, currentUser]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6" style={{ background: '#000' }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="flex flex-col items-center gap-5"
        >
          {/* Official brand loading screen logo */}
          <img
            src="/noelaven-logo.png"
            alt="Noelaven"
            style={{ width: 120, height: 120, objectFit: 'contain' }}
          />
          <div className="flex flex-col items-center gap-1">
            <span className="text-[28px] font-black text-white tracking-tight">Noelaven</span>
            <p className="text-[11px] font-semibold tracking-[0.2em] uppercase" style={{ color: 'rgba(255,255,255,0.45)' }}>
              Connect. Create. Belong.
            </p>
          </div>
        </motion.div>
        {/* Rainbow spinner */}
        <div className="rainbow-spinner" />
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white flex" style={{ background: '#000' }}>
      <Sidebar totalUnread={totalUnread} notifUnreadCount={notifUnreadCount} />
      <MobileHeader notifUnreadCount={notifUnreadCount} />

      <main className="flex-1 md:ml-64 w-full relative pb-20 md:pb-0 pt-14 md:pt-0">
        <AnimatePresence mode="wait">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-2xl mx-auto min-h-screen"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </main>

      <BottomNav totalUnread={totalUnread} notifUnreadCount={notifUnreadCount} />

      <AnimatePresence>
        {msgToast && (
          <InAppMsgToast key={`toast-${msgToast.convId}`} toast={msgToast} onClose={() => setMsgToast(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {incomingCall && !call.callId && (
          <IncomingCallBanner
            key="incoming"
            callerName={incomingCall.callerName}
            callerAvatar={incomingCall.callerAvatar}
            callerId={incomingCall.callerId}
            type={incomingCall.type}
            onAccept={answerIncoming}
            onDecline={declineIncoming}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {(call.callId || call.isRinging) && !call.isMinimized && (
          <CallScreen
            key="call-screen"
            call={call}
            onEnd={endCall}
            onToggleMute={toggleMute}
            onToggleCamera={toggleCamera}
            onToggleSpeaker={toggleSpeaker}
            onMinimize={toggleMinimize}
            onSwitchCamera={switchCamera}
            onToggleSwap={toggleSwapped}
            onToggleHold={toggleHold}
            onSendDtmf={sendDtmf}
            onOpenChat={call.conversationId ? () => {
              toggleMinimize();
              setLocation(`/messages/${call.conversationId}`);
            } : undefined}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {call.isMinimized && (call.callId || call.isRinging) && (
          <FloatingCallWindow
            key="floating-call"
            call={call}
            onEnd={endCall}
            onToggleMute={toggleMute}
            onRestore={toggleMinimize}
          />
        )}
      </AnimatePresence>

      <NotificationPermissionPrompt />
    </div>
  );
}
