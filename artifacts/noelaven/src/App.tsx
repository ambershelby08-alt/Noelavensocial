import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider } from '@/contexts/AuthContext';
import { UserCacheProvider, CurrentUserSeed } from '@/contexts/UserCacheContext';
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
          <TooltipProvider>
            <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
              <AppRouter />
            </WouterRouter>
            <Toaster />
          </TooltipProvider>
        </UserCacheProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
