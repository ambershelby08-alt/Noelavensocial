import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { isFirebaseConfigured } from '@/lib/firebase';
import { subscribeConversations, getOrCreateDirectConversation, getUserDoc, searchUsers as fsSearchUsers } from '@/lib/firestore';
import { mockConversations, mockUsers } from '@/lib/mockData';
import type { Conversation, User } from '@/lib/mockData';

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
    // Fetch all users with an empty search (returns up to 20), then filter self out
    fsSearchUsers('').then(users => setAllUsers(users.filter(u => u.id !== currentUser.id))).catch(console.error);
  }, [currentUser?.id]);

  useEffect(() => {
    if (!isFirebaseConfigured || !currentUser) { setIsLoading(false); return; }
    setIsLoading(true);
    const unsub = subscribeConversations(currentUser.id, convs => {
      setConversations(convs);
      setIsLoading(false);
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
    // Firebase mode: use pre-loaded allUsers; fall back to conversation participants
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

  return { conversations, isLoading, openDirectConversation, getComposeUsers };
}
