/**
 * useDiscover — data layer for the Discover page.
 * Subscribes to public posts and derives trending/suggested content client-side.
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { isFirebaseConfigured } from '@/lib/firebase';
import { subscribeFeed, searchUsers as fsSearchUsers } from '@/lib/firestore';
import { mockPosts, mockUsers } from '@/lib/mockData';
import type { Post, User } from '@/lib/mockData';

const PAGE_SIZE = 20;

function extractHashtags(posts: Post[]): Array<{ tag: string; count: number }> {
  const counts: Record<string, number> = {};
  for (const p of posts) {
    for (const tag of (p.content.match(/#[\w]+/g) ?? [])) {
      const lower = tag.toLowerCase();
      counts[lower] = (counts[lower] ?? 0) + 1;
    }
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([tag, count]) => ({ tag, count }));
}

function extractSparks(posts: Post[]): Array<{ prompt: string; count: number }> {
  const counts: Record<string, number> = {};
  for (const p of posts) {
    if (p.sparkPrompt) counts[p.sparkPrompt] = (counts[p.sparkPrompt] ?? 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([prompt, count]) => ({ prompt, count }));
}

export function useDiscover(activeCategory = '') {
  const { currentUser } = useAuth();
  const [allPosts, setAllPosts] = useState<Post[]>(
    isFirebaseConfigured
      ? []
      : mockPosts.map(p => ({ ...p, reactions: p.reactions ?? {}, myReaction: null }))
  );
  const [loading, setLoading] = useState(isFirebaseConfigured);
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!isFirebaseConfigured) { setLoading(false); return; }
    setLoading(true);
    const unsub = subscribeFeed(posts => {
      setAllPosts(posts.filter(p => !p.sparkAudience || p.sparkAudience === 'public'));
      setLoading(false);
    }, currentUser?.id);
    return unsub;
  }, [currentUser?.id]);

  const filteredPosts = useMemo(() => {
    if (!activeCategory || activeCategory === 'for-you' || activeCategory === 'trending') {
      return allPosts;
    }
    return allPosts.filter(p => {
      const haystack = [p.content, ...(p.author.interests ?? []), p.mood ?? '', p.sparkPrompt ?? '']
        .join(' ').toLowerCase();
      return haystack.includes(activeCategory.replace(/-/g, ' '));
    });
  }, [allPosts, activeCategory]);

  const visiblePosts = filteredPosts.slice(0, page * PAGE_SIZE);
  const hasMore = filteredPosts.length > page * PAGE_SIZE;
  const loadMore = useCallback(() => { if (hasMore) setPage(p => p + 1); }, [hasMore]);
  useEffect(() => { setPage(1); }, [activeCategory]);

  const trendingPosts = useMemo(
    () => [...filteredPosts]
      .sort((a, b) => (b.likes + b.comments * 1.5) - (a.likes + a.comments * 1.5))
      .slice(0, 24),
    [filteredPosts]
  );

  const trendingHashtags = useMemo(() => extractHashtags(allPosts), [allPosts]);
  const trendingSparks   = useMemo(() => extractSparks(allPosts),   [allPosts]);

  const suggestedCreators: User[] = useMemo(
    () => (isFirebaseConfigured ? [] : mockUsers)
      .filter(u => u.id !== currentUser?.id)
      .sort((a, b) => b.followers - a.followers),
    [currentUser?.id]
  );

  async function search(query: string): Promise<{
    users: User[]; posts: Post[]; hashtags: string[];
  }> {
    const q = query.toLowerCase().trim();
    if (!q) return { users: [], posts: [], hashtags: [] };

    const users = await (
      isFirebaseConfigured
        ? fsSearchUsers(q).then(r => r.filter(u => u.id !== currentUser?.id).slice(0, 8))
        : Promise.resolve(
            mockUsers
              .filter(u => u.id !== currentUser?.id &&
                (u.displayName.toLowerCase().includes(q) ||
                 u.handle.toLowerCase().includes(q) ||
                 (u.bio ?? '').toLowerCase().includes(q)))
              .slice(0, 6)
          )
    );

    const posts = allPosts
      .filter(p =>
        p.content.toLowerCase().includes(q) ||
        (p.sparkPrompt ?? '').toLowerCase().includes(q) ||
        p.author.displayName.toLowerCase().includes(q)
      )
      .slice(0, 6);

    const hashtags = [...new Set(
      allPosts.flatMap(p => p.content.match(/#[\w]+/g) ?? [])
        .filter(t => t.toLowerCase().includes(q))
    )].slice(0, 8);

    return { users, posts, hashtags };
  }

  return {
    allPosts, filteredPosts, visiblePosts,
    loading, hasMore, loadMore,
    trendingPosts, trendingHashtags, trendingSparks, suggestedCreators,
    search,
  };
}
