import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, mockUsers } from '@/lib/mockData';
import { isFirebaseConfigured } from '@/lib/firebase';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PendingUser {
  displayName: string;
  email: string;
}

export interface ProfileData {
  handle: string;
  bio: string;
  interests: string[];
}

interface AuthContextType {
  currentUser: User | null;
  pendingUser: PendingUser | null;
  isLoading: boolean;
  isNewUser: boolean;
  isDemoMode: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  completeProfile: (data: ProfileData) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const isDemoMode = !isFirebaseConfigured;
  const demoUser = mockUsers.find(u => u.id === 'demo-user') ?? mockUsers[0];

  const [currentUser, setCurrentUser] = useState<User | null>(isDemoMode ? demoUser : null);
  const [pendingUser, setPendingUser] = useState<PendingUser | null>(null);
  const [isLoading, setIsLoading] = useState(!isDemoMode);
  const [isNewUser, setIsNewUser] = useState(false);

  useEffect(() => {
    if (!isDemoMode) {
      // Real Firebase: wire onAuthStateChanged here
      setIsLoading(false);
    }
  }, [isDemoMode]);

  // Simulated 900 ms network delay for all auth actions
  function delay(ms = 900) {
    return new Promise<void>(r => setTimeout(r, ms));
  }

  const signIn = async (email: string, _password: string) => {
    setIsLoading(true);
    await delay();
    // Placeholder: any credentials succeed and log in as the demo user
    setCurrentUser(mockUsers.find(u => u.id === 'demo-user') ?? mockUsers[0]);
    setIsLoading(false);
  };

  const signUp = async (_email: string, _password: string, displayName: string) => {
    setIsLoading(true);
    await delay();
    // Placeholder: store name/email, route to profile creation
    setPendingUser({ displayName, email: _email });
    setIsNewUser(true);
    setIsLoading(false);
  };

  const signInWithGoogle = async () => {
    setIsLoading(true);
    await delay(700);
    setCurrentUser(mockUsers.find(u => u.id === 'demo-user') ?? mockUsers[0]);
    setIsLoading(false);
  };

  const completeProfile = async (data: ProfileData) => {
    setIsLoading(true);
    await delay(800);
    const newUser: User = {
      id: `user-${Date.now()}`,
      displayName: pendingUser?.displayName ?? 'New User',
      handle: data.handle,
      bio: data.bio,
      avatarUrl: `https://api.dicebear.com/9.x/avataaars/svg?seed=${data.handle}`,
      coverUrl: `https://picsum.photos/800/300?random=${Math.floor(Math.random() * 99)}`,
      interests: data.interests,
      followers: 0,
      following: 0,
      postCount: 0,
      badges: ['New Member'],
      joinedAt: new Date(),
    };
    setCurrentUser(newUser);
    setIsNewUser(false);
    setPendingUser(null);
    setIsLoading(false);
  };

  const resetPassword = async (_email: string) => {
    await delay(800);
    // Real Firebase: sendPasswordResetEmail(auth, email)
  };

  const signOut = async () => {
    setCurrentUser(null);
    setIsNewUser(false);
    setPendingUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser, pendingUser, isLoading, isNewUser, isDemoMode,
        signIn, signUp, signInWithGoogle, signOut, completeProfile, resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
