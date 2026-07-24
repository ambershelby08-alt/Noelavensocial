/**
 * useSparkCommunity — loads today's community Daily Spark responses.
 *
 * Optimisations:
 *  • Instant render — serves cached posts from sessionStorage on first paint.
 *  • Skeleton-friendly — `loading` is only true when we have *no* data at all.
 *  • Pagination — starts at PAGE_SIZE posts; caller can call `loadMore()` to
 *    extend the window (reuses the same onSnapshot subscription, just with a
 *    larger limit so Firestore sends an incremental diff).
 *  • ET-aware cache key — cache is scoped to today's Eastern-Time date so
 *    yesterday's posts never surface after midnight ET.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { isFirebaseConfigured } from '@/lib/firebase';
import { subscribeCommunitySparkPosts } from '@/lib/firestore';
import { mockUsers } from '@/lib/mockData';
import { todayKeyET } from '@/hooks/useDailySpark';
import type { Post } from '@/lib/mockData';

export type CommunitySort = 'friends' | 'following' | 'everyone';

const SESSION_PREFIX = 'noelaven_community_';
const PAGE_SIZE = 20;

// ── Session-storage cache ──────────────────────────────────────────────────────

function cacheKey(prompt: string): string {
  // Scope to today's ET date + a safe slice of the prompt text
  return SESSION_PREFIX + todayKeyET() + '_' + encodeURIComponent(prompt.slice(0, 60));
}

function readCache(key: string): Post[] | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { date: string; posts: Post[] };
    // Reject if the cache was written on a different ET day
    if (parsed.date !== todayKeyET()) return null;
    return parsed.posts;
  } catch { return null; }
}

function writeCache(key: string, posts: Post[]): void {
  try {
    // Only persist the first page so session storage stays small
    sessionStorage.setItem(key, JSON.stringify({ date: todayKeyET(), posts: posts.slice(0, PAGE_SIZE) }));
  } catch {}
}

// ── Demo posts ─────────────────────────────────────────────────────────────────

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
      createdAt: new Date(now.getTime() - 3_600_000 * 1),
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
      createdAt: new Date(now.getTime() - 3_600_000 * 2),
    },
    {
      id: 'spark-demo-3',
      authorId: 'user-4',
      author: mockUsers[3],
      content: "That question caught me off guard. I sat with it for a while and realised how much I've been taking the little things for granted.",
      imageUrl: 'https://picsum.photos/600/400?random=77',
      sparkPrompt: prompt,
      sparkAudience: 'public',
      likes: 88,
      comments: 15,
      shares: 6,
      liked: false,
      saved: false,
      createdAt: new Date(now.getTime() - 3_600_000 * 3),
    },
    {
      id: 'spark-demo-4',
      authorId: 'user-5',
      author: mockUsers[4],
      content: "I always come back to the idea that connection is everything. Whether it's with people, nature, or a really good book. ✨",
      sparkPrompt: prompt,
      sparkAudience: 'public',
      likes: 124,
      comments: 22,
      shares: 11,
      liked: false,
      saved: false,
      createdAt: new Date(now.getTime() - 3_600_000 * 4),
    },
  ];
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSparkCommunity(prompt: string, enabled: boolean) {
  const ck = cacheKey(prompt);

  // Initialise from session-storage so the first render already has data
  const initialPosts = useRef<Post[] | null>(
    prompt && enabled ? readCache(ck) : null
  );

  const [posts, setPosts]     = useState<Post[]>(initialPosts.current ?? []);
  // Only show the skeleton when we genuinely have nothing to show
  const [loading, setLoading] = useState(!initialPosts.current?.length);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [hasMore, setHasMore]   = useState(false);

  useEffect(() => {
    if (!enabled || !prompt) {
      setPosts([]);
      setLoading(false);
      return;
    }

    // Demo mode — instant, no Firestore
    if (!isFirebaseConfigured) {
      const demo = demoCommunityPosts(prompt);
      setPosts(demo);
      setLoading(false);
      setHasMore(false);
      return;
    }

    // Show skeleton only if we have nothing cached
    if (!posts.length) setLoading(true);

    const unsub = subscribeCommunitySparkPosts(prompt, (incoming) => {
      setPosts(incoming);
      setLoading(false);
      setHasMore(incoming.length >= pageSize);
      writeCache(ck, incoming);
    }, pageSize);

    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, enabled, pageSize, ck]);

  /** Load the next page of responses. */
  const loadMore = useCallback(() => {
    setPageSize(prev => prev + PAGE_SIZE);
  }, []);

  return { posts, loading, hasMore, loadMore };
}
