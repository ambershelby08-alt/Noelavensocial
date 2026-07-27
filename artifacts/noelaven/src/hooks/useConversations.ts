import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { isFirebaseConfigured } from '@/lib/firebase';
import {
  subscribeConversations,
  getOrCreateDirectConversation,
  getUserDoc,
  searchUsers as fsSearchUsers,
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
  // Users the current user follows — the only people eligible to start a new DM.
  // We never fetch all Firebase users; that would expose every account.
  const [followingUsers, setFollowingUsers] = useState<User[]>([]);

  useEffect(() => {
    if (!isFirebaseConfigured || !currentUser) return;
    import('@/lib/firebase').then(({ db }) => {
      if (!db) return;
      import('firebase/firestore').then(({ getDocs, collection, query, limit, getDoc, doc }) => {
        getDocs(query(collection(db, `users/${currentUser.id}/following`), limit(200)))
          .then(async snap => {
            const ids = snap.docs.map(d => d.id).filter(id => id !== currentUser.id);
            if (ids.length === 0) { setFollowingUsers([]); return; }
            const userDocs = await Promise.all(ids.map(id => getDoc(doc(db, 'users', id))));
            setFollowingUsers(
              userDocs.filter(d => d.exists()).map(d => {
                const data = d.data()!;
                return {
                  id: d.id,
                  displayName: data.displayName ?? '',
                  handle:      data.handle      ?? '',
                  bio:         data.bio         ?? '',
                  avatarUrl:   data.avatarUrl   ?? '',
                  coverUrl:    data.coverUrl    ?? '',
                  interests:   data.interests   ?? [],
                  followers:   data.followers   ?? 0,
                  following:   data.following   ?? 0,
                  postCount:   data.postCount   ?? 0,
                  badges:      data.badges      ?? [],
                  joinedAt:    data.joinedAt?.toDate?.() ?? new Date(),
                } as User;
              })
            );
          })
          .catch(console.error);
      });
    });
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

  /** Return users available to message in the ComposeDrawer.
   *  Only shows: (1) existing conversation partners and (2) people you follow.
   *  Never fetches all Firebase accounts. */
  const getComposeUsers = useCallback((): User[] => {
    if (!isFirebaseConfigured) {
      return mockUsers.filter(u => u.id !== currentUser?.id);
    }
    const seen = new Set<string>();
    const fromConvs = conversations
      .flatMap(c => c.participants)
      .filter(p => {
        if (p.id === currentUser?.id || seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });
    const fromFollowing = followingUsers.filter(u => !seen.has(u.id));
    return [...fromConvs, ...fromFollowing];
  }, [followingUsers, conversations, currentUser?.id]);

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
