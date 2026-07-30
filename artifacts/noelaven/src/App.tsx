import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/contexts/AuthContext';
import { UserCacheProvider, CurrentUserSeed } from '@/contexts/UserCacheContext';
import { DailySparkProvider } from '@/contexts/DailySparkContext';
import { SafetyProvider } from '@/contexts/SafetyContext';
import { CallProvider } from '@/contexts/CallContext';
import { NetworkProvider, useNetwork } from '@/contexts/NetworkContext';
import { OfflineScreen } from '@/components/ui/OfflineScreen';
import { NetworkBanner } from '@/components/ui/NetworkBanner';
import AppRouter from '@/components/layout/AppRouter';
import { Router as WouterRouter } from 'wouter';
import { AnimatePresence } from 'framer-motion';

const queryClient = new QueryClient();

/**
 * Provider nesting order (outermost → innermost):
 *
 *   NetworkProvider              — online/offline status (Capacitor Network + web events)
 *   QueryClientProvider          — React Query cache
 *   AuthProvider                 — Firebase Auth state; ALL useAuth() consumers must be below this
 *   UserCacheProvider            — real-time avatar/profile cache (reads currentUser via useAuth)
 *   CurrentUserSeed              — warms cache for logged-in user on mount
 *   SafetyProvider               — block/mute/restrict subscriptions (reads currentUser via useAuth)
 *   CallProvider                 — WebRTC call state (reads currentUser via useAuth + useWebRTC)
 *   DailySparkProvider           — single shared useDailySpark instance (reads currentUser via useAuth)
 *   TooltipProvider
 *   WouterRouter                 — client-side routing
 *   AppRouter                    — auth guard + page routing
 *
 * NetworkProvider is outermost so OfflineScreen can block the entire tree
 * without requiring Firebase/Auth to have initialised first.
 *
 * SafetyProvider and CallProvider are intentionally ABOVE AppRouter so they are
 * always mounted regardless of auth state. Both handle null currentUser gracefully
 * (they skip Firestore subscriptions when currentUser is null). This prevents the
 * "useAuth must be used within AuthProvider" crash that occurred when these providers
 * were conditionally rendered inside AuthenticatedApp and the component tree briefly
 * evaluated before the conditional branch resolved.
 */

/**
 * Inner shell that can read NetworkContext (which lives one level above App).
 * Renders the offline screen or the full app depending on connectivity.
 */
function AppShellWithNetwork() {
  const { isOnline } = useNetwork();

  return (
    <>
      {/* Mid-session connectivity banner (slim top bar, doesn't block the UI) */}
      <NetworkBanner />

      {/* Full-screen offline gate — only shown when there is truly no connection.
          We keep the inner tree mounted so Firestore's persistentLocalCache
          can still serve cached data once connectivity is restored. */}
      <AnimatePresence>
        {!isOnline && (
          <OfflineScreen
            key="offline"
            onRetry={() => {
              // navigator.onLine is the fastest synchronous check available on
              // web. On native, the NetworkContext listener will update isOnline
              // automatically via the Capacitor Network plugin — no manual action
              // needed. We force a re-render here just to clear retryFeedback.
            }}
          />
        )}
      </AnimatePresence>

      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {/* UserCacheProvider must be inside AuthProvider so CurrentUserSeed
              can read currentUser and immediately warm the cache for it. */}
          <UserCacheProvider>
            <CurrentUserSeed />
            <SafetyProvider>
              <CallProvider>
                {/* DailySparkProvider lives here so all pages share ONE useDailySpark
                    instance. Moving it above the router means the hook is mounted
                    once at app start and never resets on page navigation. */}
                <DailySparkProvider>
                  <TooltipProvider>
                    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
                      <AppRouter />
                    </WouterRouter>
                    <Toaster />
                  </TooltipProvider>
                </DailySparkProvider>
              </CallProvider>
            </SafetyProvider>
          </UserCacheProvider>
        </AuthProvider>
      </QueryClientProvider>
    </>
  );
}

function App() {
  return (
    <NetworkProvider>
      <AppShellWithNetwork />
    </NetworkProvider>
  );
}

export default App;
