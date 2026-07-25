/**
 * useSparkCommunity — loads today's community Daily Spark responses.
 *
 * Performance design:
 *  1. Module-level in-memory cache (Map)  — zero latency on re-mount / nav back.
 *  2. localStorage persistence            — instant data on page-refresh within the
 *                                           same ET day; evicted automatically on day change.
 *  3. loading = false immediately          — when any cache tier has data, the component
 *                                           renders real content with zero skeleton flash.
 *  4. Background revalidation             — onSnapshot always runs; stale data updates
 *                                           silently once the fresh snapshot arrives.
 *  5. Pagination: 10 posts initially      — small Firestore reads; loadMore() adds 10.
 *  6. Scroll lazy-load                    — caller pairs loadMore() with IntersectionObserver.
 *  7. 2-second timeout                    — timedOut flag triggers a friendly retry card
 *                                           instead of infinite skeleton on bad connections.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { isFirebaseConfigured } from '@/lib/firebase';
import { subscribeCommunitySparkPosts } from '@/lib/firestore';
import { mockUsers } from '@/lib/mockData';
import { todayKeyET } from '@/hooks/useDailySpark';
import { normalizeDate } from '@/lib/timestamp';
import type { Post } from '@/lib/mockData';

// ── ET date filter ────────────────────────────────────────────────────────────
// Firestore omits the createdAt filter on the community query (to avoid a
// composite-index requirement). Posts from a previous day that happened to
// share the same sparkPrompt text would otherwise slip through. We enforce the
// date boundary client-side using the same Eastern-Time date key that controls
// the Daily Spark prompt rotation.
function isFromTodayET(timestamp: unknown): boolean {
  const date = normalizeDate(timestamp);
  if (!date) return false;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(date) === todayKeyET();
}

export type CommunitySort = 'mutuals' | 'following' | 'everyone';

const PAGE_SIZE = 10;

// ── Tier 1: module-level in-memory cache ─────────────────────────────────────
// Survives component remounts / navigating away and back.
// Cleared on hard page refresh.
const memCache = new Map<string, Post[]>();

// ── Tier 2: localStorage persistence ─────────────────────────────────────────
// Persists across page refreshes. Scoped to today's ET date so yesterday's
// posts are never served after midnight ET.

function lsKey(prompt: string): string {
  return `noelaven_community_${todayKeyET()}_${encodeURIComponent(prompt.slice(0, 60))}`;
}

function readLs(prompt: string): Post[] | null {
  try {
    const raw = localStorage.getItem(lsKey(prompt));
    if (!raw) return null;
    const { etDate, posts } = JSON.parse(raw) as { etDate: string; posts: Post[] };
    if (etDate !== todayKeyET()) {
      localStorage.removeItem(lsKey(prompt)); // evict stale entry
      return null;
    }
    return posts;
  } catch { return null; }
}

function writeLs(prompt: string, posts: Post[]): void {
  try {
    // Only persist the first page — keeps localStorage usage minimal.
    localStorage.setItem(lsKey(prompt), JSON.stringify({
      etDate: todayKeyET(),
      posts: posts.slice(0, PAGE_SIZE),
    }));
  } catch {}
}

// ── Demo posts (used when Firebase is not configured) ─────────────────────────

function demoCommunityPosts(prompt: string): Post[] {
  const now = Date.now();
  return [
    {
      id: 'spark-demo-1', authorId: 'user-1', author: mockUsers[0],
      content: 'This prompt really made me think! I believe small moments of kindness ripple out in ways we can never fully measure. 🌊',
      sparkPrompt: prompt, sparkAudience: 'public', likes: 47, comments: 9,
      shares: 3, liked: false, saved: false, createdAt: new Date(now - 3_600_000),
    },
    {
      id: 'spark-demo-2', authorId: 'user-2', author: mockUsers[1],
      content: 'Honestly? The best answer I can give is: my morning coffee. 😂 Simple pleasures are everything.',
      sparkPrompt: prompt, sparkAudience: 'public', likes: 31, comments: 4,
      shares: 1, liked: true, saved: false, createdAt: new Date(now - 7_200_000),
    },
    {
      id: 'spark-demo-3', authorId: 'user-4', author: mockUsers[3],
      content: "That question caught me off guard. I sat with it for a while and realised how much I've been taking the little things for granted.",
      imageUrl: 'https://picsum.photos/600/400?random=77',
      sparkPrompt: prompt, sparkAudience: 'public', likes: 88, comments: 15,
      shares: 6, liked: false, saved: false, createdAt: new Date(now - 10_800_000),
    },
    {
      id: 'spark-demo-4', authorId: 'user-5', author: mockUsers[4],
      content: "I always come back to the idea that connection is everything. Whether it's with people, nature, or a really good book. ✨",
      sparkPrompt: prompt, sparkAudience: 'public', likes: 124, comments: 22,
      shares: 11, liked: false, saved: false, createdAt: new Date(now - 14_400_000),
    },
  ];
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useSparkCommunity(prompt: string, enabled: boolean) {
  // Read both cache tiers synchronously — no setState delay.
  const initial = (prompt && enabled) ? (memCache.get(prompt) ?? readLs(prompt)) : null;

  const [posts, setPosts]       = useState<Post[]>(initial ?? []);
  const [loading, setLoading]   = useState(!initial);   // false immediately when cached
  const [timedOut, setTimedOut] = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [hasMore, setHasMore]   = useState(false);
  // Incrementing this forces the useEffect to restart the subscription (retry).
  const [retryKey, setRetryKey] = useState(0);
  // Track initial value to keep setState calls out of render.
  const initialRef = useRef(initial);

  // Timeout: if we're still loading after 2 s, surface the retry card.
  useEffect(() => {
    if (!loading) { setTimedOut(false); return; }
    const t = setTimeout(() => setTimedOut(true), 2000);
    return () => clearTimeout(t);
  }, [loading]);

  useEffect(() => {
    if (!enabled || !prompt) {
      setPosts([]);
      setLoading(false);
      return;
    }

    // Demo mode — instant, no Firestore.
    if (!isFirebaseConfigured) {
      const demo = demoCommunityPosts(prompt);
      setPosts(demo);
      memCache.set(prompt, demo);
      setLoading(false);
      setHasMore(false);
      return;
    }

    // Only show skeleton on genuine first-ever load (no cache whatsoever).
    const hasCached = !!(memCache.get(prompt) ?? readLs(prompt));
    if (!hasCached) setLoading(true);
    setError(null);

    // Log the exact query being fired so failures are easy to diagnose.
    if (import.meta.env.DEV) {
      console.info(
        `[useSparkCommunity] Starting subscription — prompt="${prompt.slice(0, 40)}" pageSize=${pageSize} retryKey=${retryKey}`
      );
    }

    const t0 = performance.now();

    const unsub = subscribeCommunitySparkPosts(
      todayKeyET(),   // query by sparkDateKey — single equality filter, no composite index needed
      (incoming) => {
        // Client-side filters applied in order:
        //  1. Must be from today (ET) — safety net for any clock drift or missed
        //     sparkDateKey writes on very old posts.
        //  2. Must match today's prompt — ensures we only show responses for the
        //     active Daily Spark question (sparkDateKey could theoretically collide
        //     if the day rolls over mid-session, but the prompt provides precision).
        //  3. Must be public — private/mutuals-only posts must never surface to
        //     arbitrary viewers.
        //  4. Sort by createdAt descending — Firestore's single-equality query
        //     returns docs in document-ID order; we sort client-side instead.
        const todayPosts = incoming
          .filter(p => isFromTodayET(p.createdAt))
          .filter(p => !prompt || p.sparkPrompt === prompt)
          .filter(p => p.sparkAudience === 'public')
          .sort((a, b) => {
            const ta = (a.createdAt instanceof Date ? a.createdAt : new Date(0)).getTime();
            const tb = (b.createdAt instanceof Date ? b.createdAt : new Date(0)).getTime();
            return tb - ta; // newest first
          });

        if (import.meta.env.DEV) {
          console.info(
            `[useSparkCommunity] ✓ snapshot in ${(performance.now() - t0).toFixed(0)} ms — ` +
            `${incoming.length} raw, ${todayPosts.length} after filters (today+prompt+public)`
          );
        }
        setPosts(todayPosts);
        setLoading(false);
        setTimedOut(false);
        setError(null);
        setHasMore(todayPosts.length >= pageSize);
        memCache.set(prompt, todayPosts);
        writeLs(prompt, todayPosts);
      },
      pageSize,
      (err) => {
        // Surface the real error so it can be shown and retried.
        // FirestoreError extends Error and adds a `code` string field.
        const code = (err as unknown as { code?: string }).code ?? 'unknown';
        console.error('[useSparkCommunity] Firestore error:', code, err.message);
        setError(`${code}: ${err.message}`);
        setLoading(false);
        setTimedOut(false);
        // If we had cached data it stays visible; otherwise posts is empty.
        if (!initialRef.current?.length && !memCache.get(prompt)?.length) {
          setPosts([]);
        }
      }
    );

    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, enabled, pageSize, retryKey]);

  /** Load the next page (scroll lazy-load). */
  const loadMore = useCallback(() => {
    setPageSize(prev => prev + PAGE_SIZE);
  }, []);

  /**
   * Retry after an error or timeout.
   * Resets all error/loading state and restarts the Firestore subscription
   * by incrementing retryKey (which is in the useEffect dependency array).
   */
  const retry = useCallback(() => {
    setError(null);
    setTimedOut(false);
    setLoading(true);
    setRetryKey(k => k + 1);
  }, []);

  return { posts, loading, hasMore, loadMore, timedOut, error, retry };
}
