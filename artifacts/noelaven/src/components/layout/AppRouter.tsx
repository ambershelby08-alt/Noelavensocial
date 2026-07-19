import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AppShell } from '@/components/layout/AppShell';
import { Route, Switch, Router as WouterRouter } from 'wouter';
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

function AuthenticatedApp() {
  return (
    <AppShell>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/profile/:userId" component={Profile} />
        <Route path="/communities" component={Communities} />
        <Route path="/communities/:id" component={CommunityFeed} />
        <Route path="/messages" component={Messages} />
        <Route path="/messages/:id" component={Chat} />
        <Route path="/discover" component={Discover} />
        <Route path="/notifications" component={Notifications} />
        <Route path="/settings" component={Settings} />
        <Route>
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
            <h2 className="text-2xl font-bold mb-2">Page Not Found</h2>
            <p className="text-muted-foreground mb-6">Looks like you've wandered off the path.</p>
          </div>
        </Route>
      </Switch>
    </AppShell>
  );
}

export default function AppRouter() {
  const { currentUser, isLoading } = useAuth();
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 rounded-2xl gradient-bg animate-pulse" />
      </div>
    );
  }
  
  if (!currentUser) {
    return (
      <Switch>
        <Route path="*" component={Login} />
      </Switch>
    );
  }
  
  return <AuthenticatedApp />;
}
