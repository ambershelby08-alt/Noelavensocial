import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/contexts/AuthContext';
import { UserCacheProvider, CurrentUserSeed } from '@/contexts/UserCacheContext';
import { DailySparkProvider } from '@/contexts/DailySparkContext';
import AppRouter from '@/components/layout/AppRouter';
import { Router as WouterRouter } from 'wouter';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        {/* UserCacheProvider must be inside AuthProvider so CurrentUserSeed
            can read currentUser and immediately warm the cache for it. */}
        <UserCacheProvider>
          <CurrentUserSeed />
          {/* DailySparkProvider lives here so all pages share ONE useDailySpark
              instance.  Moving it above the router means the hook is mounted
              once at app start and never resets on page navigation. */}
          <DailySparkProvider>
            <TooltipProvider>
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
                <AppRouter />
              </WouterRouter>
              <Toaster />
            </TooltipProvider>
          </DailySparkProvider>
        </UserCacheProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
