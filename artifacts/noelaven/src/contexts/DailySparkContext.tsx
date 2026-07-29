/**
 * DailySparkContext — one shared source of truth for the current user's
 * Daily Spark answered-state across the entire app.
 *
 * ## Why this context exists
 *
 * The original implementation called `useDailySpark(currentUser?.id)` inside
 * individual pages (Home, Profile, etc.).  Each call created a fresh hook
 * instance that started with `hasAnsweredToday = false` and then read
 * localStorage in a `useEffect`.  Two races resulted:
 *
 *   1. **Mount race** — Home.tsx had a `useEffect([], [])` that consumed
 *      `hasAnsweredToday` BEFORE the storage-read effect fired, so it always
 *      saw `false` and opened the composer again.
 *
 *   2. **Multiple instances** — each page had its own boolean; answering on
 *      Home didn't propagate to the Spark button in the bottom nav or sidebar.
 *
 * ## Fix
 *
 * `DailySparkProvider` calls `useDailySpark` once, at the app level (inside
 * `AuthProvider`).  All consumers share a single instance whose state never
 * resets on page navigation.
 *
 * `statusConfirmed` (exposed from `useDailySpark`) becomes `true` once the
 * localStorage read for the current UID has completed.  Components that open
 * UI based on `hasAnsweredToday` MUST wait for `statusConfirmed` first.
 */

import React, { createContext, useContext } from 'react';
import { useDailySpark, type MemoryLaneEntry } from '@/hooks/useDailySpark';
import { useAuth } from '@/contexts/AuthContext';

// ─── Public shape ─────────────────────────────────────────────────────────────

export interface DailySparkStatusValue {
  /** Whether the authenticated user has answered today's Spark. */
  hasAnsweredToday: boolean;
  /**
   * True once localStorage has been read for the current UID.
   * Gate any UI that opens based on `hasAnsweredToday` behind this flag,
   * or you may see a false-negative flash on mount.
   */
  statusConfirmed: boolean;
  /** The postId of today's answer, or null if not yet answered. */
  todayPostId: string | null;
  /** Today's Daily Spark prompt. */
  prompt: string;
  /** True while the prompt text is still loading from the API. */
  isLoading: boolean;
  /** Current streak count for the authenticated user. */
  streak: number;
  /** Memory-lane entry if one exists for today's anniversary. */
  memoryLane: MemoryLaneEntry | null;
  /**
   * Category label for today's prompt, e.g. "❤️ Heartfelt" or "🔥 Debates".
   * Empty string while loading.
   */
  categoryLabel: string;
  /**
   * True on Golden Spark days — one shared standout prompt for the whole
   * Noelaven community to answer together.
   */
  isGoldenSpark: boolean;
  /** Mark the current user as having answered today (updates local + streak). */
  markAnswered: (postId: string) => void;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const DailySparkContext = createContext<DailySparkStatusValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

/**
 * Mount this once inside `AuthProvider` (and `UserCacheProvider`) in App.tsx.
 * All pages, the bottom nav, and the sidebar will read from this shared instance.
 */
export function DailySparkProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();

  const {
    prompt,
    loading,
    hasAnsweredToday,
    statusConfirmed,
    todayPostId,
    streak,
    memoryLane,
    categoryLabel,
    isGoldenSpark,
    markAnswered,
  } = useDailySpark(currentUser?.id);

  const value: DailySparkStatusValue = {
    hasAnsweredToday,
    statusConfirmed,
    todayPostId,
    prompt,
    isLoading: loading,
    streak,
    memoryLane,
    categoryLabel,
    isGoldenSpark,
    markAnswered,
  };

  return (
    <DailySparkContext.Provider value={value}>
      {children}
    </DailySparkContext.Provider>
  );
}

// ─── Consumer hook ─────────────────────────────────────────────────────────────

/**
 * Hook for any component that needs to know whether the current user has
 * answered today's Daily Spark, or that needs to call `markAnswered`.
 *
 * Must be used inside `<DailySparkProvider>`.
 */
export function useDailySparkStatus(): DailySparkStatusValue {
  const ctx = useContext(DailySparkContext);
  if (!ctx) {
    throw new Error('useDailySparkStatus must be used inside <DailySparkProvider>');
  }
  return ctx;
}
