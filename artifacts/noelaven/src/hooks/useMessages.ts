import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { isFirebaseConfigured } from '@/lib/firebase';
import { subscribeMessages, sendMessage as fsSend, subscribeConversation } from '@/lib/firestore';
import { mockConversations, mockMessages } from '@/lib/mockData';
import type { Message, Conversation } from '@/lib/mockData';

export function useMessages(convId: string | undefined) {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!convId) { setIsLoading(false); return; }

    if (!isFirebaseConfigured) {
      const conv = mockConversations.find(c => c.id === convId) ?? mockConversations[0];
      setConversation(conv);
      setMessages(mockMessages[convId] ?? []);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    let unsubConv: (() => void) | undefined;
    let unsubMsgs: (() => void) | undefined;

    // Subscribe to conversation doc
    subscribeConversation(convId, conv => {
      setConversation(conv);
    }, currentUser?.id).then(fn => { unsubConv = fn; });

    // Subscribe to messages subcollection
    unsubMsgs = subscribeMessages(convId, msgs => {
      setMessages(msgs);
      setIsLoading(false);
    });

    return () => {
      unsubConv?.();
      unsubMsgs?.();
    };
  }, [convId, currentUser?.id]);

  const sendMessage = useCallback(async (content: string, type: 'text' | 'image' | 'voice' = 'text') => {
    if (!currentUser || !convId) return;

    if (!isFirebaseConfigured) {
      const newMsg: Message = {
        id: `msg-${Date.now()}`,
        senderId: currentUser.id,
        content,
        type,
        reactions: {},
        readBy: [currentUser.id],
        createdAt: new Date(),
      };
      setMessages(prev => [...prev, newMsg]);
      return;
    }

    await fsSend(convId, currentUser.id, content, type);
    // onSnapshot updates messages automatically
  }, [currentUser, convId]);

  return { messages, conversation, isLoading, sendMessage };
}
