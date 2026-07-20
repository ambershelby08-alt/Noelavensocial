import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { isFirebaseConfigured } from '@/lib/firebase';
import { subscribeConversations, getOrCreateDirectConversation, getUserDoc } from '@/lib/firestore';
import { mockConversations, mockUsers } from '@/lib/mockData';
import type { Conversation, User } from '@/lib/mockData';

export function useConversations() {
  const { currentUser } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>(
    isFirebaseConfigured ? [] : mockConversations
  );
  const [isLoading, setIsLoading] = useState(isFirebaseConfigured);

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

  /** Search local users to compose a new message. */
  const getComposeUsers = useCallback((): User[] => {
    if (!isFirebaseConfigured) {
      return mockUsers.filter(u => u.id !== currentUser?.id);
    }
    // In Firebase mode we search from conversations participants for now
    const seen = new Set<string>();
    const users: User[] = [];
    conversations.forEach(c => {
      c.participants.forEach(p => {
        if (p.id !== currentUser?.id && !seen.has(p.id)) {
          seen.add(p.id);
          users.push(p);
        }
      });
    });
    return users;
  }, [conversations, currentUser?.id]);

  return { conversations, isLoading, openDirectConversation, getComposeUsers };
}
