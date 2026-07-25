import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Route, Switch, Redirect, useLocation } from 'wouter';

import Home from '@/pages/Home';
import Profile from '@/pages/Profile';
import Communities from '@/pages/Communities';
import CommunityFeed from '@/pages/CommunityFeed';
import Messages from '@/pages/Messages';
import Chat from '@/pages/Chat';
import Discover from '@/pages/Discover';
import Notifications from '@/pages/Notifications';
import Settings from '@/pages/Settings';
import PostDetail from '@/pages/PostDetail';
import SafetySettings from '@/pages/SafetySettings';
import MyReports from '@/pages/MyReports';
import ModerationDashboard from '@/pages/ModerationDashboard';

import Login from '@/pages/Login';
import Signup from '@/pages/Signup';
import ForgotPassword from '@/pages/ForgotPassword';
import CreateProfile from '@/pages/CreateProfile';
// ─── Authenticated shell ──────────────────────────────────────────────────────
// SafetyProvider and CallProvider are now mounted in App.tsx above AppRouter so
// they are unconditionally available. AppShell can safely call useCall() and
// useSafety() regardless of when it first renders.

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
        <Route path="/post/:postId"       component={PostDetail} />
        <Route path="/safety"             component={SafetySettings} />
        <Route path="/my-reports"         component={MyReports} />
        <Route path="/moderation"         component={ModerationDashboard} />
        <Route>
          <div className="flex flex-col items-center justify-center min-h-[70vh] text-center px-6">
            <p className="text-6xl mb-5">🌿</p>
            <h2 className="text-[22px] font-black text-gray-900 mb-2">Page not found</h2>
            <p className="text-[14.5px] text-gray-400 mb-8 max-w-[220px] leading-relaxed">
              Looks like you've wandered off the path.
            </p>
            <a
              href="/"
              className="px-7 py-3 rounded-full text-[14.5px] font-black text-white"
              style={{ background: 'linear-gradient(135deg, #6B73FF, #FF6B9D)', boxShadow: '0 4px 16px rgba(107,115,255,0.35)' }}
            >
              Back to Home
            </a>
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

const AUTH_ONLY_PATHS = ['/login', '/signup', '/forgot-password'];

export default function AppRouter() {
  const { currentUser, isLoading, isNewUser, addingAccount } = useAuth();
  const [location] = useLocation();

  if (isLoading) return <LoadingScreen />;

  // After sign-up, before profile is complete
  if (isNewUser && !currentUser) return <CreateProfile />;

  // "Add Account" flow — show Login even while a user is already signed in.
  // When the new sign-in completes, addingAccount resets and AuthenticatedApp renders.
  if (addingAccount) {
    return (
      <Switch>
        <Route path="/signup"           component={Signup} />
        <Route path="/forgot-password"  component={ForgotPassword} />
        <Route path="*"                 component={Login} />
      </Switch>
    );
  }

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

  // Authenticated user landed on an auth-only path
  if (AUTH_ONLY_PATHS.some(p => location === p || location.startsWith(p + '/'))) {
    return <Redirect to="/" />;
  }

  // Browser at the exact base path without trailing slash
  if (location === '') {
    return <Redirect to="/" />;
  }

  return <AuthenticatedApp />;
}
