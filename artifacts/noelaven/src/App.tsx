import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/contexts/AuthContext';
import { UserCacheProvider, CurrentUserSeed } from '@/contexts/UserCacheContext';
import { DailySparkProvider } from '@/contexts/DailySparkContext';
import { SafetyProvider } from '@/contexts/SafetyContext';
import { CallProvider } from '@/contexts/CallContext';
import AppRouter from '@/components/layout/AppRouter';
import { Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();

/**
 * Provider nesting order (outermost → innermost):
 *
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
 * SafetyProvider and CallProvider are intentionally ABOVE AppRouter so they are
 * always mounted regardless of auth state. Both handle null currentUser gracefully
 * (they skip Firestore subscriptions when currentUser is null). This prevents the
 * "useAuth must be used within AuthProvider" crash that occurred when these providers
 * were conditionally rendered inside AuthenticatedApp and the component tree briefly
 * evaluated before the conditional branch resolved.
 */
function App() {
  return (
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
  );
}

export default App;
