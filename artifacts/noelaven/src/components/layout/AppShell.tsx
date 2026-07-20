import React from 'react';
import { Link, useLocation } from 'wouter';
import {
  Home,
  Compass,
  Users,
  MessageCircle,
  User as UserIcon,
  Bell,
  Settings,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { GradientAvatar } from '@/components/ui/GradientAvatar';
import { NoelavenLogo } from '@/components/ui/NoelavenLogo';

// ─── Floating Bottom Nav ──────────────────────────────────────────────────────

export function BottomNav() {
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

export function Sidebar() {
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
          <GradientAvatar name={currentUser.displayName} size={38} />
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

function MobileHeader() {
  const { isDemoMode } = useAuth();
  return (
    <header className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 flex items-center justify-between px-5 bg-[#FDF9F6]/90 backdrop-blur-xl border-b border-black/[0.05]">
      <NoelavenLogo variant="full" size="sm" />
      {isDemoMode && (
        <span className="text-[9px] uppercase font-black tracking-wider bg-purple-50 text-purple-500 px-2 py-1 rounded-full">
          Demo
        </span>
      )}
    </header>
  );
}

// ─── Shell ────────────────────────────────────────────────────────────────────

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDF9F6]">
        <div
          className="w-12 h-12 rounded-2xl animate-pulse"
          style={{ background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)' }}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <Sidebar />
      <MobileHeader />

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

      <BottomNav />
    </div>
  );
}
