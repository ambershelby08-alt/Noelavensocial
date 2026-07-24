/**
 * Content Moderation utilities — spam detection and language filtering.
 *
 * NOTE: The content filter pattern lists are intentionally minimal stubs.
 * In production, replace with a dedicated moderation service such as
 * Perspective API, OpenAI Moderation, or Azure Content Safety,
 * and maintain word lists out-of-tree in secure configuration.
 */

// ─── Spam detection ───────────────────────────────────────────────────────────

const SPAM_WINDOW_MS  = 10 * 60 * 1000; // 10-minute rolling window
const SPAM_THRESHOLD  = 5;              // max posts before flagged
const COOLDOWN_MS     = 30 * 60 * 1000; // 30-minute soft cooldown

interface SpamRecord {
  attempts: number[];   // epoch ms timestamps of recent posts
  cooldownUntil?: number;
}

function loadSpam(userId: string): SpamRecord {
  try {
    return JSON.parse(localStorage.getItem(`nlv_spam_${userId}`) ?? '{}');
  } catch { return { attempts: [] }; }
}

function saveSpam(userId: string, rec: SpamRecord) {
  try { localStorage.setItem(`nlv_spam_${userId}`, JSON.stringify(rec)); } catch {}
}

export interface SpamCheck {
  isSpam: boolean;
  cooldownMs: number;
  reason?: string;
}

export function checkSpamRisk(userId: string): SpamCheck {
  const now = Date.now();
  const rec = loadSpam(userId);

  // Active cooldown?
  if (rec.cooldownUntil && now < rec.cooldownUntil) {
    return {
      isSpam: true,
      cooldownMs: rec.cooldownUntil - now,
      reason: "You're posting too quickly. Please wait before posting again.",
    };
  }

  // Prune old attempts
  const recent = (rec.attempts ?? []).filter(t => now - t < SPAM_WINDOW_MS);

  if (recent.length >= SPAM_THRESHOLD) {
    const cooldownUntil = now + COOLDOWN_MS;
    saveSpam(userId, { attempts: recent, cooldownUntil });
    return {
      isSpam: true,
      cooldownMs: COOLDOWN_MS,
      reason: `You have posted ${SPAM_THRESHOLD}+ times in the last 10 minutes. Take a short break!`,
    };
  }

  return { isSpam: false, cooldownMs: 0 };
}

export function recordPostAttempt(userId: string): void {
  const now = Date.now();
  const rec = loadSpam(userId);
  const recent = (rec.attempts ?? []).filter(t => now - t < SPAM_WINDOW_MS);
  saveSpam(userId, { ...rec, attempts: [...recent, now] });
}

export function resetSpamCooldown(userId: string): void {
  try { localStorage.removeItem(`nlv_spam_${userId}`); } catch {}
}

// ─── Content filter ───────────────────────────────────────────────────────────

export type FilterSensitivity = 'off' | 'low' | 'medium' | 'high';

/**
 * Patterns at each level. In production, populate from a secure,
 * out-of-tree config store — never hard-code a full slur list in source.
 *
 * The included demo patterns are limited to widely-known mild profanity
 * that appears in PG-13 films and does not constitute hate speech.
 */
const PATTERNS: Record<FilterSensitivity, RegExp[]> = {
  off: [],
  // Low: catches only the most universally-flagged extreme content (empty by default)
  low: [],
  // Medium: catches strong profanity
  medium: [
    /\bf[*u]ck(ing|er|ed|s)?\b/gi,
    /\bs[*h]it(ty|s|head)?\b/gi,
    /\ba[*s]shole\b/gi,
  ],
  // High: catches the above plus milder profanity and insults
  high: [
    /\bf[*u]ck(ing|er|ed|s)?\b/gi,
    /\bs[*h]it(ty|s|head)?\b/gi,
    /\ba[*s]shole\b/gi,
    /\bdam+n\b/gi,
    /\bcrap\b/gi,
    /\bidiot\b/gi,
    /\bmoron\b/gi,
    /\bstupid\b/gi,
    /\bpathetic\b/gi,
  ],
};

export interface FilterResult {
  flagged:  boolean;   // content was modified
  clean:    string;    // possibly censored version
  reason?:  string;
}

export function filterContent(text: string, sensitivity: FilterSensitivity): FilterResult {
  if (sensitivity === 'off') return { flagged: false, clean: text };

  const patterns = PATTERNS[sensitivity];
  if (!patterns.length) return { flagged: false, clean: text };

  let clean = text;
  let flagged = false;

  for (const re of patterns) {
    if (re.test(clean)) {
      flagged = true;
      // Replace with asterisks of same length
      clean = clean.replace(re, m => m[0] + '*'.repeat(Math.max(0, m.length - 1)));
      re.lastIndex = 0; // reset stateful global regex
    }
  }

  return { flagged, clean, reason: flagged ? 'Some language was softened by your content filter.' : undefined };
}

/** True if content should be fully blocked (not just censored) at this sensitivity. */
export function shouldBlock(text: string, sensitivity: FilterSensitivity): boolean {
  if (sensitivity === 'off') return false;
  // Only block (not just censor) content matched by 'low' list
  return PATTERNS.low.some(re => { const r = re.test(text); re.lastIndex = 0; return r; });
}
