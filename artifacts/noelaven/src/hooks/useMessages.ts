import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { isFirebaseConfigured } from '@/lib/firebase';
import {
  subscribeMessages, subscribeConversation, markConversationRead,
  clearMessageNotificationsForConv,
  sendMessage as fsSend,
  editMessage as fsEdit,
  deleteMessageForMe as fsDeleteForMe,
  deleteMessageForEveryone as fsDeleteForEveryone,
  toggleMessageReaction as fsToggleReaction,
  setTypingStatus as fsSetTyping,
  subscribeTypingStatus as fsSubTyping,
  fetchOlderMessages as fsFetchOlder,
  logFsError,
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
  /**
   * Surface Firestore subscription errors (permission denied, offline, etc.)
   * to the Chat UI instead of the Vite runtime-error overlay.
   * Cleared automatically when convId changes.
   */
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null);
  const clearSubscriptionError = useCallback(() => setSubscriptionError(null), []);

  /**
   * Surface message action errors (reaction toggle, edit, delete) so the user
   * sees a friendly dismissable error instead of a silent revert or overlay.
   */
  const [messageActionError, setMessageActionError] = useState<string | null>(null);
  const clearMessageActionError = useCallback(() => setMessageActionError(null), []);
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
    let mounted = true;
    let unsubConv: (() => void) | undefined;
    let unsubMsgs: (() => void) | undefined;
    let unsubTyping: (() => void) | undefined;

    // Clear any previous subscription error when opening a new conversation.
    setSubscriptionError(null);

    // ── Error handler shared by all subscriptions ─────────────────────────────
    // Firebase strips the stack from server-side permission errors, so we log
    // the operation name + convId + code from logFsError (inside firestore.ts)
    // and also surface a friendly message in the Chat UI via subscriptionError.
    function handleSubError(op: string) {
      return (err: { code: string; message: string }) => {
        // 'permission-denied' is the most common case — usually a rules misconfiguration
        // or a race condition where the conversation is being created. Log it with full
        // context so developers can trace the exact operation and conversation.
        logFsError(op, err, { convId });
        if (err.code === 'permission-denied') {
          setSubscriptionError(
            'You don\'t have permission to read this conversation. ' +
            `(${op}: ${err.code})`
          );
        } else {
          setSubscriptionError(`Failed to load messages. (${op}: ${err.code})`);
        }
      };
    }

    // subscribeConversation is async — store the unsub once resolved, but if
    // the component unmounts before the Promise resolves, unsubscribe immediately.
    subscribeConversation(convId, conv => {
      setConversation(conv);
    }, currentUser?.id, handleSubError('subscribeConversation')).then(fn => {
      if (mounted) {
        unsubConv = fn;
      } else {
        fn(); // component already unmounted — tear down the listener immediately
      }
    }).catch(err => logFsError('subscribeConversation:promise', err, { convId }));

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
    }, 50, handleSubError('subscribeMessages'));

    unsubTyping = fsSubTyping(convId, currentUser?.id ?? '', ids => {
      setTypingUserIds(ids);
    }, handleSubError('subscribeTypingStatus'));

    if (currentUser) {
      markConversationRead(convId, currentUser.id).catch(err =>
        logFsError('markConversationRead', err, { convId, userId: currentUser.id })
      );
      // Also clear any unread message-type notifications for this conversation
      clearMessageNotificationsForConv(convId, currentUser.id).catch(err =>
        logFsError('clearMessageNotificationsForConv', err, { convId, userId: currentUser.id })
      );
    }

    return () => {
      mounted = false;
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

    await fsSend(convId, currentUser.id, content, type, opts, currentUser);
    // Push notification stub — wired for future FCM integration
    const recipientIds = opts.forwardedFrom
      ? [] // forwarded — conversations handle their own participants
      : [];
    void recipientIds; // placeholder; FCM hook goes here
    console.debug('[push-stub] schedulePushNotification', { convId, type, contentPreview: content.slice(0, 60) });
  }, [currentUser, convId]);

  const editMessage = useCallback(async (msgId: string, newContent: string) => {
    if (!convId) return;
    if (!isFirebaseConfigured) {
      setMessages(prev => prev.map(m =>
        m.id === msgId ? { ...m, editedContent: newContent, editedAt: new Date() } : m
      ));
      return;
    }
    try {
      await fsEdit(convId, msgId, newContent);
    } catch (err) {
      logFsError('editMessage', err, { convId, msgId });
      const code = (err as { code?: string })?.code ?? '';
      setMessageActionError(
        code === 'permission-denied'
          ? 'Edit failed — you can only edit your own messages.'
          : `Edit failed. (${code || 'unknown error'})`
      );
      throw err; // let doSaveEdit in Chat.tsx know it failed
    }
  }, [convId]);

  const deleteForMe = useCallback(async (msgId: string) => {
    if (!currentUser || !convId) return;
    if (!isFirebaseConfigured) {
      setMessages(prev => prev.map(m =>
        m.id === msgId ? { ...m, deletedFor: [...(m.deletedFor ?? []), currentUser.id] } : m
      ));
      return;
    }
    try {
      await fsDeleteForMe(convId, msgId, currentUser.id);
      // Patch local state + cache immediately so navigating away before the
      // Firestore subscription fires never flashes the deleted message.
      const uid = currentUser.id;
      setMessages(prev => {
        const updated = prev.map(m =>
          m.id === msgId ? { ...m, deletedFor: [...(m.deletedFor ?? []), uid] } : m
        );
        cacheMessages(uid, convId, updated);
        return updated;
      });
    } catch (err) {
      logFsError('deleteMessageForMe', err, { convId, msgId, userId: currentUser.id });
      const code = (err as { code?: string })?.code ?? '';
      setMessageActionError(`Couldn't delete message. (${code || 'unknown error'})`);
      throw err;
    }
  }, [currentUser, convId]);

  const deleteForEveryone = useCallback(async (msgId: string) => {
    if (!convId) return;
    if (!isFirebaseConfigured) {
      setMessages(prev => prev.map(m =>
        m.id === msgId ? { ...m, deletedForEveryone: true } : m
      ));
      return;
    }
    try {
      await fsDeleteForEveryone(convId, msgId);
      // Patch local state + cache immediately — same reason as deleteForMe above.
      if (currentUser) {
        const uid = currentUser.id;
        setMessages(prev => {
          const updated = prev.map(m =>
            m.id === msgId
              ? { ...m, deletedForEveryone: true, mediaUrl: undefined, editedContent: undefined }
              : m
          );
          cacheMessages(uid, convId, updated);
          return updated;
        });
      }
    } catch (err) {
      logFsError('deleteMessageForEveryone', err, { convId, msgId });
      const code = (err as { code?: string })?.code ?? '';
      setMessageActionError(
        code === 'permission-denied'
          ? 'Delete failed — you can only delete your own messages for everyone.'
          : `Couldn't delete message. (${code || 'unknown error'})`
      );
      throw err;
    }
  }, [currentUser, convId]);

  // Shared helper — applies one "toggle" of emoji for userId on a messages array.
  // Calling it twice (optimistic + revert) returns to the original state.
  function applyReactionToggle(
    prev: Message[],
    msgId: string,
    userId: string,
    emoji: string
  ): Message[] {
    return prev.map(m => {
      if (m.id !== msgId) return m;
      const reactions = { ...m.reactions };
      const users = reactions[emoji] ?? [];
      if (users.includes(userId)) {
        const next = users.filter(u => u !== userId);
        if (next.length === 0) delete reactions[emoji];
        else reactions[emoji] = next;
      } else {
        reactions[emoji] = [...users, userId];
      }
      return { ...m, reactions };
    });
  }

  const toggleReaction = useCallback(async (msgId: string, emoji: string) => {
    if (!currentUser || !convId) return;

    // Optimistic update — applied for both demo and Firebase paths so the UI
    // feels instant. The real-time subscription will reconcile if the write succeeds.
    setMessages(prev => applyReactionToggle(prev, msgId, currentUser.id, emoji));

    if (!isFirebaseConfigured) return;
    try {
      await fsToggleReaction(convId, msgId, currentUser.id, emoji);
    } catch (err) {
      logFsError('toggleMessageReaction', err, { convId, msgId, userId: currentUser.id, emoji });
      // Revert the optimistic update — toggling twice is the identity operation.
      setMessages(prev => applyReactionToggle(prev, msgId, currentUser.id, emoji));
      const code = (err as { code?: string })?.code ?? '';
      setMessageActionError(
        code === 'permission-denied'
          ? 'Reaction failed — you don\'t have permission to react to this message.'
          : `Reaction failed. (${code || 'unknown error'})`
      );
    }
  }, [currentUser, convId]);

  /** Debounced typing indicator — call on every keystroke */
  const notifyTyping = useCallback(() => {
    if (!convId || !currentUser || !isFirebaseConfigured) return;
    // Typing indicator is cosmetic — errors are logged inside setTypingStatus
    // (via logFsError) and must never propagate as unhandled rejections.
    void fsSetTyping(convId, currentUser.id, true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      void fsSetTyping(convId!, currentUser!.id, false);
    }, 4000);
  }, [convId, currentUser]);

  const stopTyping = useCallback(() => {
    if (!convId || !currentUser || !isFirebaseConfigured) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    void fsSetTyping(convId, currentUser.id, false);
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
    /** Non-null when a Firestore subscription failed (permission denied, offline, etc).
     *  Cleared automatically when convId changes; also clearable by the UI. */
    subscriptionError,
    clearSubscriptionError,
    /** Non-null when a message action (reaction, edit, delete) failed.
     *  Does NOT clear automatically — must be dismissed by the user. */
    messageActionError,
    clearMessageActionError,
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
