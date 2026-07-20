import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signInWithPopup, signInWithRedirect, getRedirectResult,
  GoogleAuthProvider, sendPasswordResetEmail,
  updateProfile, signOut as firebaseSignOut,
} from 'firebase/auth';
import { type FirebaseError } from 'firebase/app';
import { auth, isFirebaseConfigured } from '@/lib/firebase';
import { getUserDoc, createUserDoc, updateUserDoc, seedCommunitiesIfNeeded } from '@/lib/firestore';
import { User, mockUsers } from '@/lib/mockData';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PendingUser {
  displayName: string;
  email: string;
}

export interface ProfileData {
  handle: string;
  bio: string;
  interests: string[];
  avatarUrl?: string;
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
  updateUser: (updates: Partial<User>) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const googleProvider = new GoogleAuthProvider();

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const isDemoMode = !isFirebaseConfigured;
  const demoUser = mockUsers.find(u => u.id === 'demo-user') ?? mockUsers[0];

  const [currentUser, setCurrentUser] = useState<User | null>(isDemoMode ? demoUser : null);
  const [pendingUser, setPendingUser] = useState<PendingUser | null>(null);
  const [isLoading, setIsLoading] = useState(!isDemoMode);
  const [isNewUser, setIsNewUser] = useState(false);
  // Track the Firebase Auth UID so completeProfile can write to the right doc
  const [pendingUid, setPendingUid] = useState<string | null>(null);

  // ─── Handle completed redirect sign-ins (mobile Google flow) ────────────────
  useEffect(() => {
    if (isDemoMode || !auth) return;
    getRedirectResult(auth).catch(err => {
      const e = err as FirebaseError;
      // Log but don't crash — onAuthStateChanged handles the success path.
      // Errors here (e.g. auth/unauthorized-domain) surface on the next sign-in attempt.
      console.error('[Google Sign-In Redirect Result] error:', e.code, e.message);
    });
  }, [isDemoMode]);

  // ─── Firebase auth listener ────────────────────────────────────────────────
  useEffect(() => {
    if (isDemoMode || !auth) {
      setIsLoading(false);
      return;
    }

    // Seed default communities once (no-op if already seeded)
    seedCommunitiesIfNeeded();

    const unsub = onAuthStateChanged(auth, async firebaseUser => {
      if (!firebaseUser) {
        setCurrentUser(null);
        setPendingUser(null);
        setPendingUid(null);
        setIsNewUser(false);
        setIsLoading(false);
        return;
      }

      try {
        const profile = await getUserDoc(firebaseUser.uid);

        if (profile && profile.handle) {
          // Existing complete profile
          setCurrentUser(profile);
          setPendingUser(null);
          setPendingUid(null);
          setIsNewUser(false);
        } else {
          // New user — profile not yet created (or created but missing handle)
          setPendingUser({
            displayName: firebaseUser.displayName ?? firebaseUser.email?.split('@')[0] ?? 'New User',
            email: firebaseUser.email ?? '',
          });
          setPendingUid(firebaseUser.uid);
          setCurrentUser(null);
          setIsNewUser(true);
        }
      } catch {
        // Firestore error (e.g. offline) — treat as new user
        setPendingUser({
          displayName: firebaseUser.displayName ?? 'New User',
          email: firebaseUser.email ?? '',
        });
        setPendingUid(firebaseUser.uid);
        setCurrentUser(null);
        setIsNewUser(true);
      } finally {
        setIsLoading(false);
      }
    });

    return unsub;
  }, [isDemoMode]);

  // ─── Auth actions (demo mode stubs + real Firebase) ────────────────────────

  const signIn = useCallback(async (email: string, password: string) => {
    if (isDemoMode) {
      setIsLoading(true);
      await new Promise(r => setTimeout(r, 900));
      setCurrentUser(demoUser);
      setIsLoading(false);
      return;
    }
    if (!auth) throw new Error('Firebase Auth not initialized');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged handles the rest
    } catch (err) {
      const e = err as FirebaseError;
      throw new Error(friendlyAuthError(e.code));
    }
  }, [isDemoMode]);

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    if (isDemoMode) {
      setIsLoading(true);
      await new Promise(r => setTimeout(r, 900));
      setPendingUser({ displayName, email });
      setIsNewUser(true);
      setIsLoading(false);
      return;
    }
    if (!auth) throw new Error('Firebase Auth not initialized');
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(cred.user, { displayName });
      // onAuthStateChanged fires → profile missing → isNewUser = true
    } catch (err) {
      const e = err as FirebaseError;
      throw new Error(friendlyAuthError(e.code));
    }
  }, [isDemoMode]);

  const signInWithGoogle = useCallback(async () => {
    if (isDemoMode) {
      setIsLoading(true);
      await new Promise(r => setTimeout(r, 700));
      setCurrentUser(demoUser);
      setIsLoading(false);
      return;
    }
    if (!auth) throw new Error('Firebase Auth not initialized');

    try {
      if (isMobileBrowser()) {
        // Popups are unreliable on mobile — use redirect flow instead.
        // The page navigates away; onAuthStateChanged picks up the result on return.
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      await signInWithPopup(auth, googleProvider);
      // onAuthStateChanged handles session setup
    } catch (err) {
      const e = err as FirebaseError;
      // Always log the original code/message for debugging — never swallow silently.
      console.error('[Google Sign-In] Firebase error:', e.code, e.message);

      // User-initiated dismissals — no error to surface.
      if (
        e.code === 'auth/popup-closed-by-user' ||
        e.code === 'auth/cancelled-popup-request' ||
        e.code === 'auth/user-cancelled'
      ) return;

      // Popup blocked or unsupported environment — fall back to redirect.
      if (
        e.code === 'auth/popup-blocked' ||
        e.code === 'auth/operation-not-supported-in-this-environment'
      ) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (redirectErr) {
          const re = redirectErr as FirebaseError;
          console.error('[Google Sign-In] Redirect fallback error:', re.code, re.message);
          throw new Error(friendlyAuthError(re.code));
        }
      }

      // All other errors — surface a friendly message without crashing.
      throw new Error(friendlyAuthError(e.code));
    }
  }, [isDemoMode]);

  const completeProfile = useCallback(async (data: ProfileData) => {
    setIsLoading(true);

    if (isDemoMode) {
      await new Promise(r => setTimeout(r, 800));
      const newUser: User = {
        id: `user-${Date.now()}`,
        displayName: pendingUser?.displayName ?? 'New User',
        handle: data.handle,
        bio: data.bio,
        avatarUrl: '',
        coverUrl: '',
        interests: data.interests,
        followers: 0, following: 0, postCount: 0,
        badges: ['New Member'],
        joinedAt: new Date(),
      };
      setCurrentUser(newUser);
      setIsNewUser(false);
      setPendingUser(null);
      setIsLoading(false);
      return;
    }

    if (!pendingUid) {
      setIsLoading(false);
      throw new Error('No pending user — please sign up first');
    }

    try {
      await createUserDoc(pendingUid, {
        displayName: pendingUser?.displayName ?? 'New User',
        handle: data.handle,
        bio: data.bio,
        interests: data.interests,
        email: pendingUser?.email,
        avatarUrl: data.avatarUrl,
      });
      const profile = await getUserDoc(pendingUid);
      if (profile) {
        setCurrentUser(profile);
        setIsNewUser(false);
        setPendingUser(null);
        setPendingUid(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, [isDemoMode, pendingUser, pendingUid]);

  const resetPassword = useCallback(async (email: string) => {
    if (isDemoMode) {
      await new Promise(r => setTimeout(r, 800));
      return;
    }
    if (!auth) throw new Error('Firebase Auth not initialized');
    try {
      await sendPasswordResetEmail(auth, email);
    } catch (err) {
      const e = err as FirebaseError;
      throw new Error(friendlyAuthError(e.code));
    }
  }, [isDemoMode]);

  const signOut = useCallback(async () => {
    if (!isDemoMode && auth) {
      await firebaseSignOut(auth);
    }
    setCurrentUser(isDemoMode ? null : null);
    setIsNewUser(false);
    setPendingUser(null);
    setPendingUid(null);
    // In demo mode, reload to reset all state
    if (isDemoMode) window.location.reload();
  }, [isDemoMode]);

  const updateUser = useCallback((updates: Partial<User>) => {
    setCurrentUser(prev => (prev ? { ...prev, ...updates } : prev));
    if (!isDemoMode && currentUser) {
      updateUserDoc(currentUser.id, updates).catch(console.error);
    }
  }, [isDemoMode, currentUser]);

  return (
    <AuthContext.Provider
      value={{
        currentUser, pendingUser, isLoading, isNewUser, isDemoMode,
        signIn, signUp, signInWithGoogle, signOut,
        completeProfile, resetPassword, updateUser,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** True on phones/tablets where signInWithPopup is unreliable. */
function isMobileBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  return (
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    // iPadOS 13+ reports itself as a Mac with touch support
    (navigator.maxTouchPoints > 1 && /Mac/i.test(navigator.platform))
  );
}

// ─── Error messages ───────────────────────────────────────────────────────────

function friendlyAuthError(code: string): string {
  const map: Record<string, string> = {
    'auth/invalid-email':                          "That email address doesn't look right.",
    'auth/user-not-found':                         'No account found with that email.',
    'auth/wrong-password':                         'Incorrect password. Please try again.',
    'auth/invalid-credential':                     'Incorrect email or password.',
    'auth/email-already-in-use':                   'An account with this email already exists.',
    'auth/weak-password':                          'Password must be at least 6 characters.',
    'auth/too-many-requests':                      'Too many attempts. Please wait a moment.',
    'auth/network-request-failed':                 'Network error. Check your connection.',
    'auth/popup-blocked':                          'Pop-up was blocked — please allow pop-ups and try again.',
    'auth/unauthorized-domain':                    'Google sign-in is not enabled for this domain. Use email and password instead.',
    'auth/operation-not-supported-in-this-environment': 'Google sign-in is not supported in this browser. Use email and password instead.',
  };
  return map[code] ?? 'Something went wrong. Please try again.';
}
