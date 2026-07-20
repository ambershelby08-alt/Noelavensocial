import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Route, Switch } from 'wouter';

import Home from '@/pages/Home';
import Profile from '@/pages/Profile';
import Communities from '@/pages/Communities';
import CommunityFeed from '@/pages/CommunityFeed';
import Messages from '@/pages/Messages';
import Chat from '@/pages/Chat';
import Discover from '@/pages/Discover';
import Notifications from '@/pages/Notifications';
import Settings from '@/pages/Settings';

import Login from '@/pages/Login';
import Signup from '@/pages/Signup';
import ForgotPassword from '@/pages/ForgotPassword';
import CreateProfile from '@/pages/CreateProfile';

// ─── Authenticated shell ──────────────────────────────────────────────────────

function AuthenticatedApp() {
  return (
    <AppShell>
      <Switch>
        <Route path="/"                   component={Home} />
        <Route path="/profile/:userId"    component={Profile} />
        <Route path="/communities"        component={Communities} />
        <Route path="/communities/:id"    component={CommunityFeed} />
        <Route path="/messages"           component={Messages} />
        <Route path="/messages/:id"       component={Chat} />
        <Route path="/discover"           component={Discover} />
        <Route path="/notifications"      component={Notifications} />
        <Route path="/settings"           component={Settings} />
        <Route>
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
            <p className="text-5xl mb-4">🌿</p>
            <h2 className="text-2xl font-bold mb-2">Page Not Found</h2>
            <p className="text-gray-400">Looks like you've wandered off the path.</p>
          </div>
        </Route>
      </Switch>
    </AppShell>
  );
}

// ─── Loading spinner ──────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FDF9F6]">
      <div
        className="w-14 h-14 rounded-2xl animate-pulse"
        style={{ background: 'linear-gradient(135deg, #6B73FF, #9B59B6, #FF6B9D)' }}
      />
    </div>
  );
}

// ─── Router ───────────────────────────────────────────────────────────────────

export default function AppRouter() {
  const { currentUser, isLoading, isNewUser } = useAuth();


  if (isLoading) return <LoadingScreen />;

  // After sign-up, before profile is complete
  if (isNewUser && !currentUser) return <CreateProfile />;

  // Unauthenticated routes
  if (!currentUser) {
    return (
      <Switch>
        <Route path="/signup"           component={Signup} />
        <Route path="/forgot-password"  component={ForgotPassword} />
        <Route path="*"                 component={Login} />
      </Switch>
    );
  }

  return <AuthenticatedApp />;
}
