/**
 * useSparkCommunity — fetches today's community Daily Spark responses.
 * In Firebase mode: live Firestore query (posts matching today's prompt).
 * In demo mode:     returns static demo posts with the prompt injected.
 */
import { useState, useEffect } from 'react';
import { isFirebaseConfigured } from '@/lib/firebase';
import { subscribeCommunitySparkPosts } from '@/lib/firestore';
import { mockUsers } from '@/lib/mockData';
import type { Post } from '@/lib/mockData';

export type CommunitySort = 'friends' | 'following' | 'everyone';

// ── Demo community posts ───────────────────────────────────────────────────
function demoCommunityPosts(prompt: string): Post[] {
  const now = new Date();
  return [
    {
      id: 'spark-demo-1',
      authorId: 'user-1',
      author: mockUsers[0],
      content: 'This prompt really made me think! I believe small moments of kindness ripple out in ways we can never fully measure. 🌊',
      sparkPrompt: prompt,
      sparkAudience: 'public',
      likes: 47,
      comments: 9,
      shares: 3,
      liked: false,
      saved: false,
      createdAt: new Date(now.getTime() - 3600000 * 1),
    },
    {
      id: 'spark-demo-2',
      authorId: 'user-2',
      author: mockUsers[1],
      content: 'Honestly? The best answer I can give is: my morning coffee. 😂 Simple pleasures are everything.',
      sparkPrompt: prompt,
      sparkAudience: 'public',
      likes: 31,
      comments: 4,
      shares: 1,
      liked: true,
      saved: false,
      createdAt: new Date(now.getTime() - 3600000 * 2),
    },
    {
      id: 'spark-demo-3',
      authorId: 'user-4',
      author: mockUsers[3],
      content: 'That question caught me off guard. I sat with it for a while and realised how much I\'ve been taking the little things for granted.',
      imageUrl: 'https://picsum.photos/600/400?random=77',
      sparkPrompt: prompt,
      sparkAudience: 'public',
      likes: 88,
      comments: 15,
      shares: 6,
      liked: false,
      saved: false,
      createdAt: new Date(now.getTime() - 3600000 * 3),
    },
    {
      id: 'spark-demo-4',
      authorId: 'user-5',
      author: mockUsers[4],
      content: 'I always come back to the idea that connection is everything. Whether it\'s with people, nature, or a really good book. ✨',
      sparkPrompt: prompt,
      sparkAudience: 'public',
      likes: 124,
      comments: 22,
      shares: 11,
      liked: false,
      saved: false,
      createdAt: new Date(now.getTime() - 3600000 * 4),
    },
  ];
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSparkCommunity(prompt: string, enabled: boolean) {
  const [posts, setPosts]     = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || !prompt) {
      setPosts([]);
      return;
    }

    if (!isFirebaseConfigured) {
      setPosts(demoCommunityPosts(prompt));
      return;
    }

    setLoading(true);
    const unsub = subscribeCommunitySparkPosts(prompt, (incoming) => {
      setPosts(incoming);
      setLoading(false);
    });
    return unsub;
  }, [prompt, enabled]);

  return { posts, loading };
}
