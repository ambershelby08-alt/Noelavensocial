import { useState, useEffect, useCallback } from 'react';
import { dailySparks } from '@/lib/mockData';

const CACHE_PREFIX = 'noelaven_spark_';
const DONE_PREFIX  = 'noelaven_spark_done_';
const STREAK_KEY   = 'noelaven_spark_streak';

interface StreakData {
  count: number;
  lastDate: string; // YYYY-MM-DD
}

export interface MemoryLaneEntry {
  date: string;    // YYYY-MM-DD (the original answer date)
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

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

function computeMemoryLane(): MemoryLaneEntry | null {
  if (typeof window === 'undefined') return null;
  const today = new Date();
  const todayMMDD  = today.toISOString().slice(5, 10); // MM-DD
  const todayYear  = today.getFullYear();
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k?.startsWith(DONE_PREFIX)) continue;
    const dateStr = k.slice(DONE_PREFIX.length);
    if (dateStr.length !== 10) continue;
    const dateMMDD = dateStr.slice(5);
    const dateYear = parseInt(dateStr.slice(0, 4), 10);
    if (dateMMDD === todayMMDD && dateYear < todayYear) {
      return {
        date:     dateStr,
        postId:   localStorage.getItem(k) ?? '',
        yearsAgo: todayYear - dateYear,
      };
    }
  }
  return null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDailySpark() {
  const today    = todayKey();
  const cacheKey = CACHE_PREFIX + today;
  const doneKey  = DONE_PREFIX  + today;

  const [prompt, setPrompt] = useState<string>(() => {
    if (typeof window === 'undefined') return fallbackPrompt();
    return localStorage.getItem(cacheKey) ?? fallbackPrompt();
  });

  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return !localStorage.getItem(cacheKey);
  });

  const [hasAnsweredToday, setHasAnsweredToday] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem(doneKey);
  });

  const [todayPostId, setTodayPostId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(doneKey);
  });

  const [streak, setStreak] = useState<number>(() => getStoredStreak().count);

  const [memoryLane] = useState<MemoryLaneEntry | null>(() => computeMemoryLane());

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
        // Evict previous day cache entries (iterate backwards for safe removal)
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
    const key  = todayKey();
    const doneK = DONE_PREFIX + key;
    if (localStorage.getItem(doneK)) return; // idempotent

    const stored = postId || 'true';
    localStorage.setItem(doneK, stored);
    setHasAnsweredToday(true);
    setTodayPostId(stored);

    // Update streak
    const s         = getStoredStreak();
    const yesterday = yesterdayKey();
    let newCount: number;
    if (s.lastDate === key)       newCount = s.count;           // already counted this turn
    else if (s.lastDate === yesterday) newCount = s.count + 1;  // consecutive day
    else                          newCount = 1;                  // streak reset
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
