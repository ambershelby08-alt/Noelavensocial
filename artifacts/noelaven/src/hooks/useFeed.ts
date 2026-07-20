import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { isFirebaseConfigured } from '@/lib/firebase';
import { subscribeFeed, createPost as fsCreatePost, togglePostLike, togglePostSave } from '@/lib/firestore';
import { mockPosts } from '@/lib/mockData';
import type { Post } from '@/lib/mockData';

export function useFeed() {
  const { currentUser } = useAuth();
  const [posts, setPosts] = useState<Post[]>(isFirebaseConfigured ? [] : mockPosts);
  const [isLoading, setIsLoading] = useState(isFirebaseConfigured);

  useEffect(() => {
    if (!isFirebaseConfigured || !currentUser) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const unsub = subscribeFeed(newPosts => {
      setPosts(newPosts);
      setIsLoading(false);
    }, currentUser.id);
    return unsub;
  }, [currentUser?.id]);

  const addPost = useCallback(async (
    content: string,
    opts?: { imageUrl?: string; mood?: string; communityId?: string }
  ) => {
    if (!currentUser) return;
    if (!isFirebaseConfigured) {
      const newPost: Post = {
        id: `post-${Date.now()}`,
        authorId: currentUser.id,
        author: currentUser,
        content,
        likes: 0, comments: 0, shares: 0,
        liked: false, saved: false,
        mood: opts?.mood,
        imageUrl: opts?.imageUrl,
        communityId: opts?.communityId,
        createdAt: new Date(),
      };
      setPosts(prev => [newPost, ...prev]);
      return;
    }
    await fsCreatePost(currentUser, content, opts);
    // onSnapshot will update posts automatically
  }, [currentUser]);

  const toggleLike = useCallback(async (postId: string, currentlyLiked: boolean) => {
    if (!currentUser) return;
    // Optimistic update
    setPosts(prev => prev.map(p =>
      p.id === postId
        ? { ...p, liked: !currentlyLiked, likes: currentlyLiked ? p.likes - 1 : p.likes + 1 }
        : p
    ));
    if (isFirebaseConfigured) {
      try {
        await togglePostLike(postId, currentUser.id, currentlyLiked);
      } catch {
        // Revert on error
        setPosts(prev => prev.map(p =>
          p.id === postId
            ? { ...p, liked: currentlyLiked, likes: currentlyLiked ? p.likes + 1 : p.likes - 1 }
            : p
        ));
      }
    }
  }, [currentUser]);

  const toggleSave = useCallback(async (postId: string, currentlySaved: boolean) => {
    if (!currentUser) return;
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, saved: !currentlySaved } : p));
    if (isFirebaseConfigured) {
      try {
        await togglePostSave(postId, currentUser.id, currentlySaved);
      } catch {
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, saved: currentlySaved } : p));
      }
    }
  }, [currentUser]);

  return { posts, isLoading, addPost, toggleLike, toggleSave };
}
