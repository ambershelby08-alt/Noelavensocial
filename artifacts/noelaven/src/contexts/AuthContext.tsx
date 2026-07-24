import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword,
  signInWithPopup, signInWithRedirect, getRedirectResult,
  GoogleAuthProvider, sendPasswordResetEmail,
  updateProfile, signOut as firebaseSignOut,
} from 'firebase/auth';
import { type FirebaseError } from 'firebase/app';
import { auth, isFirebaseConfigured } from '@/lib/firebase';
import { getUserDoc, createUserDoc, updateUserDoc, upsertUserBaseDoc, seedCommunitiesIfNeeded } from '@/lib/firestore';
import { User, mockUsers } from '@/lib/mockData';
import {
  getSavedAccounts, upsertSavedAccount,
  setPendingSwitchEmail,
  type SavedAccount,
} from '@/lib/accountStore';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PendingUser {
  displayName: string;
  email: string;
  /** Pre-filled from Google/OAuth provider photo — used as avatar fallback in CreateProfile */
  avatarUrl?: string;
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
  /** Non-null when getRedirectResult throws — shows the raw Firebase error code */
  redirectError: string | null;
  /** All accounts the user has previously signed in to on this device. */
  savedAccounts: SavedAccount[];
  /** True while the user is mid-flow adding a second account (Login is shown instead of the app). */
  addingAccount: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<void>;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  /** Show Login without signing out the current account; new sign-in saves both accounts. */
  startAddAccount: () => void;
  /** Sign out current user and pre-fill Login with the target account's email. */
  switchToAccount: (account: SavedAccount) => Promise<void>;
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
  const [redirectError, setRedirectError] = useState<string | null>(null);
  // Track the Firebase Auth UID so completeProfile can write to the right doc
  const [pendingUid, setPendingUid] = useState<string | null>(null);
  // Multi-account state
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>(() => getSavedAccounts());
  const [addingAccount, setAddingAccount] = useState(false);

  // ─── Auth initialization ──────────────────────────────────────────────────
  //
  // getRedirectResult MUST settle before onAuthStateChanged is registered.
  // If we register the listener first, it fires with null (no user yet) while
  // the redirect result is still pending — the route guard would incorrectly
  // show the Login page before the OAuth user is available.
  //
  // By chaining: getRedirectResult → register listener, Firebase's internal
  // auth state already reflects the redirect user by the time the listener
  // fires, so it fires exactly once with the correct state.
  useEffect(() => {
    if (isDemoMode || !auth) {
      setIsLoading(false);
      return;
    }

    seedCommunitiesIfNeeded();

    // Shared logic: resolve a Firebase user to app state (Firestore profile check).
    async function resolveUser(firebaseUser: import('firebase/auth').User | null) {
      if (!firebaseUser) {
        setCurrentUser(null);
        setPendingUser(null);
        setPendingUid(null);
        setIsNewUser(false);
        return;
      }

      const isGoogleUser = firebaseUser.providerData.some(
        p => p.providerId === 'google.com'
      );
      const googleAvatarUrl = isGoogleUser ? (firebaseUser.photoURL ?? '') : '';

      try {
        const profile = await getUserDoc(firebaseUser.uid);

        if (profile && profile.handle) {
          // Complete profile — route to Home.
          setCurrentUser(profile);
          setPendingUser(null);
          setPendingUid(null);
          setIsNewUser(false);
          setAddingAccount(false);
          // Persist account metadata for multi-account switching.
          const saved: SavedAccount = {
            uid: profile.id,
            email: profile.email ?? firebaseUser.email ?? '',
            displayName: profile.displayName,
            handle: profile.handle,
            avatarUrl: profile.avatarUrl ?? undefined,
          };
          upsertSavedAccount(saved);
          setSavedAccounts(getSavedAccounts());
        } else {
          // New or incomplete — persist base Google identity so it's
          // recoverable if the user closes before finishing profile setup.
          if (isGoogleUser) {
            await upsertUserBaseDoc(firebaseUser.uid, {
              displayName: firebaseUser.displayName ?? '',
              email: firebaseUser.email ?? '',
              avatarUrl: googleAvatarUrl,
            });
          }
          setPendingUser({
            displayName: firebaseUser.displayName ?? firebaseUser.email?.split('@')[0] ?? 'New User',
            email: firebaseUser.email ?? '',
            avatarUrl: googleAvatarUrl,
          });
          setPendingUid(firebaseUser.uid);
          setCurrentUser(null);
          setIsNewUser(true);
        }
      } catch {
        // Firestore error (offline etc.) — treat as new user so they can retry.
        setPendingUser({
          displayName: firebaseUser.displayName ?? 'New User',
          email: firebaseUser.email ?? '',
          avatarUrl: googleAvatarUrl,
        });
        setPendingUid(firebaseUser.uid);
        setCurrentUser(null);
        setIsNewUser(true);
      }
    }

    // auth is confirmed non-null by the guard above; narrow once for closures.
    const _auth = auth;
    let unsub: (() => void) | null = null;
    let cancelled = false;

    // Step 1 — process any pending redirect result. isLoading stays true.
    getRedirectResult(_auth)
      .then(result => {
        if (result?.user) {
          console.log('[Auth] Redirect result received for uid:', result.user.uid);
        }
      })
      .catch(err => {
        if (cancelled) return;
        const e = err as FirebaseError;
        console.error('[Auth] getRedirectResult error:', e.code, e.message);
        setRedirectError(`${e.message} [${e.code}]`);
      })
      .finally(() => {
        if (cancelled) return;

        // Step 2 — register the auth listener only after the redirect result
        // has been applied to Firebase's internal auth state.
        unsub = onAuthStateChanged(_auth, async firebaseUser => {
          if (cancelled) return;
          try {
            await resolveUser(firebaseUser);
          } finally {
            if (!cancelled) setIsLoading(false);
          }
        });
      });

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [isDemoMode]);

  // ─── Auth actions (demo mode stubs + real Firebase) ────────────────────────

  const signIn = useCallback(async (email: string, password: string) => {
    if (isDemoMode) {
      setIsLoading(true);
      await new Promise(r => setTimeout(r, 900));
      setCurrentUser(demoUser);
      setAddingAccount(false);
      setIsLoading(false);
      return;
    }
    if (!auth) throw new Error('Firebase Auth not initialized');
    try {
      setAddingAccount(false); // clear before Firebase picks up the new user
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged → resolveUser → upserts saved account
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
      setAddingAccount(false);
      setIsLoading(false);
      return;
    }
    if (!auth) throw new Error('Firebase Auth not initialized');

    try {
      if (isMobileBrowser()) {
        // Popups are unreliable on mobile — use redirect flow instead.
        // The page navigates away; onAuthStateChanged picks up the result on return.
        await signInWithRedirect(auth, new GoogleAuthProvider());
        return;
      }
      await signInWithPopup(auth, new GoogleAuthProvider());
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
          await signInWithRedirect(auth, new GoogleAuthProvider());
          return;
        } catch (redirectErr) {
          const re = redirectErr as FirebaseError;
          console.error('[Google Sign-In] Redirect fallback error:', re.code, re.message);
          // Show exact code so it's diagnosable if redirect also fails.
          throw new Error(`${friendlyAuthError(re.code)} [${re.code}]`);
        }
      }

      // All other errors — show friendly message plus the exact Firebase code for diagnosis.
      throw new Error(`${friendlyAuthError(e.code)} [${e.code}]`);
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
        // Use explicitly uploaded avatar first; fall back to Google/OAuth photo.
        avatarUrl: data.avatarUrl ?? pendingUser?.avatarUrl,
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
    // Evict per-user caches before clearing the session
    if (currentUser) {
      const { evictConversations } = await import('@/lib/msgCache');
      evictConversations(currentUser.id);
    }
    if (!isDemoMode && auth) {
      await firebaseSignOut(auth);
    }
    setCurrentUser(null);
    setIsNewUser(false);
    setPendingUser(null);
    setPendingUid(null);
    setAddingAccount(false);
    // In demo mode, reload to reset all state
    if (isDemoMode) window.location.reload();
  }, [isDemoMode, currentUser]);

  /** Show Login screen without signing the current user out first.
   *  When the new user signs in, both accounts are stored in savedAccounts. */
  const startAddAccount = useCallback(() => {
    setAddingAccount(true);
  }, []);

  /** Sign out current user and pre-fill Login with the target account's email. */
  const switchToAccount = useCallback(async (account: SavedAccount) => {
    setPendingSwitchEmail(account.email);
    // Evict per-user caches
    if (currentUser) {
      const { evictConversations } = await import('@/lib/msgCache');
      evictConversations(currentUser.id);
    }
    if (!isDemoMode && auth) {
      await firebaseSignOut(auth);
    }
    setCurrentUser(null);
    setIsNewUser(false);
    setPendingUser(null);
    setPendingUid(null);
    setAddingAccount(false);
    if (isDemoMode) window.location.reload();
  }, [isDemoMode, currentUser]);

  const updateUser = useCallback((updates: Partial<User>) => {
    setCurrentUser(prev => (prev ? { ...prev, ...updates } : prev));
    if (!isDemoMode && currentUser) {
      updateUserDoc(currentUser.id, updates).catch(console.error);
    }
  }, [isDemoMode, currentUser]);

  return (
    <AuthContext.Provider
      value={{
        currentUser, pendingUser, isLoading, isNewUser, isDemoMode, redirectError,
        savedAccounts, addingAccount,
        signIn, signUp, signInWithGoogle, signOut,
        startAddAccount, switchToAccount,
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
    'auth/operation-not-supported-in-this-environment': 'Google sign-in is not supported in this browser. Use email and password instead.',
  };
  return map[code] ?? 'Something went wrong. Please try again.';
}
