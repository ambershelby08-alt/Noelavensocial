import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { isFirebaseConfigured } from '@/lib/firebase';
import {
  subscribeFeed, createPost as fsCreatePost, togglePostLike, togglePostSave,
  deletePost as fsDeletePost, updatePost as fsUpdatePost,
  toggleCommentsDisabled as fsToggleCommentsDisabled,
} from '@/lib/firestore';
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
    opts?: { imageUrl?: string; mood?: string; communityId?: string; sparkPrompt?: string }
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
        sparkPrompt: opts?.sparkPrompt,
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

  const deletePost = useCallback(async (postId: string) => {
    if (!currentUser) return;
    // Optimistic: remove immediately
    setPosts(prev => prev.filter(p => p.id !== postId));
    if (isFirebaseConfigured) {
      fsDeletePost(postId, currentUser.id).catch(console.error);
    }
  }, [currentUser]);

  const updatePost = useCallback(async (postId: string, content: string, imageUrl?: string | null) => {
    // Optimistic update
    setPosts(prev => prev.map(p =>
      p.id === postId
        ? { ...p, content, imageUrl: imageUrl === null ? undefined : (imageUrl ?? p.imageUrl) }
        : p
    ));
    if (isFirebaseConfigured) {
      fsUpdatePost(postId, { content, imageUrl }).catch(console.error);
    }
  }, []);

  /** Remove a post from the local feed without deleting it globally (Hide post). */
  const hidePost = useCallback((postId: string) => {
    setPosts(prev => prev.filter(p => p.id !== postId));
  }, []);

  const toggleCommentsDisabled = useCallback(async (postId: string, currentlyDisabled: boolean) => {
    const next = !currentlyDisabled;
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, commentsDisabled: next } : p));
    if (isFirebaseConfigured) {
      fsToggleCommentsDisabled(postId, next).catch(console.error);
    }
  }, []);

  return { posts, isLoading, addPost, toggleLike, toggleSave, deletePost, updatePost, hidePost, toggleCommentsDisabled };
}
