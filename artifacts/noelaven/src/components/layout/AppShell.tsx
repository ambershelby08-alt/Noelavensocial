import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useCall } from '@/contexts/CallContext';
import { CallScreen, IncomingCallBanner } from '@/components/calls/CallScreen';
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
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { GradientAvatar } from '@/components/ui/GradientAvatar';
import { NoelavenLogo } from '@/components/ui/NoelavenLogo';
import { useConversations } from '@/hooks/useConversations';
import { UserAvatar } from '@/components/ui/UserAvatar';
import { isFirebaseConfigured } from '@/lib/firebase';
import { subscribeUnreadNotificationCount } from '@/lib/firestore';
import { demoGetUserNotifs } from '@/lib/notifications';
import { mockNotifications } from '@/lib/mockData';

// ─── Floating Bottom Nav ──────────────────────────────────────────────────────

export function BottomNav({ totalUnread = 0, notifUnreadCount = 0 }: { totalUnread?: number; notifUnreadCount?: number }) {
  const [location] = useLocation();

  const navItems = [
    { icon: Home,          path: '/',            label: 'Home'     },
    { icon: Compass,       path: '/discover',    label: 'Discover' },
    { icon: Sparkles,      path: '/?spark=1',    label: 'Spark',   special: true },
    { icon: Users,         path: '/communities', label: 'Circles'  },
    { icon: MessageCircle, path: '/messages',    label: 'Chats'    },
  ];

  return (
    <nav className="fixed bottom-4 left-3 right-3 z-50 md:hidden">
      <div
        className="flex justify-around items-center h-[64px] px-2 bg-white/95 backdrop-blur-2xl rounded-[32px] border border-white"
        style={{ boxShadow: '0 8px 40px rgba(0,0,0,0.13), 0 2px 8px rgba(0,0,0,0.06)' }}
      >
        {navItems.map((item) => {
          const isActive = location === item.path;

          if (item.special) {
            return (
              <Link key={item.path} href={item.path}>
                <motion.div
                  whileTap={{ scale: 0.88 }}
                  className="flex flex-col items-center justify-center w-12 h-12 rounded-[18px] text-white shadow-md cursor-pointer"
                  style={{
                    background: 'linear-gradient(135deg, #6B73FF, #9B59B6, #FF6B9D)',
                    boxShadow: '0 4px 18px rgba(107,115,255,0.45)',
                  }}
                >
                  <item.icon size={20} strokeWidth={2.5} />
                  <span className="text-[8px] font-black uppercase tracking-wide mt-0.5 opacity-90">{item.label}</span>
                </motion.div>
              </Link>
            );
          }

          return (
            <Link key={item.path} href={item.path}>
              <div className="flex flex-col items-center justify-center w-14 h-12 gap-0.5 cursor-pointer relative">
                <item.icon
                  size={22}
                  strokeWidth={isActive ? 2.5 : 2}
                  className={cn(
                    'transition-colors duration-200',
                    isActive ? 'text-purple-500' : 'text-gray-400'
                  )}
                />
                {/* Unread message badge */}
                {item.path === '/messages' && totalUnread > 0 && (
                  <span className="absolute top-0.5 right-1 min-w-[16px] h-4 rounded-full bg-pink-500 ring-[1.5px] ring-white flex items-center justify-center text-[8px] font-black text-white px-1">
                    {totalUnread > 9 ? '9+' : totalUnread}
                  </span>
                )}
                <span
                  className={cn(
                    'text-[10px] font-semibold transition-colors duration-200',
                    isActive ? 'text-purple-500' : 'text-gray-400'
                  )}
                >
                  {item.label}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="navActiveBar"
                    className="absolute -bottom-2 w-5 h-[3px] rounded-full"
                    style={{ background: 'linear-gradient(90deg, #6B73FF, #FF6B9D)' }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

export function Sidebar({ totalUnread = 0, notifUnreadCount = 0 }: { totalUnread?: number; notifUnreadCount?: number }) {
  const [location, setLocation] = useLocation();
  const { currentUser, isDemoMode } = useAuth();

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
    <aside className="hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 border-r border-black/[0.06] bg-white/80 backdrop-blur-xl pt-8 pb-6 px-4 z-40">
      <div className="flex items-center px-3 mb-10">
        <NoelavenLogo variant="full" size="md" />
        {isDemoMode && (
          <span className="ml-auto text-[9px] uppercase font-black tracking-wider bg-purple-50 text-purple-500 px-2 py-1 rounded-full">
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
                isActive
                  ? 'bg-purple-50 text-purple-600 font-semibold'
                  : 'hover:bg-gray-50 text-gray-500 hover:text-gray-800'
              )}
            >
              <item.icon
                size={20}
                strokeWidth={isActive ? 2.5 : 2}
                className="transition-transform duration-200 group-hover:scale-110"
              />
              <span className="text-[15px]">{item.label}</span>
              {/* Unread message badge */}
              {item.path === '/messages' && totalUnread > 0 && (
                <span className="ml-auto min-w-[18px] h-[18px] rounded-full bg-pink-500 flex items-center justify-center text-[9px] font-black text-white px-1">
                  {totalUnread > 9 ? '9+' : totalUnread}
                </span>
              )}
              {/* Unread notification badge */}
              {item.path === '/notifications' && notifUnreadCount > 0 && (
                <span className="ml-auto min-w-[18px] h-[18px] rounded-full bg-purple-500 flex items-center justify-center text-[9px] font-black text-white px-1">
                  {notifUnreadCount > 9 ? '9+' : notifUnreadCount}
                </span>
              )}
              {isActive && (
                <motion.div
                  layoutId="sidebarIndicator"
                  className="absolute left-0 w-1 h-7 rounded-r-full"
                  style={{ background: 'linear-gradient(180deg, #6B73FF, #FF6B9D)' }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={() => setLocation('/?spark=1')}
        className="mt-auto w-full text-white font-bold py-3.5 rounded-2xl shadow-lg hover:opacity-90 transition-opacity active:scale-95 duration-200 flex items-center justify-center gap-2"
        style={{
          background: 'linear-gradient(135deg, #6B73FF, #9B59B6, #FF6B9D)',
          boxShadow: '0 4px 18px rgba(107,115,255,0.35)',
        }}
      >
        <Sparkles size={18} />
        <span>New Spark</span>
      </button>

      {currentUser && (
        <Link href={`/profile/${currentUser.id}`} className="mt-5 flex items-center gap-3 px-2 py-2 rounded-2xl hover:bg-gray-50 transition-colors">
          <GradientAvatar name={currentUser.displayName} src={currentUser.avatarUrl || undefined} size={38} />
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-sm font-bold text-gray-900 truncate">{currentUser.displayName}</span>
            <span className="text-xs text-gray-400 truncate">@{currentUser.handle}</span>
          </div>
        </Link>
      )}
    </aside>
  );
}

// ─── Mobile top header ────────────────────────────────────────────────────────

function MobileHeader({ notifUnreadCount = 0 }: { notifUnreadCount?: number }) {
  const { isDemoMode } = useAuth();
  return (
    <header className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 flex items-center justify-between px-5 bg-[#FDF9F6]/90 backdrop-blur-xl border-b border-black/[0.05]">
      <NoelavenLogo variant="full" size="sm" />
      <div className="flex items-center gap-3">
        {isDemoMode && (
          <span className="text-[9px] uppercase font-black tracking-wider bg-purple-50 text-purple-500 px-2 py-1 rounded-full">
            Demo
          </span>
        )}
        <Link href="/notifications" className="relative p-1.5">
          <Bell size={20} className="text-gray-500" />
          {notifUnreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 rounded-full bg-purple-500 ring-[1.5px] ring-[#FDF9F6] flex items-center justify-center text-[8px] font-black text-white px-1">
              {notifUnreadCount > 9 ? '9+' : notifUnreadCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}

// ─── Shell ────────────────────────────────────────────────────────────────────

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
        <div className="flex items-center gap-3 bg-white rounded-[22px] shadow-2xl border border-black/[0.06] px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors">
          <UserAvatar userId={toast.senderId} fallbackName={toast.senderName} size={42} />
          <div className="flex-1 min-w-0">
            <p className="font-black text-[13.5px] text-gray-900 truncate">{toast.senderName}</p>
            <p className="text-[12.5px] text-gray-500 truncate">{toast.preview}</p>
          </div>
          <button
            onClick={e => { e.preventDefault(); onClose(); }}
            className="p-1 rounded-full hover:bg-gray-100 transition-colors flex-shrink-0"
          >
            <X size={14} className="text-gray-400" />
          </button>
        </div>
      </Link>
    </motion.div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isLoading, currentUser } = useAuth();
  const { conversations } = useConversations();
  const { call, endCall, toggleMute, toggleCamera, toggleSpeaker, incomingCall, answerIncoming, declineIncoming } = useCall();
  const [location] = useLocation();
  const totalUnread = conversations.reduce((n, c) => n + c.unreadCount, 0);

  // Notification badge count
  const [notifUnreadCount, setNotifUnreadCount] = useState(0);
  useEffect(() => {
    if (!currentUser) { setNotifUnreadCount(0); return; }
    if (isFirebaseConfigured) {
      return subscribeUnreadNotificationCount(currentUser.id, setNotifUnreadCount);
    }
    // Demo mode: count from demo + mock data
    const demoUnread = demoGetUserNotifs(currentUser.id).filter((n: { read: boolean }) => !n.read).length;
    const mockUnread = mockNotifications.filter(n => !n.read).length;
    setNotifUnreadCount(demoUnread + mockUnread);
    return undefined;
  }, [currentUser?.id]);
  const [msgToast, setMsgToast] = useState<MsgToast | null>(null);
  const prevConvsRef = useRef<typeof conversations>([]);

  // Detect new messages in background conversations (not the one currently open)
  useEffect(() => {
    if (!currentUser) return;
    const prev = prevConvsRef.current;
    for (const conv of conversations) {
      const prevConv = prev.find(c => c.id === conv.id);
      // New unread appeared AND user is not currently viewing this conversation
      if (
        conv.unreadCount > 0 &&
        (!prevConv || conv.unreadCount > prevConv.unreadCount) &&
        !location.includes(conv.id)
      ) {
        const other = conv.participants.find(p => p.id !== currentUser.id) ?? conv.participants[0];
        const senderName = conv.lastSenderId
          ? (conv.participants.find(p => p.id === conv.lastSenderId)?.displayName ?? other.displayName)
          : other.displayName;
        setMsgToast({
          convId: conv.id,
          senderName,
          preview: conv.lastMessage || '…',
          senderId: conv.lastSenderId ?? other.id,
        });
        break; // Show only one toast at a time
      }
    }
    prevConvsRef.current = conversations;
  }, [conversations, location, currentUser]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5 bg-[#FDF9F6]">
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="flex flex-col items-center gap-4"
        >
          <NoelavenLogo variant="mark" size="xl" />
          <NoelavenLogo variant="full" size="md" />
          <p className="text-[11.5px] font-bold tracking-[0.18em] uppercase" style={{ color: '#7C3AED' }}>
            Connect. Create. Belong.
          </p>
        </motion.div>
        <div className="w-6 h-6 rounded-full border-2 border-purple-200 border-t-[#7C3AED] animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <Sidebar totalUnread={totalUnread} notifUnreadCount={notifUnreadCount} />
      <MobileHeader notifUnreadCount={notifUnreadCount} />

      {/* pt-14 clears the mobile header on small screens; md:pt-0 removes it on desktop (sidebar handles branding) */}
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

      {/* In-app new message toast */}
      <AnimatePresence>
        {msgToast && (
          <InAppMsgToast
            key={`toast-${msgToast.convId}`}
            toast={msgToast}
            onClose={() => setMsgToast(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Incoming call banner ─────────────────────────────────────────── */}
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

      {/* ── Active / ringing call overlay ────────────────────────────────── */}
      <AnimatePresence>
        {(call.callId || call.isRinging) && (
          <CallScreen
            key="call-screen"
            call={call}
            onEnd={endCall}
            onToggleMute={toggleMute}
            onToggleCamera={toggleCamera}
            onToggleSpeaker={toggleSpeaker}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
