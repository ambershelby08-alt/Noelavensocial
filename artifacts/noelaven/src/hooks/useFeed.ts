import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { isFirebaseConfigured } from '@/lib/firebase';
import {
  subscribeFeed, createPost as fsCreatePost,
  togglePostReaction as fsTogglePostReaction,
  togglePostSave,
  deletePost as fsDeletePost, updatePost as fsUpdatePost,
  toggleCommentsDisabled as fsToggleCommentsDisabled,
} from '@/lib/firestore';
import { mockPosts } from '@/lib/mockData';
import type { Post } from '@/lib/mockData';

export function useFeed() {
  const { currentUser } = useAuth();
  const [posts, setPosts] = useState<Post[]>(
    isFirebaseConfigured
      ? []
      : mockPosts.map(p => ({ ...p, reactions: p.reactions ?? {}, myReaction: null }))
  );
  const [isLoading, setIsLoading] = useState(isFirebaseConfigured);
  // Ref so callbacks always see the latest posts without re-creating
  const postsRef = useRef<Post[]>(posts);
  useEffect(() => { postsRef.current = posts; }, [posts]);
  // Ref that always holds the current user — prevents stale closures in
  // async callbacks that were dispatched before an account switch completed.
  // Callbacks read currentUserRef.current at execution time, not at the time
  // they were created, so they always act on behalf of the right account.
  const currentUserRef = useRef(currentUser);
  useEffect(() => { currentUserRef.current = currentUser; }, [currentUser]);
  // Guard against rapid double-taps: track which posts have a reaction in-flight
  const pendingReactions = useRef<Set<string>>(new Set());

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
    opts?: {
      imageUrl?: string; mood?: string; communityId?: string;
      sparkPrompt?: string; sparkAudience?: string; postAudience?: string;
      mentions?: string[];
      location?: { name: string; lat?: number; lng?: number };
    }
  ): Promise<string | undefined> => {
    if (!currentUser) return undefined;
    if (!isFirebaseConfigured) {
      const id = `post-${Date.now()}`;
      const newPost: Post = {
        id,
        authorId: currentUser.id,
        author: currentUser,
        content,
        likes: 0, comments: 0, shares: 0,
        liked: false, saved: false,
        reactions: {}, myReaction: null,
        mood: opts?.mood,
        imageUrl: opts?.imageUrl,
        communityId: opts?.communityId,
        sparkPrompt: opts?.sparkPrompt,
        sparkAudience: opts?.sparkAudience as Post['sparkAudience'],
        postAudience: (opts?.postAudience ?? 'public') as Post['postAudience'],
        mentions: opts?.mentions,
        location: opts?.location ?? null,
        createdAt: new Date(),
      };
      setPosts(prev => [newPost, ...prev]);
      return id;
    }
    const postId = await fsCreatePost(currentUser, content, opts);
    return postId;
  }, [currentUser]);

  /**
   * Toggle a Noelaven reaction on a post with optimistic update.
   * Same emoji = toggle off; different emoji = switch; new = add.
   */
  const toggleReaction = useCallback(async (postId: string, emoji: string) => {
    // Read from ref so that if the account switched while a reaction was
    // being submitted, we abort rather than writing under the wrong UID.
    const user = currentUserRef.current;
    if (!user) return;
    if (pendingReactions.current.has(postId)) return; // debounce rapid taps
    const post = postsRef.current.find(p => p.id === postId);
    if (!post) return;

    const prevEmoji  = post.myReaction ?? null;
    const toggledOff = prevEmoji === emoji;
    const nextEmoji  = toggledOff ? null : emoji;

    // Optimistic update
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      const newReactions: Record<string, string[]> = {};
      for (const [e, users] of Object.entries(p.reactions ?? {})) {
        newReactions[e] = [...users];
      }
      // Remove from previous emoji
      if (prevEmoji && newReactions[prevEmoji]) {
        newReactions[prevEmoji] = newReactions[prevEmoji].filter(id => id !== user.id);
      }
      // Add to new emoji (unless toggling off)
      if (!toggledOff) {
        newReactions[emoji] = [
          ...(newReactions[emoji] ?? []).filter(id => id !== user.id),
          user.id,
        ];
      }
      const newTotal = Object.values(newReactions).reduce((n, arr) => n + arr.length, 0);
      return {
        ...p,
        reactions: newReactions,
        myReaction: nextEmoji,
        likes: newTotal,
        liked: nextEmoji !== null,
      };
    }));

    if (isFirebaseConfigured) {
      pendingReactions.current.add(postId);
      try {
        await fsTogglePostReaction(postId, user.id, emoji, user);
      } catch {
        // Revert on error
        setPosts(prev => prev.map(p =>
          p.id === postId
            ? { ...p, reactions: post.reactions, myReaction: post.myReaction, likes: post.likes, liked: post.liked }
            : p
        ));
      } finally {
        pendingReactions.current.delete(postId);
      }
    }
  }, []);

  // Legacy alias — toggling 🌊 Vibe is equivalent to the old "like"
  const toggleLike = useCallback(async (_postId: string, _currentlyLiked: boolean) => {
    await toggleReaction(_postId, '🌊');
  }, [toggleReaction]);

  const toggleSave = useCallback(async (postId: string, currentlySaved: boolean) => {
    const user = currentUserRef.current;
    if (!user) return;
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, saved: !currentlySaved } : p));
    if (isFirebaseConfigured) {
      try {
        await togglePostSave(postId, user.id, currentlySaved);
      } catch {
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, saved: currentlySaved } : p));
      }
    }
  }, []);

  const deletePost = useCallback(async (postId: string) => {
    const user = currentUserRef.current;
    if (!user) return;
    setPosts(prev => prev.filter(p => p.id !== postId));
    if (isFirebaseConfigured) {
      fsDeletePost(postId, user.id).catch(console.error);
    }
  }, []);

  const updatePost = useCallback(async (postId: string, content: string, imageUrl?: string | null) => {
    setPosts(prev => prev.map(p =>
      p.id === postId
        ? { ...p, content, imageUrl: imageUrl === null ? undefined : (imageUrl ?? p.imageUrl) }
        : p
    ));
    if (isFirebaseConfigured) {
      fsUpdatePost(postId, { content, imageUrl }).catch(console.error);
    }
  }, []);

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

  return {
    posts, isLoading,
    addPost, toggleReaction, toggleLike, toggleSave,
    deletePost, updatePost, hidePost, toggleCommentsDisabled,
  };
}
