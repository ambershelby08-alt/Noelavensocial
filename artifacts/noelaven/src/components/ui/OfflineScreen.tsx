/**
 * OfflineScreen
 *
 * Full-screen overlay shown when the device has no network connectivity.
 * Rendered by App.tsx when NetworkContext.isOnline === false.
 *
 * Design intent: matches Noelaven's dark aesthetic (near-black + pink/purple
 * gradient accents) so users know they are in-app, not looking at a browser
 * error page. This is the key difference that satisfies Apple App Store
 * Review Guideline 4.2 (Minimum Functionality) for WebView wrapper apps.
 */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, RefreshCw } from 'lucide-react';

interface OfflineScreenProps {
  /** Called when the user taps "Try Again". Parent decides if we're back online. */
  onRetry?: () => void;
}

export function OfflineScreen({ onRetry }: OfflineScreenProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryFeedback, setRetryFeedback] = useState<string | null>(null);

  const handleRetry = useCallback(async () => {
    if (isRetrying) return;
    setIsRetrying(true);
    setRetryFeedback(null);

    // Brief pause so the spinner is visible — then check navigator.onLine
    await new Promise(r => setTimeout(r, 800));

    if (navigator.onLine) {
      // Browser reports back online — trigger the parent's recheck
      onRetry?.();
      // The parent will unmount this component when isOnline flips to true.
      // If it somehow stays mounted, clear the retrying state.
      setIsRetrying(false);
    } else {
      setRetryFeedback("Still no connection. Check your Wi-Fi or data.");
      setIsRetrying(false);
    }
  }, [isRetrying, onRetry]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[500] flex flex-col items-center justify-center px-8"
      style={{
        background: 'linear-gradient(160deg, #060610 0%, #0e0618 60%, #060610 100%)',
      }}
    >
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 w-80 h-80 rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(124,58,237,0.14) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute bottom-1/3 left-1/2 -translate-x-1/2 w-60 h-60 rounded-full"
          style={{
            background:
              'radial-gradient(circle, rgba(236,72,153,0.10) 0%, transparent 70%)',
          }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-xs">
        {/* Icon ring */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 18, stiffness: 260, delay: 0.1 }}
          className="mb-7"
        >
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center"
            style={{
              background:
                'linear-gradient(135deg, rgba(124,58,237,0.18) 0%, rgba(236,72,153,0.18) 100%)',
              border: '1.5px solid rgba(236,72,153,0.3)',
              boxShadow: '0 0 40px rgba(124,58,237,0.15)',
            }}
          >
            <WifiOff size={38} className="text-[#EC4899]" strokeWidth={1.5} />
          </div>
        </motion.div>

        {/* App wordmark */}
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="text-[13px] font-black tracking-[0.3em] uppercase mb-3"
          style={{
            background: 'linear-gradient(90deg, #EC4899, #A78BFA)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          noelaven
        </motion.p>

        <motion.h1
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-[24px] font-black text-white mb-3 leading-tight"
        >
          No Internet Connection
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="text-[14.5px] text-white/50 leading-relaxed mb-8"
        >
          Check your Wi-Fi or mobile data, then tap{' '}
          <span className="text-white/70 font-semibold">Try Again</span>.
        </motion.p>

        {/* Try Again button */}
        <motion.button
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          whileTap={isRetrying ? {} : { scale: 0.95 }}
          onClick={handleRetry}
          disabled={isRetrying}
          className="flex items-center gap-2.5 px-8 py-3.5 rounded-[16px] text-[15px] font-bold text-white disabled:opacity-70"
          style={{
            background: 'linear-gradient(135deg, #EC4899, #7C3AED)',
            boxShadow: '0 6px 24px rgba(236,72,153,0.35)',
          }}
        >
          <motion.span
            animate={isRetrying ? { rotate: 360 } : { rotate: 0 }}
            transition={
              isRetrying
                ? { duration: 0.8, repeat: Infinity, ease: 'linear' }
                : { duration: 0 }
            }
            style={{ display: 'inline-flex' }}
          >
            <RefreshCw size={17} strokeWidth={2.5} />
          </motion.span>
          {isRetrying ? 'Checking…' : 'Try Again'}
        </motion.button>

        {/* Retry feedback */}
        <AnimatePresence>
          {retryFeedback && (
            <motion.p
              key="feedback"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 text-[12.5px] text-amber-400 font-medium"
            >
              {retryFeedback}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
