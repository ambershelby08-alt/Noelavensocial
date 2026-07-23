import { useState, useEffect } from 'react';
import { dailySparks } from '@/lib/mockData';

const CACHE_PREFIX = 'noelaven_spark_';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function fallbackPrompt(): string {
  const start = new Date(new Date().getFullYear(), 0, 0).getTime();
  const dayOfYear = Math.floor((Date.now() - start) / 86_400_000);
  return dailySparks[dayOfYear % dailySparks.length];
}

export function useDailySpark(): { prompt: string; loading: boolean } {
  const key = todayKey();
  const cacheKey = CACHE_PREFIX + key;

  const cached = typeof window !== 'undefined' ? localStorage.getItem(cacheKey) : null;

  const [prompt, setPrompt] = useState<string>(cached ?? fallbackPrompt());
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    if (cached) return; // already have today's prompt

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/spark/today');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: { prompt: string; date: string } = await res.json();
        if (cancelled) return;
        // Evict previous day cache entries
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k?.startsWith(CACHE_PREFIX) && k !== cacheKey) {
            localStorage.removeItem(k);
          }
        }
        localStorage.setItem(cacheKey, data.prompt);
        setPrompt(data.prompt);
      } catch (err) {
        console.warn('Daily Spark fetch failed, using fallback:', err);
        // fallback already set in initial state
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [key, cached, cacheKey]);

  return { prompt, loading };
}
