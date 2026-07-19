import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, mockUsers } from '@/lib/mockData';
import { isFirebaseConfigured } from '@/lib/firebase';
// If Firebase is configured, we would import auth methods here
// import { getAuth, signInWithPopup, GoogleAuthProvider, signOut as fbSignOut } from 'firebase/auth';

interface AuthContextType {
  currentUser: User | null;
  isLoading: boolean;
  signIn: () => Promise<void>;
  signUp: () => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  isDemoMode: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const isDemoMode = !isFirebaseConfigured;
  const demoUser = mockUsers.find(u => u.id === 'demo-user') || mockUsers[0];
  const [currentUser, setCurrentUser] = useState<User | null>(isDemoMode ? demoUser : null);
  const [isLoading, setIsLoading] = useState(!isDemoMode);

  useEffect(() => {
    if (!isDemoMode) {
      // When Firebase is actually configured, set up onAuthStateChanged here
      // For now, resolve loading immediately
      setIsLoading(false);
    }
  }, [isDemoMode]);

  const signIn = async () => {
    setIsLoading(true);
    setTimeout(() => {
      setCurrentUser(mockUsers.find(u => u.id === 'demo-user') || mockUsers[0]);
      setIsLoading(false);
    }, 800);
  };

  const signUp = async () => {
    return signIn();
  };

  const signOut = async () => {
    setCurrentUser(null);
  };

  const signInWithGoogle = async () => {
    return signIn();
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isLoading,
        signIn,
        signUp,
        signOut,
        signInWithGoogle,
        isDemoMode
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
