/**
 * NotificationPermissionPrompt
 *
 * Slide-up card that explains the value of push notifications and asks the
 * user for permission. Only shown once per device (pref stored in localStorage).
 * Never shown if the user already granted/denied, or if FCM is not configured.
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, X, MessageCircle, Heart, UserPlus } from 'lucide-react';
import { isFirebaseConfigured } from '@/lib/firebase';
import { registerFCMToken } from '@/lib/fcmToken';
import { useAuth } from '@/contexts/AuthContext';

const DISMISSED_KEY = 'nlv_notif_prompt_dismissed';

// Wait a bit after the user is logged in before showing the prompt
const SHOW_DELAY_MS = 6000;

export function NotificationPermissionPrompt() {
  const { currentUser } = useAuth();
  const [visible, setVisible]     = useState(false);
  const [loading, setLoading]     = useState(false);

  useEffect(() => {
    if (!currentUser || !isFirebaseConfigured) return;
    // Never show if already answered
    if (Notification.permission !== 'default') return;
    // Never show if user already dismissed this prompt
    if (localStorage.getItem(DISMISSED_KEY)) return;

    const timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [currentUser?.id]);

  if (!visible) return null;

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1');
    setVisible(false);
  }

  async function enable() {
    if (!currentUser) return;
    setLoading(true);
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        await registerFCMToken(currentUser.id);
      }
    } catch (err) {
      console.error('[FCM] Permission request failed:', err);
    } finally {
      setLoading(false);
      dismiss();
    }
  }

  return (
    <AnimatePresence>
      {visible && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/20 backdrop-blur-[2px] z-[200]"
            onClick={dismiss}
          />

          {/* Sheet */}
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-[205] bg-black rounded-t-[28px] shadow-2xl px-6 pb-10 pt-5"
            style={{ paddingBottom: 'max(40px, env(safe-area-inset-bottom, 40px))' }}
          >
            {/* Handle */}
            <div className="flex justify-center mb-5">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>

            {/* Dismiss button */}
            <button
              onClick={dismiss}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-[#1a1a1a] flex items-center justify-center text-[#BDBDBD] hover:bg-[#222] transition-colors"
            >
              <X size={15} />
            </button>

            {/* Icon */}
            <div
              className="w-16 h-16 rounded-[22px] flex items-center justify-center mb-4 mx-auto"
              style={{ background: 'linear-gradient(135deg, #EC4899, #7C3AED, #2563EB)' }}
            >
              <Bell size={28} className="text-white" />
            </div>

            {/* Heading */}
            <h2 className="text-[20px] font-black text-white text-center mb-1">
              Stay in the loop
            </h2>
            <p className="text-[14px] text-[#BDBDBD] text-center mb-6 leading-relaxed">
              Get notified when something happens that matters to you — no spam, just the good stuff.
            </p>

            {/* Benefits */}
            <div className="space-y-3 mb-7">
              {[
                { icon: MessageCircle, color: '#EC4899', label: 'New messages and replies' },
                { icon: Heart,         color: '#7C3AED', label: 'Reactions to your posts' },
                { icon: UserPlus,      color: '#2563EB', label: 'New followers and mentions' },
              ].map(({ icon: Icon, color, label }) => (
                <div key={label} className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-[12px] flex items-center justify-center flex-shrink-0"
                    style={{ background: `${color}18` }}
                  >
                    <Icon size={18} style={{ color }} />
                  </div>
                  <span className="text-[14px] text-[#BDBDBD] font-medium">{label}</span>
                </div>
              ))}
            </div>

            {/* Actions */}
            <button
              onClick={enable}
              disabled={loading}
              className="w-full py-4 rounded-2xl font-black text-[15px] text-white mb-3 flex items-center justify-center gap-2 transition-opacity disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #EC4899, #7C3AED, #2563EB)', boxShadow: '0 4px 20px rgba(124,58,237,0.45)' }}
            >
              {loading
                ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><Bell size={17} /> Enable notifications</>
              }
            </button>
            <button
              onClick={dismiss}
              className="w-full py-3 rounded-2xl font-semibold text-[14px] text-[#BDBDBD] bg-[#1a1a1a] hover:bg-gray-150 transition-colors"
            >
              Maybe later
            </button>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
