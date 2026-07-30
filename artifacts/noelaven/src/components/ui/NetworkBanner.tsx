/**
 * NetworkBanner
 *
 * A slim top banner shown when the connection is lost or just restored.
 *
 *   Offline  → persistent red banner: "You're offline"
 *   Restored → brief green banner "Back online" that auto-dismisses after 2.5s
 *
 * This complements OfflineScreen: OfflineScreen blocks cold-launch failures,
 * while NetworkBanner gives feedback for mid-session drops when the cached
 * Firestore data is still visible (so we don't cover the whole screen).
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, Wifi } from 'lucide-react';
import { useNetwork } from '@/contexts/NetworkContext';

export function NetworkBanner() {
  const { isOnline, isInitializing } = useNetwork();
  const prevOnlineRef   = useRef(true);
  const [show, setShow] = useState(false);
  const [restored, setRestored]   = useState(false);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isInitializing) return;

    const wasOnline = prevOnlineRef.current;
    prevOnlineRef.current = isOnline;

    if (!isOnline && wasOnline) {
      // Just went offline
      setRestored(false);
      setShow(true);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    } else if (isOnline && !wasOnline) {
      // Just came back online
      setRestored(true);
      setShow(true);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = setTimeout(() => setShow(false), 2500);
    }

    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [isOnline, isInitializing]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key={restored ? 'restored' : 'offline'}
          initial={{ y: -48, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -48, opacity: 0 }}
          transition={{ type: 'spring', damping: 24, stiffness: 320 }}
          className="fixed top-0 inset-x-0 z-[490] flex items-center justify-center gap-2 py-2.5 px-4 text-[12.5px] font-bold text-white"
          style={{
            background: restored
              ? 'linear-gradient(90deg, #059669, #10B981)'
              : 'linear-gradient(90deg, #DC2626, #EF4444)',
            paddingTop: 'calc(env(safe-area-inset-top, 0px) + 10px)',
          }}
        >
          {restored
            ? <Wifi size={14} strokeWidth={2.5} />
            : <WifiOff size={14} strokeWidth={2.5} />}
          {restored ? 'Back online' : "You're offline"}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
