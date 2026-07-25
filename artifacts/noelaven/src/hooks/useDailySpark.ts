/**
 * useDailySpark — per-account Daily Spark state.
 *
 * ## Account-isolation design
 *
 * Every piece of per-user state (answered flag, streak, memory lane) is stored
 * in localStorage under keys that include BOTH the authenticated UID and the
 * Eastern-Time date.  This prevents cross-account leakage in browsers where
 * multiple Noelaven accounts share the same device.
 *
 * Key layout
 * ──────────
 *  Prompt text  (shared — same for every account on the same day)
 *    noelaven_spark_prompt_{YYYY-MM-DD}
 *
 *  Answered flag  (private — MUST include UID)
 *    noelaven_spark_done_{uid}_{YYYY-MM-DD}
 *
 *  Streak data  (private — MUST include UID)
 *    noelaven_spark_streak_{uid}
 *
 * Why the old implementation leaked
 * ──────────────────────────────────
 * The old keys were `noelaven_spark_done_{date}` (no UID) and
 * `noelaven_spark_streak` (no UID).  The useState initializers read these
 * keys synchronously at mount time, so Account B's hook would initialise
 * hasAnsweredToday = true from Account A's done-key.  The `markAnswered`
 * idempotency guard then prevented Account B from ever recording its own
 * answer.
 *
 * The fix
 * ────────
 * 1. All user-specific keys now embed the UID.
 * 2. A useEffect([userId, today]) re-reads the correct key whenever the
 *    authenticated account changes and resets all per-user state.
 * 3. markAnswered requires a known userId and is idempotent only for the
 *    same account + same date.
 */

import { useState, useEffect, useCallback } from 'react';
import { dailySparks } from '@/lib/mockData';
import { checkTodaySparkAnswer } from '@/lib/firestore';
import { isFirebaseConfigured } from '@/lib/firebase';

// ─── Storage key builders ─────────────────────────────────────────────────────

/** Prompt text is NOT user-specific — same question for everyone today. */
const PROMPT_PREFIX = 'noelaven_spark_prompt_';

/**
 * Answered/completion key — MUST include the UID so answers from
 * Account A are invisible to Account B.
 */
function makeDoneKey(uid: string, date: string): string {
  return `noelaven_spark_done_${uid}_${date}`;
}

/**
 * Streak key — MUST include the UID so account streaks are independent.
 */
function makeStreakKey(uid: string): string {
  return `noelaven_spark_streak_${uid}`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface StreakData {
  count: number;
  lastDate: string; // YYYY-MM-DD in ET
}

export interface MemoryLaneEntry {
  date: string;    // YYYY-MM-DD
  postId: string;
  yearsAgo: number;
}

// ─── Streak badge thresholds ──────────────────────────────────────────────────

export function streakBadges(count: number): string[] {
  const badges: string[] = [];
  if (count >= 7)   badges.push('Spark Starter 🔥');
  if (count >= 30)  badges.push('Spark Enthusiast ✨');
  if (count >= 100) badges.push('Spark Legend 💎');
  if (count >= 365) badges.push('Spark Master 🌟');
  return badges;
}

// ─── ET date helpers (exported so other modules can use them) ─────────────────

/** Today's date as YYYY-MM-DD in America/New_York (Eastern Time). */
export function todayKeyET(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
}

/** Yesterday's date as YYYY-MM-DD in America/New_York. */
function yesterdayKeyET(): string {
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
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(now);

  const get = (type: string) =>
    parseInt(parts.find(p => p.type === type)?.value ?? '0', 10);

  const elapsedMs =
    (get('hour') * 3600 + get('minute') * 60 + get('second')) * 1000
    + now.getMilliseconds();

  return 86_400_000 - elapsedMs;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function fallbackPrompt(): string {
  const start = new Date(new Date().getFullYear(), 0, 0).getTime();
  const dayOfYear = Math.floor((Date.now() - start) / 86_400_000);
  return dailySparks[dayOfYear % dailySparks.length];
}

function getStoredStreak(uid: string): StreakData {
  if (typeof window === 'undefined' || !uid) return { count: 0, lastDate: '' };
  try {
    const raw = localStorage.getItem(makeStreakKey(uid));
    return raw ? (JSON.parse(raw) as StreakData) : { count: 0, lastDate: '' };
  } catch { return { count: 0, lastDate: '' }; }
}

/**
 * Scan the current user's done-keys for a previous year with the same
 * month-day — the "Memory Lane" feature.
 *
 * Only searches keys that include the current user's UID, so memory lane
 * entries are correctly isolated per account.
 */
function computeMemoryLane(uid: string, today: string): MemoryLaneEntry | null {
  if (typeof window === 'undefined' || !uid) return null;
  // Only scan this user's done-keys (prefix includes uid)
  const donePrefix = `noelaven_spark_done_${uid}_`;
  const todayMMDD  = today.slice(5);   // MM-DD portion
  const todayYear  = parseInt(today.slice(0, 4), 10);
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k?.startsWith(donePrefix)) continue;
    const dateStr = k.slice(donePrefix.length); // should be YYYY-MM-DD
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

export function useDailySpark(userId?: string) {
  // `today` is reactive state so midnight ET rollovers trigger re-renders.
  const [today, setToday] = useState<string>(todayKeyET);

  const cacheKey = PROMPT_PREFIX + today;

  // Prompt text is shared across accounts — safe to read without a userId.
  const [prompt, setPrompt] = useState<string>(() => {
    if (typeof window === 'undefined') return fallbackPrompt();
    return localStorage.getItem(PROMPT_PREFIX + todayKeyET()) ?? fallbackPrompt();
  });

  const [loading, setLoading] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return !localStorage.getItem(PROMPT_PREFIX + todayKeyET());
  });

  // ── Per-account state — intentionally NOT initialised from localStorage ──────
  //
  // We cannot read the UID-scoped done-key in the useState initializer because
  // `userId` may be undefined at mount time (auth hasn't resolved yet).
  // If we read the OLD non-scoped key here, we reproduce the original bug.
  //
  // Instead we always start with safe defaults and then immediately run the
  // `useEffect([userId, today])` below, which reads the correct UID-scoped
  // key once the authenticated UID is known.  The only observable difference
  // is a single synchronous re-render after the effect fires — acceptable and
  // far safer than reading the wrong account's data.
  const [hasAnsweredToday, setHasAnsweredToday] = useState<boolean>(false);
  const [todayPostId,      setTodayPostId]      = useState<string | null>(null);
  const [streak,           setStreak]           = useState<number>(0);
  const [memoryLane,       setMemoryLane]       = useState<MemoryLaneEntry | null>(null);

  // ── confirmedForUserId: tracks which account the above state was last read for ─
  //
  // Problem: when the user switches from Account A → Account B in the same SPA
  // session, React batches the userId prop change and the useEffect together.
  // Between the render with the new userId and the moment the effect fires,
  // `hasAnsweredToday` still holds Account A's value (true).  This causes
  // CommunityReveal to mount for one render cycle with the wrong account's data
  // — the "unlock banner on new account" symptom.
  //
  // Fix: expose `hasAnsweredToday` as true ONLY when `confirmedForUserId`
  // matches the current `userId`.  The effect sets `confirmedForUserId` at the
  // same time it updates the other per-account state, so both change atomically.
  const [confirmedForUserId, setConfirmedForUserId] = useState<string | undefined>(undefined);

  // ── Critical: re-read per-account state whenever userId or today changes ─────
  //
  // This effect is the primary guard against cross-account state leakage.
  //
  //  • On account switch: userId changes → effect runs → we read the NEW
  //    account's UID-scoped done-key → hasAnsweredToday reflects that account.
  //  • On sign-out: userId becomes undefined → everything resets to false/null/0.
  //  • On midnight: `today` changes → effect runs → we check whether the NEW
  //    account has already answered today (unlikely; effectively a reset).
  useEffect(() => {
    if (!userId) {
      // Signed out or auth not yet resolved — reset everything.
      setHasAnsweredToday(false);
      setTodayPostId(null);
      setStreak(0);
      setMemoryLane(null);
      setConfirmedForUserId(undefined);
      return;
    }
    if (typeof window === 'undefined') return;

    const dk  = makeDoneKey(userId, today);
    const val = localStorage.getItem(dk);
    setHasAnsweredToday(!!val);
    setTodayPostId(val);
    setStreak(getStoredStreak(userId).count);
    setMemoryLane(computeMemoryLane(userId, today));
    setConfirmedForUserId(userId); // mark that all state above is for THIS user
  }, [userId, today]);

  // ── Midnight ET watcher — auto-resets when the day rolls over ───────────────
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    function schedule() {
      const ms = getMsUntilETMidnight();
      timeout = setTimeout(() => {
        const newToday = todayKeyET();
        setToday(newToday);
        // Per-account state (hasAnsweredToday, streak, memoryLane) is reset
        // automatically by the [userId, today] effect above when `today` changes.
        // We only need to reset the prompt cache here.
        const newCacheKey = PROMPT_PREFIX + newToday;
        const cached = localStorage.getItem(newCacheKey);
        setPrompt(cached ?? fallbackPrompt());
        setLoading(!cached);
        schedule(); // reschedule for the next midnight
      }, ms + 250); // +250 ms buffer past midnight
    }

    schedule();

    // Fallback: check every 30 s in case the device was sleeping when
    // the setTimeout would have fired (e.g. lid closed at 11:59 PM).
    const poll = setInterval(() => {
      const key = todayKeyET();
      setToday(prev => {
        if (prev !== key) {
          const cached = localStorage.getItem(PROMPT_PREFIX + key);
          setPrompt(cached ?? fallbackPrompt());
          setLoading(!cached);
        }
        return prev !== key ? key : prev;
      });
    }, 30_000);

    return () => { clearTimeout(timeout); clearInterval(poll); };
  }, []);

  // ── Sync answered state with Firestore (server-side enforcement) ────────────
  // Only runs when the local cache says "not answered" — if the user answered
  // on another device, this catches it.
  useEffect(() => {
    if (!userId || !isFirebaseConfigured || hasAnsweredToday) return;
    if (!prompt) return;
    // Pass today's ET date key (not prompt text) — checkTodaySparkAnswer now
    // queries by authorId + sparkDateKey, which uses auto-created single-field
    // indexes and avoids the composite-index requirement.
    checkTodaySparkAnswer(userId, todayKeyET())
      .then(postId => { if (postId) markAnswered(postId); })
      .catch(() => {});
  // markAnswered is stable (useCallback dep = userId); safe to omit here.
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
        // Evict previous day's prompt keys (only PROMPT_PREFIX keys — never done/streak keys).
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const k = localStorage.key(i);
          if (k?.startsWith(PROMPT_PREFIX) && k !== cacheKey) localStorage.removeItem(k);
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
    // Cannot mark without a known authenticated user.
    if (!userId) return;

    const date = todayKeyET();
    const dk   = makeDoneKey(userId, date); // UID-scoped — only idempotent for THIS account

    // Idempotent for this account+date only. Account B is NOT blocked by Account A's entry.
    if (localStorage.getItem(dk)) return;

    const stored = postId || 'true';
    localStorage.setItem(dk, stored);
    setHasAnsweredToday(true);
    setTodayPostId(stored);
    setConfirmedForUserId(userId); // keep confirmedForUserId in sync after marking

    // Update this account's streak (UID-scoped).
    const s         = getStoredStreak(userId);
    const yesterday = yesterdayKeyET();
    let newCount: number;
    if (s.lastDate === date)            newCount = s.count;           // already counted today
    else if (s.lastDate === yesterday) newCount = s.count + 1;       // consecutive day
    else                               newCount = 1;                  // streak reset
    const newStreak: StreakData = { count: newCount, lastDate: date };
    localStorage.setItem(makeStreakKey(userId), JSON.stringify(newStreak));
    setStreak(newCount);
  }, [userId]);

  // Only expose hasAnsweredToday as true when the confirmed user matches the
  // current userId prop. Between a userId change and the [userId, today] effect
  // firing, confirmedForUserId differs from userId, so we safely return false
  // instead of leaking the previous account's answered state.
  const safeHasAnsweredToday = confirmedForUserId === userId ? hasAnsweredToday : false;

  return {
    prompt,
    loading,
    hasAnsweredToday: safeHasAnsweredToday,
    todayPostId:      safeHasAnsweredToday ? todayPostId : null,
    streak,
    memoryLane,
    markAnswered,
  };
}
