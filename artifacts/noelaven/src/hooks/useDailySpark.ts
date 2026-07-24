import { useState, useEffect, useCallback } from 'react';
import { dailySparks } from '@/lib/mockData';
import { checkTodaySparkAnswer } from '@/lib/firestore';
import { isFirebaseConfigured } from '@/lib/firebase';

const CACHE_PREFIX = 'noelaven_spark_';
const DONE_PREFIX  = 'noelaven_spark_done_';
const STREAK_KEY   = 'noelaven_spark_streak';

interface StreakData {
  count: number;
  lastDate: string; // YYYY-MM-DD in ET
}

export interface MemoryLaneEntry {
  date: string;    // YYYY-MM-DD
  postId: string;
  yearsAgo: number;
}

export function streakBadges(count: number): string[] {
  const badges: string[] = [];
  if (count >= 7)   badges.push('Spark Starter 🔥');
  if (count >= 30)  badges.push('Spark Enthusiast ✨');
  if (count >= 100) badges.push('Spark Legend 💎');
  if (count >= 365) badges.push('Spark Master 🌟');
  return badges;
}

// ─── ET Date Helpers (exported so other modules can use them) ─────────────────

/** Today's date as YYYY-MM-DD in America/New_York (Eastern Time). */
export function todayKeyET(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
}

/** Yesterday's date as YYYY-MM-DD in America/New_York. */
function yesterdayKeyET(): string {
  // Subtract 24h from now and format in ET
  const d = new Date(Date.now() - 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(d);
}

/**
 * Returns the number of milliseconds until the next 00:00:00 in
 * America/New_York. Used to schedule the automatic midnight reset.
 */
export function getMsUntilETMidnight(): number {
  const now = new Date();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) =>
    parseInt(parts.find(p => p.type === type)?.value ?? '0', 10);

  const elapsedMs =
    (get('hour') * 3600 + get('minute') * 60 + get('second')) * 1000
    + now.getMilliseconds();

  return 86_400_000 - elapsedMs;
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

function fallbackPrompt(): string {
  const start = new Date(new Date().getFullYear(), 0, 0).getTime();
  const dayOfYear = Math.floor((Date.now() - start) / 86_400_000);
  return dailySparks[dayOfYear % dailySparks.length];
}

function getStoredStreak(): StreakData {
  if (typeof window === 'undefined') return { count: 0, lastDate: '' };
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    return raw ? (JSON.parse(raw) as StreakData) : { count: 0, lastDate: '' };
  } catch { return { count: 0, lastDate: '' }; }
}

function computeMemoryLane(today: string): MemoryLaneEntry | null {
  if (typeof window === 'undefined') return null;
  const todayMMDD = today.slice(5); // MM-DD
  const todayYear = parseInt(today.slice(0, 4), 10);
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k?.startsWith(DONE_PREFIX)) continue;
    const dateStr = k.slice(DONE_PREFIX.length);
    if (dateStr.length !== 10) continue;
    const dateMMDD = dateStr.slice(5);
    const dateYear = parseInt(dateStr.slice(0, 4), 10);
    if (dateMMDD === todayMMDD && dateYear < todayYear) {
      return {
        date: dateStr,
        postId: localStorage.getItem(k) ?? '',
        yearsAgo: todayYear - dateYear,
      };
    }
  }
  return null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDailySpark(userId?: string) {
  // ── `today` is reactive state so midnight rollovers trigger re-renders ──────
  const [today, setToday] = useState<string>(todayKeyET);

  const cacheKey = CACHE_PREFIX + today;
  const doneKey  = DONE_PREFIX  + today;

  const [prompt, setPrompt] = useState<string>(() => {
    if (typeof window === 'undefined') return fallbackPrompt();
    return localStorage.getItem(CACHE_PREFIX + todayKeyET()) ?? fallbackPrompt();
  });

  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return !localStorage.getItem(CACHE_PREFIX + todayKeyET());
  });

  const [hasAnsweredToday, setHasAnsweredToday] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem(DONE_PREFIX + todayKeyET());
  });

  const [todayPostId, setTodayPostId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(DONE_PREFIX + todayKeyET());
  });

  const [streak, setStreak] = useState<number>(() => getStoredStreak().count);

  const [memoryLane, setMemoryLane] = useState<MemoryLaneEntry | null>(() =>
    computeMemoryLane(todayKeyET())
  );

  // ── Midnight ET watcher — auto-resets when the day rolls over ───────────────
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    function schedule() {
      const ms = getMsUntilETMidnight();
      timeout = setTimeout(() => {
        const newToday = todayKeyET();
        setToday(newToday);

        // Reset answered state for the new day
        const newDoneKey  = DONE_PREFIX  + newToday;
        const newCacheKey = CACHE_PREFIX + newToday;
        setHasAnsweredToday(!!localStorage.getItem(newDoneKey));
        setTodayPostId(localStorage.getItem(newDoneKey));

        // Reset prompt (new day = new prompt from API)
        const cached = localStorage.getItem(newCacheKey);
        setPrompt(cached ?? fallbackPrompt());
        setLoading(!cached);
        setMemoryLane(computeMemoryLane(newToday));

        schedule(); // reschedule for the next midnight
      }, ms + 250); // +250 ms buffer past midnight
    }

    schedule();
    return () => clearTimeout(timeout);
  }, []);

  // ── Sync answered state with Firestore (server-side enforcement) ────────────
  useEffect(() => {
    if (!userId || !isFirebaseConfigured || hasAnsweredToday) return;
    if (!prompt) return;
    checkTodaySparkAnswer(userId, prompt)
      .then(postId => { if (postId) markAnswered(postId); })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, prompt]);

  // ── Fetch today's prompt from API ─────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const cached = localStorage.getItem(cacheKey);
    if (cached) { setLoading(false); return; }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/spark/today');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: { prompt: string; date: string } = await res.json();
        if (cancelled) return;
        // Evict previous day cache entries
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k?.startsWith(CACHE_PREFIX) && k !== cacheKey) localStorage.removeItem(k);
        }
        localStorage.setItem(cacheKey, data.prompt);
        setPrompt(data.prompt);
      } catch (err) {
        console.warn('Daily Spark fetch failed, using fallback:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [today, cacheKey]);

  // ── Mark answered ─────────────────────────────────────────────────────────
  const markAnswered = useCallback((postId: string) => {
    const key   = todayKeyET();
    const doneK = DONE_PREFIX + key;
    if (localStorage.getItem(doneK)) return; // idempotent

    const stored = postId || 'true';
    localStorage.setItem(doneK, stored);
    setHasAnsweredToday(true);
    setTodayPostId(stored);

    // Update streak
    const s         = getStoredStreak();
    const yesterday = yesterdayKeyET();
    let newCount: number;
    if (s.lastDate === key)            newCount = s.count;           // already counted
    else if (s.lastDate === yesterday) newCount = s.count + 1;       // consecutive
    else                               newCount = 1;                  // streak reset
    const newStreak: StreakData = { count: newCount, lastDate: key };
    localStorage.setItem(STREAK_KEY, JSON.stringify(newStreak));
    setStreak(newCount);
  }, []);

  return {
    prompt,
    loading,
    hasAnsweredToday,
    todayPostId,
    streak,
    memoryLane,
    markAnswered,
  };
}
