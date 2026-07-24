/**
 * Robust timestamp normalization utilities.
 *
 * Firestore Timestamps, plain Dates, ISO strings, and numeric ms values all
 * flow through the app. Never call `.getTime()` on an unknown value directly —
 * use these helpers everywhere instead.
 *
 * Why duck-typing instead of `instanceof Timestamp`:
 *   In monorepo / multiple-bundle setups the Firebase SDK can be imported from
 *   more than one path, producing distinct class instances. An object created
 *   by one bundle fails `instanceof` checks against the class from another
 *   bundle. Checking for the `toDate` method is immune to this problem.
 */

/** Convert any timestamp-like value to a native Date, or null if unrecognisable. */
export function normalizeDate(value: unknown): Date | null {
  if (!value && value !== 0) return null;

  // Already a proper Date
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  // Firestore Timestamp (or any object with a toDate() method — duck-typed so
  // it works even when instanceof check fails across bundle boundaries).
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate?: unknown }).toDate === 'function'
  ) {
    try {
      const d = (value as { toDate: () => Date }).toDate();
      return d instanceof Date && !isNaN(d.getTime()) ? d : null;
    } catch {
      return null;
    }
  }

  // ISO string or number (unix ms)
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value as string | number);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

/**
 * Safe `.getTime()` — returns 0 (epoch) when the value is not a valid date,
 * so sort comparisons never throw.
 */
export function safeGetTime(value: unknown): number {
  return normalizeDate(value)?.getTime() ?? 0;
}

/**
 * Human-readable relative time string.
 * Handles any timestamp-like value; falls back to "just now" instead of
 * crashing when the value is null, undefined, or an unresolved server
 * timestamp.
 */
export function formatRelativeTime(value: unknown): string {
  const date = normalizeDate(value);
  if (!date) return 'just now';
  const diff = Date.now() - date.getTime();
  if (diff < 0) return 'just now';
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
