import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { isFirebaseConfigured } from '@/lib/firebase';
import { subscribeNotifications, markAllNotificationsRead } from '@/lib/firestore';
import { mockNotifications } from '@/lib/mockData';
import type { Notification } from '@/lib/mockData';

export function useNotifications() {
  const { currentUser } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>(
    isFirebaseConfigured ? [] : mockNotifications
  );
  const [isLoading, setIsLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured || !currentUser) { setIsLoading(false); return; }
    setIsLoading(true);
    const unsub = subscribeNotifications(currentUser.id, notifs => {
      setNotifications(notifs);
      setIsLoading(false);
    });
    return unsub;
  }, [currentUser?.id]);

  const markAllRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    if (isFirebaseConfigured && currentUser) {
      await markAllNotificationsRead(currentUser.id).catch(console.error);
    }
  }, [currentUser]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return { notifications, isLoading, markAllRead, unreadCount };
}
