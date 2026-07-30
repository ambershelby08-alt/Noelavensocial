/**
 * NetworkContext
 *
 * Tracks online/offline status using:
 *   1. @capacitor/network on native (iOS/Android) — reliable even when
 *      the OS-level network state changes while the app is backgrounded.
 *   2. navigator.onLine + window 'online'/'offline' events on web/PWA.
 *
 * Both paths expose the same API:
 *   const { isOnline } = useNetwork();
 *
 * The context is intentionally simple — it answers the single question
 * "can we reach the internet right now?" so the rest of the app can
 * decide whether to show an offline screen.
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Capacitor } from '@capacitor/core';

interface NetworkContextValue {
  /** True when the device appears to have network connectivity. */
  isOnline: boolean;
  /** True only during the initial platform capability probe. */
  isInitializing: boolean;
}

const NetworkContext = createContext<NetworkContextValue>({
  isOnline: true,
  isInitializing: false,
});

export function useNetwork(): NetworkContextValue {
  return useContext(NetworkContext);
}

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  // Optimistically assume online; we correct once the plugin/event fires.
  const [isOnline, setIsOnline] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);
  const unlistenRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (Capacitor.isNativePlatform()) {
        // ── Native (iOS / Android) ──────────────────────────────────────────
        try {
          const { Network } = await import('@capacitor/network');
          const status = await Network.getStatus();
          if (!cancelled) setIsOnline(status.connected);

          const handler = await Network.addListener('networkStatusChange', s => {
            if (!cancelled) setIsOnline(s.connected);
          });
          unlistenRef.current = () => handler.remove();
        } catch (err) {
          console.warn('[NetworkContext] Capacitor Network unavailable:', err);
          // Fall through to web path
          attachWebListeners(cancelled);
        }
      } else {
        // ── Web / browser ───────────────────────────────────────────────────
        attachWebListeners(cancelled);
      }

      if (!cancelled) setIsInitializing(false);
    }

    function attachWebListeners(isCancelled: boolean) {
      if (!isCancelled) setIsOnline(navigator.onLine);
      const onOnline  = () => { if (!isCancelled) setIsOnline(true);  };
      const onOffline = () => { if (!isCancelled) setIsOnline(false); };
      window.addEventListener('online',  onOnline);
      window.addEventListener('offline', onOffline);
      unlistenRef.current = () => {
        window.removeEventListener('online',  onOnline);
        window.removeEventListener('offline', onOffline);
      };
    }

    init();

    return () => {
      cancelled = true;
      unlistenRef.current?.();
    };
  }, []);

  return (
    <NetworkContext.Provider value={{ isOnline, isInitializing }}>
      {children}
    </NetworkContext.Provider>
  );
}
