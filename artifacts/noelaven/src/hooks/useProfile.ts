import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { isFirebaseConfigured } from '@/lib/firebase';
import { getUserDoc, subscribeUserPosts } from '@/lib/firestore';
import { mockUsers, mockPosts } from '@/lib/mockData';
import type { User, Post } from '@/lib/mockData';

export function useProfile(userId: string | undefined) {
  const { currentUser } = useAuth();

  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const isOwn = !!userId && !!currentUser && currentUser.id === userId;

  useEffect(() => {
    if (!userId) { setIsLoading(false); return; }

    if (!isFirebaseConfigured) {
      // Demo mode: resolve from mock data
      const found = mockUsers.find(u => u.id === userId) ?? mockUsers[0];
      setUser(isOwn && currentUser ? currentUser : found);
      setPosts(mockPosts.filter(p => p.authorId === (isOwn ? currentUser?.id : found.id)));
      setIsLoading(false);
      return;
    }

    // Firebase mode
    setIsLoading(true);

    // If it's the current user's own profile, prefer the already-loaded currentUser
    if (isOwn && currentUser) {
      setUser(currentUser);
    } else {
      getUserDoc(userId).then(u => {
        setUser(u ?? null);
        setIsLoading(false);
      });
    }

    const unsub = subscribeUserPosts(userId, userPosts => {
      setPosts(userPosts);
      if (isOwn && currentUser) setIsLoading(false);
    });
    return unsub;
  }, [userId, currentUser?.id, isOwn]);

  // Keep own profile in sync with auth context
  useEffect(() => {
    if (isOwn && currentUser) setUser(currentUser);
  }, [currentUser, isOwn]);

  return { user, posts, isLoading };
}
