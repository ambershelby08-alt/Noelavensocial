import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { isFirebaseConfigured } from '@/lib/firebase';
import {
  subscribeConversations,
  getOrCreateDirectConversation,
  getUserDoc,
  searchUsers as fsSearchUsers,
  getAllUsers as fsGetAllUsers,
  pinConversation as fsPin,
  archiveConversation as fsArchive,
  muteConversation as fsMute,
} from '@/lib/firestore';
import { mockConversations, mockUsers } from '@/lib/mockData';
import type { Conversation, User } from '@/lib/mockData';
import { cacheConversations, readCachedConversations } from '@/lib/msgCache';

export function useConversations() {
  const { currentUser } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>(
    isFirebaseConfigured ? [] : mockConversations
  );
  const [isLoading, setIsLoading] = useState(isFirebaseConfigured);
  const [allUsers, setAllUsers] = useState<User[]>([]);

  // Pre-load all users for the ComposeDrawer in Firebase mode
  useEffect(() => {
    if (!isFirebaseConfigured || !currentUser) return;
    fsGetAllUsers().then(users => setAllUsers(users.filter(u => u.id !== currentUser.id))).catch(console.error);
  }, [currentUser?.id]);

  useEffect(() => {
    if (!isFirebaseConfigured || !currentUser) { setIsLoading(false); return; }

    // ── Cache seed: render conversations immediately, hide spinner if we have them ──
    const cached = readCachedConversations(currentUser.id);
    if (cached && cached.length > 0) {
      setConversations(cached);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    // ── Live subscription: patches in fresh data and refreshes the cache ──
    const unsub = subscribeConversations(currentUser.id, convs => {
      setConversations(convs);
      setIsLoading(false);
      cacheConversations(currentUser.id, convs);
    });
    return unsub;
  }, [currentUser?.id]);

  /** Open or create a direct conversation with another user. Returns the convId. */
  const openDirectConversation = useCallback(async (otherUserId: string): Promise<string | null> => {
    if (!currentUser) return null;

    if (!isFirebaseConfigured) {
      const existing = mockConversations.find(c =>
        c.type === 'direct' && c.participants.some(p => p.id === otherUserId)
      );
      return existing?.id ?? 'conv-1';
    }

    try {
      const otherUser = await getUserDoc(otherUserId);
      if (!otherUser) return null;
      return await getOrCreateDirectConversation(currentUser.id, otherUserId, currentUser, otherUser);
    } catch {
      return null;
    }
  }, [currentUser]);

  /** Return users available to message in the ComposeDrawer. */
  const getComposeUsers = useCallback((): User[] => {
    if (!isFirebaseConfigured) {
      return mockUsers.filter(u => u.id !== currentUser?.id);
    }
    if (allUsers.length > 0) return allUsers;
    const seen = new Set<string>();
    return conversations
      .flatMap(c => c.participants)
      .filter(p => {
        if (p.id === currentUser?.id || seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });
  }, [allUsers, conversations, currentUser?.id]);

  const pinConversation = useCallback(async (convId: string, pin: boolean) => {
    if (!currentUser) return;
    if (!isFirebaseConfigured) {
      setConversations(prev => prev.map(c =>
        c.id === convId ? { ...c, pinnedBy: pin
          ? [...(c.pinnedBy ?? []), currentUser.id]
          : (c.pinnedBy ?? []).filter(id => id !== currentUser.id) } : c
      ));
      return;
    }
    await fsPin(convId, currentUser.id, pin);
  }, [currentUser]);

  const archiveConversation = useCallback(async (convId: string, archive: boolean) => {
    if (!currentUser) return;
    if (!isFirebaseConfigured) {
      setConversations(prev => prev.map(c =>
        c.id === convId ? { ...c, archivedBy: archive
          ? [...(c.archivedBy ?? []), currentUser.id]
          : (c.archivedBy ?? []).filter(id => id !== currentUser.id) } : c
      ));
      return;
    }
    await fsArchive(convId, currentUser.id, archive);
  }, [currentUser]);

  const muteConversation = useCallback(async (convId: string, mute: boolean) => {
    if (!currentUser) return;
    if (!isFirebaseConfigured) {
      setConversations(prev => prev.map(c =>
        c.id === convId ? { ...c, mutedBy: mute
          ? [...(c.mutedBy ?? []), currentUser.id]
          : (c.mutedBy ?? []).filter(id => id !== currentUser.id) } : c
      ));
      return;
    }
    await fsMute(convId, currentUser.id, mute);
  }, [currentUser]);

  return {
    conversations,
    isLoading,
    openDirectConversation,
    getComposeUsers,
    pinConversation,
    archiveConversation,
    muteConversation,
  };
}
