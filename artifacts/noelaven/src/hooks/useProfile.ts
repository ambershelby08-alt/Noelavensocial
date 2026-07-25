import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { isFirebaseConfigured } from '@/lib/firebase';
import { getUserDoc, subscribeUserPosts, subscribeLikedPosts, subscribeSavedPosts } from '@/lib/firestore';
import { mockUsers, mockPosts } from '@/lib/mockData';
import type { User, Post } from '@/lib/mockData';

export function useProfile(userId: string | undefined) {
  const { currentUser } = useAuth();

  const [user, setUser] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [likedPosts, setLikedPosts] = useState<Post[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const isOwn = !!userId && !!currentUser && currentUser.id === userId;

  useEffect(() => {
    if (!userId) { setIsLoading(false); return; }

    if (!isFirebaseConfigured) {
      // Demo mode: resolve from mock data
      const found = mockUsers.find(u => u.id === userId) ?? mockUsers[0];
      setUser(isOwn && currentUser ? currentUser : found);
      setPosts(mockPosts.filter(p => p.authorId === (isOwn ? currentUser?.id : found.id)));
      setLikedPosts(isOwn ? mockPosts.filter(p => p.liked) : []);
      setSavedPosts(isOwn ? mockPosts.filter(p => p.saved) : []);
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

  // ── Liked & Saved posts — own profile only ────────────────────────────────
  // These read from user-private Firestore subcollections, not from the
  // posts feed. Subscriptions start only for the current user's own profile
  // so we never expose another account's liked/saved data.
  useEffect(() => {
    if (!isOwn || !userId || !currentUser || !isFirebaseConfigured) {
      setLikedPosts([]);
      setSavedPosts([]);
      return;
    }

    const unsubLiked = subscribeLikedPosts(userId, currentUser.id, setLikedPosts);
    const unsubSaved = subscribeSavedPosts(userId, currentUser.id, setSavedPosts);
    return () => { unsubLiked(); unsubSaved(); };
  }, [userId, currentUser?.id, isOwn]);

  return { user, posts, likedPosts, savedPosts, isLoading };
}
