import React, { useState } from 'react';
import {
  User, Bell, Lock, Shield, AlertTriangle, LogOut,
  ChevronRight, Paintbrush, FileText, HelpCircle, X, Check,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation, Link } from 'wouter';
import { GradientAvatar } from '@/components/ui/GradientAvatar';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, visible }: { message: string; visible: boolean }) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-gray-900 text-white text-[13.5px] font-semibold shadow-xl whitespace-nowrap flex items-center gap-2"
        >
          <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center flex-shrink-0">
            <Check size={11} strokeWidth={3} className="text-white" />
          </div>
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Settings() {
  const { signOut, currentUser } = useAuth();
  const [, setLocation] = useLocation();
  const [toast, setToast] = useState('');
  const [toastVisible, setToastVisible] = useState(false);

  function showToast(msg: string) {
    setToast(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2400);
  }

  function handleSignOut() {
    signOut();
    setLocation('/login');
  }

  const sections = [
    {
      title: 'Account',
      items: [
        {
          icon: User,
          label: 'Personal Information',
          desc: 'Email, phone number, and demographics',
          toast: 'Personal info editing coming soon',
        },
        {
          icon: Shield,
          label: 'Security',
          desc: 'Password, 2FA, and connected apps',
          toast: 'Security settings coming soon',
        },
      ],
    },
    {
      title: 'Preferences',
      items: [
        {
          icon: Paintbrush,
          label: 'Appearance',
          desc: 'Theme, colors, and layout',
          toast: 'Appearance settings coming soon',
        },
        {
          icon: Bell,
          label: 'Notifications',
          desc: 'Push, email, and in-app alerts',
          toast: 'Notification settings coming soon',
        },
        {
          icon: Lock,
          label: 'Privacy',
          desc: 'Who can see your posts and message you',
          toast: 'Privacy settings coming soon',
        },
      ],
    },
    {
      title: 'Support',
      items: [
        {
          icon: AlertTriangle,
          label: 'Report a Problem',
          desc: 'Help us fix issues',
          toast: 'Problem reporting coming soon',
        },
        {
          icon: FileText,
          label: 'Community Guidelines',
          desc: 'Rules and policies',
          toast: 'Opening community guidelines…',
        },
        {
          icon: HelpCircle,
          label: 'Help Center',
          desc: 'FAQs and support',
          toast: 'Help center coming soon',
        },
      ],
    },
  ];

  return (
    <div className="pb-32 min-h-screen bg-[#FDF9F6] px-4">
      <Toast message={toast} visible={toastVisible} />

      {/* Header */}
      <div className="pt-6 pb-2 mb-6">
        <h1 className="text-[26px] font-black text-gray-900 tracking-tight">Settings</h1>
      </div>

      {/* Profile card */}
      {currentUser && (
        <div className="bg-white rounded-[24px] border border-black/[0.05] shadow-sm p-5 mb-8 flex items-center gap-4">
          <GradientAvatar name={currentUser.displayName} size={64} />
          <div className="flex-1 min-w-0">
            <h2 className="font-black text-[17px] text-gray-900 truncate">{currentUser.displayName}</h2>
            <p className="text-[13.5px] text-gray-400 truncate">@{currentUser.handle}</p>
          </div>
          <Link href={`/profile/${currentUser.id}`}>
            <motion.button
              whileTap={{ scale: 0.93 }}
              className="px-4 py-2 rounded-full text-[13px] font-bold text-white flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)', boxShadow: '0 3px 12px rgba(107,115,255,0.30)' }}
            >
              Edit
            </motion.button>
          </Link>
        </div>
      )}

      {/* Sections */}
      <div className="space-y-7">
        {sections.map((section) => (
          <div key={section.title}>
            <p className="text-[11.5px] font-black text-gray-400 uppercase tracking-widest mb-2.5 px-1">
              {section.title}
            </p>
            <div className="bg-white rounded-[22px] border border-black/[0.05] shadow-sm overflow-hidden">
              {section.items.map((item, idx) => (
                <motion.button
                  key={item.label}
                  whileTap={{ scale: 0.99 }}
                  onClick={() => showToast(item.toast)}
                  className="w-full flex items-center gap-3.5 px-4 py-4 text-left hover:bg-gray-50 transition-colors border-b border-black/[0.04] last:border-0 group"
                >
                  <div className="w-10 h-10 rounded-[14px] flex items-center justify-center flex-shrink-0 bg-gray-100 group-hover:bg-purple-50 transition-colors">
                    <item.icon size={19} className="text-gray-500 group-hover:text-purple-500 transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[14.5px] text-gray-900">{item.label}</p>
                    <p className="text-[12px] text-gray-400 mt-0.5">{item.desc}</p>
                  </div>
                  <ChevronRight size={17} className="text-gray-300 group-hover:text-gray-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
                </motion.button>
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
