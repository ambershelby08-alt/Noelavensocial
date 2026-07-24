/**
 * SafetyContext — provides real-time block / mute / restrict state
 * and safety settings for the current user.
 */
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import {
  subscribeBlockedUsers, subscribeBlockedByUsers,
  subscribeMutedUsers, subscribeRestrictedUsers,
  subscribeSafetySettings, updateSafetySettings as fsUpdateSettings,
  blockUser as fsBlock, unblockUser as fsUnblock,
  muteUser as fsMute, unmuteUser as fsUnmute,
  restrictUser as fsRestrict, unrestrictUser as fsUnrestrict,
  defaultSafetySettings,
} from '@/lib/safety';
import type { SafetySettings } from '@/lib/mockData';

interface SafetyContextValue {
  /** IDs of users I have blocked */
  blockedIds:    Set<string>;
  /** IDs of users who have blocked me */
  blockedByIds:  Set<string>;
  /** IDs of users I have muted */
  mutedIds:      Set<string>;
  /** IDs of users I have restricted */
  restrictedIds: Set<string>;
  /** Current user's privacy / safety preferences */
  safetySettings: SafetySettings;

  // Actions
  blockUser:       (userId: string) => Promise<void>;
  unblockUser:     (userId: string) => Promise<void>;
  muteUser:        (userId: string) => Promise<void>;
  unmuteUser:      (userId: string) => Promise<void>;
  restrictUser:    (userId: string) => Promise<void>;
  unrestrictUser:  (userId: string) => Promise<void>;
  updateSafetySettings: (s: Partial<SafetySettings>) => Promise<void>;

  // Derived helpers
  isBlocked:    (userId: string) => boolean;
  isBlockedBy:  (userId: string) => boolean;
  isMuted:      (userId: string) => boolean;
  isRestricted: (userId: string) => boolean;
  /** Returns true if neither user has blocked the other */
  canInteract:  (userId: string) => boolean;
}

const SafetyContext = createContext<SafetyContextValue | null>(null);

export function SafetyProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const uid = currentUser?.id ?? null;

  const [blockedIds,    setBlockedIds]    = useState<Set<string>>(new Set());
  const [blockedByIds,  setBlockedByIds]  = useState<Set<string>>(new Set());
  const [mutedIds,      setMutedIds]      = useState<Set<string>>(new Set());
  const [restrictedIds, setRestrictedIds] = useState<Set<string>>(new Set());
  const [safetySettings, setSafetySettings] = useState<SafetySettings>(defaultSafetySettings());

  useEffect(() => {
    if (!uid) return;
    const unsubs = [
      subscribeBlockedUsers   (uid, ids => setBlockedIds   (new Set(ids))),
      subscribeBlockedByUsers (uid, ids => setBlockedByIds (new Set(ids))),
      subscribeMutedUsers     (uid, ids => setMutedIds     (new Set(ids))),
      subscribeRestrictedUsers(uid, ids => setRestrictedIds(new Set(ids))),
      subscribeSafetySettings (uid, s   => setSafetySettings(s)),
    ];
    return () => unsubs.forEach(u => u());
  }, [uid]);

  // ── Optimistic helpers ─────────────────────────────────────────────────────

  const blockUser = useCallback(async (targetId: string) => {
    if (!uid) return;
    setBlockedIds(prev => new Set([...prev, targetId]));
    try { await fsBlock(uid, targetId); }
    catch { setBlockedIds(prev => { const n = new Set(prev); n.delete(targetId); return n; }); }
  }, [uid]);

  const unblockUser = useCallback(async (targetId: string) => {
    if (!uid) return;
    setBlockedIds(prev => { const n = new Set(prev); n.delete(targetId); return n; });
    try { await fsUnblock(uid, targetId); }
    catch { setBlockedIds(prev => new Set([...prev, targetId])); }
  }, [uid]);

  const muteUser = useCallback(async (targetId: string) => {
    if (!uid) return;
    setMutedIds(prev => new Set([...prev, targetId]));
    try { await fsMute(uid, targetId); }
    catch { setMutedIds(prev => { const n = new Set(prev); n.delete(targetId); return n; }); }
  }, [uid]);

  const unmuteUser = useCallback(async (targetId: string) => {
    if (!uid) return;
    setMutedIds(prev => { const n = new Set(prev); n.delete(targetId); return n; });
    try { await fsUnmute(uid, targetId); }
    catch { setMutedIds(prev => new Set([...prev, targetId])); }
  }, [uid]);

  const restrictUser = useCallback(async (targetId: string) => {
    if (!uid) return;
    setRestrictedIds(prev => new Set([...prev, targetId]));
    try { await fsRestrict(uid, targetId); }
    catch { setRestrictedIds(prev => { const n = new Set(prev); n.delete(targetId); return n; }); }
  }, [uid]);

  const unrestrictUser = useCallback(async (targetId: string) => {
    if (!uid) return;
    setRestrictedIds(prev => { const n = new Set(prev); n.delete(targetId); return n; });
    try { await fsUnrestrict(uid, targetId); }
    catch { setRestrictedIds(prev => new Set([...prev, targetId])); }
  }, [uid]);

  const updateSafetySettings = useCallback(async (s: Partial<SafetySettings>) => {
    setSafetySettings(prev => ({ ...prev, ...s }));
    if (uid) await fsUpdateSettings(uid, s);
  }, [uid]);

  const isBlocked    = useCallback((id: string) => blockedIds.has(id),    [blockedIds]);
  const isBlockedBy  = useCallback((id: string) => blockedByIds.has(id),  [blockedByIds]);
  const isMuted      = useCallback((id: string) => mutedIds.has(id),      [mutedIds]);
  const isRestricted = useCallback((id: string) => restrictedIds.has(id), [restrictedIds]);
  const canInteract  = useCallback(
    (id: string) => !blockedIds.has(id) && !blockedByIds.has(id),
    [blockedIds, blockedByIds],
  );

  return (
    <SafetyContext.Provider value={{
      blockedIds, blockedByIds, mutedIds, restrictedIds, safetySettings,
      blockUser, unblockUser, muteUser, unmuteUser, restrictUser, unrestrictUser,
      updateSafetySettings,
      isBlocked, isBlockedBy, isMuted, isRestricted, canInteract,
    }}>
      {children}
    </SafetyContext.Provider>
  );
}

export function useSafety(): SafetyContextValue {
  const ctx = useContext(SafetyContext);
  if (!ctx) throw new Error('useSafety must be used inside <SafetyProvider>');
  return ctx;
}
