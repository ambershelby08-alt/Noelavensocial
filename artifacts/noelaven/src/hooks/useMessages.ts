import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { isFirebaseConfigured } from '@/lib/firebase';
import {
  subscribeMessages, subscribeConversation, markConversationRead,
  sendMessage as fsSend,
  editMessage as fsEdit,
  deleteMessageForMe as fsDeleteForMe,
  deleteMessageForEveryone as fsDeleteForEveryone,
  toggleMessageReaction as fsToggleReaction,
  setTypingStatus as fsSetTyping,
  subscribeTypingStatus as fsSubTyping,
  fetchOlderMessages as fsFetchOlder,
} from '@/lib/firestore';
import { mockConversations, mockMessages } from '@/lib/mockData';
import type { Message, Conversation } from '@/lib/mockData';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { cacheMessages, readCachedMessages } from '@/lib/msgCache';
// Note: subscribeMessages uses orderBy(createdAt, desc)+limit so new messages
// always fall inside the query window. fetchOlderMessages uses startAfter cursor.

interface SendOptions {
  replyToId?: string;
  replyToPreview?: Message['replyToPreview'];
  mediaUrl?: string;
  mediaType?: Message['mediaType'];
  voiceDuration?: number;
  voiceWaveformData?: number[];
  sharedPost?: Message['sharedPost'];
  forwardedFrom?: Message['forwardedFrom'];
}

export function useMessages(convId: string | undefined) {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [typingUserIds, setTypingUserIds] = useState<string[]>([]);
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  // Cursor pointing to the oldest loaded document — passed to fetchOlderMessages
  const oldestDocRef = useRef<QueryDocumentSnapshot | undefined>(undefined);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Subscriptions ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!convId) { setIsLoading(false); return; }

    if (!isFirebaseConfigured) {
      const conv = mockConversations.find(c => c.id === convId) ?? mockConversations[0];
      setConversation(conv ?? null);
      setMessages(mockMessages[convId] ?? []);
      setIsLoading(false);
      return;
    }

    // ── Cache seed: show stored messages instantly, skip spinner if we have them ──
    const cachedMsgs = currentUser ? readCachedMessages(currentUser.id, convId) : [];
    if (cachedMsgs.length > 0) {
      setMessages(cachedMsgs);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }
    let unsubConv: (() => void) | undefined;
    let unsubMsgs: (() => void) | undefined;
    let unsubTyping: (() => void) | undefined;

    subscribeConversation(convId, conv => {
      setConversation(conv);
    }, currentUser?.id).then(fn => { unsubConv = fn; });

    unsubMsgs = subscribeMessages(convId, (msgs, oldestDoc) => {
      setMessages(msgs);
      setIsLoading(false);
      // Persist to cache so next open is instant
      if (currentUser) cacheMessages(currentUser.id, convId, msgs);
      // oldestDoc is defined only when the page was full (≥50 msgs), meaning there may be older ones
      if (oldestDoc) {
        oldestDocRef.current = oldestDoc;
        setHasOlderMessages(true);
      } else {
        setHasOlderMessages(false);
      }
    });

    unsubTyping = fsSubTyping(convId, currentUser?.id ?? '', ids => {
      setTypingUserIds(ids);
    });

    if (currentUser) {
      markConversationRead(convId, currentUser.id).catch(console.error);
    }

    return () => {
      unsubConv?.();
      unsubMsgs?.();
      unsubTyping?.();
    };
  }, [convId, currentUser?.id]);

  // ─── Actions ──────────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (
    content: string,
    type: Message['type'] = 'text',
    opts: SendOptions = {}
  ) => {
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
        ...opts,
      };
      setMessages(prev => [...prev, newMsg]);
      return;
    }

    await fsSend(convId, currentUser.id, content, type, opts);
  }, [currentUser, convId]);

  const editMessage = useCallback(async (msgId: string, newContent: string) => {
    if (!convId) return;
    if (!isFirebaseConfigured) {
      setMessages(prev => prev.map(m =>
        m.id === msgId ? { ...m, editedContent: newContent, editedAt: new Date() } : m
      ));
      return;
    }
    await fsEdit(convId, msgId, newContent);
  }, [convId]);

  const deleteForMe = useCallback(async (msgId: string) => {
    if (!currentUser || !convId) return;
    if (!isFirebaseConfigured) {
      setMessages(prev => prev.map(m =>
        m.id === msgId ? { ...m, deletedFor: [...(m.deletedFor ?? []), currentUser.id] } : m
      ));
      return;
    }
    await fsDeleteForMe(convId, msgId, currentUser.id);
  }, [currentUser, convId]);

  const deleteForEveryone = useCallback(async (msgId: string) => {
    if (!convId) return;
    if (!isFirebaseConfigured) {
      setMessages(prev => prev.map(m =>
        m.id === msgId ? { ...m, deletedForEveryone: true } : m
      ));
      return;
    }
    await fsDeleteForEveryone(convId, msgId);
  }, [convId]);

  const toggleReaction = useCallback(async (msgId: string, emoji: string) => {
    if (!currentUser || !convId) return;
    if (!isFirebaseConfigured) {
      setMessages(prev => prev.map(m => {
        if (m.id !== msgId) return m;
        const reactions = { ...m.reactions };
        const users = reactions[emoji] ?? [];
        if (users.includes(currentUser.id)) {
          const next = users.filter(u => u !== currentUser.id);
          if (next.length === 0) delete reactions[emoji];
          else reactions[emoji] = next;
        } else {
          reactions[emoji] = [...users, currentUser.id];
        }
        return { ...m, reactions };
      }));
      return;
    }
    await fsToggleReaction(convId, msgId, currentUser.id, emoji);
  }, [currentUser, convId]);

  /** Debounced typing indicator — call on every keystroke */
  const notifyTyping = useCallback(() => {
    if (!convId || !currentUser || !isFirebaseConfigured) return;
    fsSetTyping(convId, currentUser.id, true).catch(() => {});
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      fsSetTyping(convId!, currentUser!.id, false).catch(() => {});
    }, 4000);
  }, [convId, currentUser]);

  const stopTyping = useCallback(() => {
    if (!convId || !currentUser || !isFirebaseConfigured) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    fsSetTyping(convId, currentUser.id, false).catch(() => {});
  }, [convId, currentUser]);

  const loadOlderMessages = useCallback(async () => {
    if (!convId || !oldestDocRef.current || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const { messages: older, oldestDoc } = await fsFetchOlder(convId, oldestDocRef.current);
      if (older.length > 0) {
        // older is already in asc order; prepend to existing list
        setMessages(prev => [...older, ...prev]);
      }
      // Update cursor — if no new oldestDoc, we've exhausted history
      if (oldestDoc) {
        oldestDocRef.current = oldestDoc;
      } else {
        oldestDocRef.current = undefined;
        setHasOlderMessages(false);
      }
    } finally {
      setLoadingOlder(false);
    }
  }, [convId, loadingOlder]);

  return {
    messages,
    conversation,
    isLoading,
    typingUserIds,
    hasOlderMessages,
    loadingOlder,
    sendMessage,
    editMessage,
    deleteForMe,
    deleteForEveryone,
    toggleReaction,
    notifyTyping,
    stopTyping,
    loadOlderMessages,
  };
}
