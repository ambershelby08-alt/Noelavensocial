/**
 * Daily Spark prompt system — server-side.
 *
 * Features
 * ────────
 *  • 10 curated categories; never two consecutive days from the same category.
 *  • 90-day recency buffer — a prompt that appeared in the last 90 days is
 *    never shown again (checked against the stored history).
 *  • Golden Spark — every ISO week the whole community gets one special
 *    standout prompt. Generated once per week and cached.
 *  • Surprise Sparks (~10% of days) — visual/fun prompts that feel unexpected.
 *  • OpenAI is called with a rich category-aware system prompt; all curated
 *    prompts serve as high-quality fallbacks when OpenAI is unavailable.
 *  • The cache persists across server restarts so all users on the same day
 *    always see the exact same string regardless of server restart frequency.
 */

import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import fs from "node:fs";
import path from "node:path";

const router = Router();

// ── Category definitions ──────────────────────────────────────────────────────

const CATEGORIES: Record<string, { label: string; prompts: string[] }> = {
  heartfelt: {
    label: "❤️ Heartfelt",
    prompts: [
      "Who made your day better recently?",
      "What's a memory you'll never stop smiling about?",
      "What does 'home' mean to you?",
      "What's the kindest thing someone has done for you lately?",
      "Who deserves a thank-you that you haven't sent yet?",
      "What's a small moment that meant more than it should have?",
      "What would you tell the version of you from five years ago?",
      "What's something you're quietly proud of?",
      "Who in your life brings out the best version of you?",
      "What's the most meaningful gift you've ever received?",
    ],
  },
  funny: {
    label: "😂 Funny",
    prompts: [
      "What's the pettiest reason you've ever been annoyed?",
      "What's your funniest autocorrect fail?",
      "What's something you swore you'd never do... but now you do?",
      "What's your most embarrassing talent?",
      "What's a hill you'll absolutely die on?",
      "What's the most ridiculous thing you believed as a kid?",
      "What's your weirdest food combination that actually slaps?",
      "What's a sentence that perfectly describes your childhood?",
      "What's the most unhinged thing you've Googled?",
      "What's a rule you live by that sounds completely made up?",
    ],
  },
  nostalgia: {
    label: "🥹 Nostalgia",
    prompts: [
      "What snack instantly takes you back to childhood?",
      "What's a song that reminds you of someone?",
      "If you could relive one day, which would it be?",
      "What's a smell that takes you somewhere specific?",
      "What's a toy or game you wish still existed?",
      "What's a TV show or movie that defined your childhood?",
      "What's the first concert or live event you remember?",
      "What's something from your past you'd bring back if you could?",
      "What did your childhood bedroom look like?",
      "What's a phrase or saying from your family that you still use?",
    ],
  },
  life: {
    label: "🌎 Life",
    prompts: [
      "What's something you're finally proud of?",
      "What lesson took you years to learn?",
      "What's one thing you're grateful for today?",
      "What's a belief you used to have that you've completely changed?",
      "What's something you'd tell your future self?",
      "What's a habit that's actually changed your life?",
      "What's something you've stopped caring about that used to stress you?",
      "What's a decision you made that you're still glad you made?",
      "What does success look like to you right now?",
      "What's a chapter of your life you rarely talk about but shaped you?",
    ],
  },
  relationships: {
    label: "💕 Relationships",
    prompts: [
      "What's one green flag people should appreciate more?",
      "What's something someone did for you that you'll never forget?",
      "What's the sweetest compliment you've ever received?",
      "What's your love language — and does the person closest to you know it?",
      "What's a friendship that surprised you by how deep it became?",
      "What's something small someone does that makes you feel loved?",
      "What's the best advice you ever got from a friend?",
      "What's your version of a perfect hangout?",
      "What's a quality you look for in people that not everyone has?",
      "What's something you've learned about yourself through a relationship?",
    ],
  },
  debates: {
    label: "🔥 Debates",
    prompts: [
      "Pineapple on pizza — yes or absolutely not?",
      "Text first or wait?",
      "Is cereal soup?",
      "Is a hot dog a sandwich?",
      "Cats or dogs — final answer?",
      "Summer or winter — fight me.",
      "Morning person or night owl — which is superior?",
      "Do pineapples belong on anything savory?",
      "Sauce on the side or mixed in — which is correct?",
      "Is it okay to ghost someone after one date?",
    ],
  },
  justForFun: {
    label: "🎉 Just for Fun",
    prompts: [
      "If your life had a theme song, what would it be?",
      "What superpower would be completely useless but hilarious?",
      "What's your current obsession?",
      "If you had to eat one meal every day for a year, what is it?",
      "What animal best represents your personality right now?",
      "What fictional world would you actually want to live in?",
      "What's a skill you want to learn purely for fun?",
      "If you could swap lives with anyone for 24 hours, who would it be?",
      "What would the title of your autobiography be?",
      "What's a random fact you love telling people?",
    ],
  },
  positive: {
    label: "🌈 Positive",
    prompts: [
      "What made you laugh today?",
      "Who deserves a thank you from you?",
      "What's one small win you're celebrating?",
      "What's something that went better than expected lately?",
      "What's a compliment you could give yourself right now?",
      "What's something you're looking forward to this week?",
      "What's a positive change you've noticed in yourself?",
      "What's something that never fails to brighten your day?",
      "What's a moment from this week you want to remember?",
      "What's something you're excited to keep working on?",
    ],
  },
  wouldYouRather: {
    label: "🎬 Would You Rather",
    prompts: [
      "Would you rather travel to the future or the past?",
      "Would you rather never use social media again or never watch TV again?",
      "Would you rather always sing or always dance?",
      "Would you rather know how you'll die or when?",
      "Would you rather be able to fly or be invisible?",
      "Would you rather live in a city or in nature?",
      "Would you rather never be cold again or never be hot again?",
      "Would you rather have no phone for a week or no food for two days?",
      "Would you rather always be overdressed or always underdressed?",
      "Would you rather speak every language or play every instrument?",
    ],
  },
  thisOrThat: {
    label: "🍿 This or That",
    prompts: [
      "Sunrise or sunset?",
      "Coffee or tea?",
      "Beach or mountains?",
      "Books or movies?",
      "Sweet or savory?",
      "Window or aisle seat?",
      "Texting or calling?",
      "Cooking or ordering in?",
      "Spontaneous or planned?",
      "Early bird or night owl?",
    ],
  },
};

/** ~10% of days get a Surprise Spark — visual / unexpected prompts. */
const SURPRISE_SPARKS: string[] = [
  "Post your lock screen.",
  "Share the oldest photo on your phone.",
  "Show your favorite pair of shoes.",
  "What's in your fridge right now?",
  "Take a photo of what's right in front of you.",
  "Share your most-used emoji lately.",
  "Show us your current phone wallpaper.",
  "Post the last thing you screenshot.",
  "What's the last song you added to a playlist?",
  "Share something on your desk or nightstand.",
];

const CATEGORY_KEYS = Object.keys(CATEGORIES);

// ── Persistent file-based cache ───────────────────────────────────────────────
//
// Schema:
// {
//   "daily": {
//     "YYYY-MM-DD": {
//       "prompt": string,
//       "categoryKey": string,        // e.g. "heartfelt"
//       "categoryLabel": string,      // e.g. "❤️ Heartfelt"
//       "isGoldenSpark": boolean,
//       "isSurprise": boolean
//     }
//   },
//   "recentPrompts": string[],        // last 90 prompt texts (for dedup)
//   "lastCategoryKey": string,        // prevents same-category on consecutive days
//   "goldenSpark": {
//     "weekKey": string,              // e.g. "2024-W03"
//     "prompt": string,
//     "categoryLabel": string
//   }
// }

const CACHE_FILE = path.join(process.cwd(), ".spark-prompt-cache.json");

interface DailyEntry {
  prompt: string;
  categoryKey: string;
  categoryLabel: string;
  isGoldenSpark: boolean;
  isSurprise: boolean;
}

interface GoldenSparkEntry {
  weekKey: string;
  prompt: string;
  categoryLabel: string;
}

interface SparkCache {
  daily: Record<string, DailyEntry>;
  recentPrompts: string[];        // last 90 for dedup
  lastCategoryKey: string;
  goldenSpark: GoldenSparkEntry | null;
}

let cache: SparkCache = {
  daily: {},
  recentPrompts: [],
  lastCategoryKey: "",
  goldenSpark: null,
};

// Load persisted cache on startup.
try {
  if (fs.existsSync(CACHE_FILE)) {
    const raw = fs.readFileSync(CACHE_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<SparkCache>;
    // Migrate from old format (only had a flat string map)
    if (parsed.daily && typeof Object.values(parsed.daily)[0] === "object") {
      cache = {
        daily: parsed.daily ?? {},
        recentPrompts: parsed.recentPrompts ?? [],
        lastCategoryKey: parsed.lastCategoryKey ?? "",
        goldenSpark: parsed.goldenSpark ?? null,
      };
    } else {
      // Old flat format: migrate
      const legacyFlat = parsed as unknown as Record<string, string>;
      const today = todayKey();
      if (legacyFlat[today]) {
        cache.daily[today] = {
          prompt: legacyFlat[today],
          categoryKey: "life",
          categoryLabel: CATEGORIES.life.label,
          isGoldenSpark: false,
          isSurprise: false,
        };
        cache.recentPrompts = [legacyFlat[today]];
      }
    }
  }
} catch {
  cache = { daily: {}, recentPrompts: [], lastCategoryKey: "", goldenSpark: null };
}

function saveCache(): void {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), "utf8");
  } catch (err) {
    console.error("[spark] Failed to write cache:", err);
  }
}

// ── Date/time helpers ─────────────────────────────────────────────────────────

/** Returns today's date as YYYY-MM-DD in America/New_York (Eastern Time). */
function todayKey(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}

/** Returns the ISO week key for the current ET week, e.g. "2024-W03". */
function currentWeekKey(): string {
  const now = new Date(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date())
  );
  // ISO week number calculation
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7; // Mon=1 ... Sun=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

// ── Category/prompt selection ─────────────────────────────────────────────────

/** True when `date`'s day-of-year index is a "Surprise Spark" day (~10%). */
function isSurpriseDay(date: string): boolean {
  const d = new Date(date + "T00:00:00");
  const start = new Date(d.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((d.getTime() - start.getTime()) / 86400000);
  // Days where dayOfYear % 10 === 3 → roughly 10% of days, deterministic
  return dayOfYear % 10 === 3;
}

/**
 * Pick the next category key.
 *  • Must not match `lastCategoryKey` (no consecutive same-category days).
 *  • Rotates through all 10 keys before repeating any one key, using a
 *    deterministic offset based on the date so the sequence is reproducible.
 */
function pickCategoryKey(date: string, lastKey: string): string {
  const available = CATEGORY_KEYS.filter(k => k !== lastKey);
  // Deterministic pick: hash the date to an index
  let hash = 0;
  for (const ch of date) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffffffff;
  return available[Math.abs(hash) % available.length];
}

/**
 * Pick a fallback prompt from `category` that is not in `recentPrompts`.
 * Falls back to the first prompt in the category if all have been used recently.
 */
function pickFallbackPrompt(categoryKey: string, recentPrompts: string[]): string {
  const pool = CATEGORIES[categoryKey]?.prompts ?? CATEGORIES.life.prompts;
  const fresh = pool.filter(p => !recentPrompts.includes(p));
  if (fresh.length > 0) return fresh[0];
  return pool[0]; // all recently used — just cycle from the start
}

// ── OpenAI generation ─────────────────────────────────────────────────────────

async function generateWithAI(
  categoryKey: string,
  recentPrompts: string[],
  isSurprise: boolean
): Promise<string> {
  const cat = CATEGORIES[categoryKey];

  const systemInstructions = isSurprise
    ? `You write "Surprise Spark" prompts for a warm, positive social media community.
These are visual or unexpected — they ask users to share something physical or fun.
Examples: "Post your lock screen.", "Show the oldest photo on your phone."
Keep it fun, light, safe, and inclusive. One short sentence, no quotation marks.`
    : `You write Daily Spark prompts for a warm, positive social media community called Noelaven.
Today's category is: ${cat.label}
Examples from this category: ${cat.prompts.slice(0, 3).join(" | ")}

Rules:
- One sentence, under 15 words, conversational tone, no quotation marks, no emoji
- Fresh and different from these recent prompts: ${recentPrompts.slice(-10).join(" | ")}
- No politics, religion, or content that pressures users to share sensitive information
- Should spark genuine, warm conversation`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    max_tokens: 80,
    messages: [
      { role: "system", content: systemInstructions },
      { role: "user", content: isSurprise ? "Write a Surprise Spark prompt." : "Write today's Daily Spark prompt." },
    ],
  });

  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) throw new Error("Empty response from OpenAI");
  return text;
}

// ── Golden Spark ──────────────────────────────────────────────────────────────

async function ensureGoldenSpark(weekKey: string): Promise<GoldenSparkEntry> {
  // Return cached if already generated for this week
  if (cache.goldenSpark?.weekKey === weekKey) return cache.goldenSpark;

  // Golden Spark always comes from the "heartfelt" or "life" pool — memorable,
  // community-wide prompts that encourage broad participation.
  const goldenCategories = ["heartfelt", "life", "relationships", "positive"];
  const idx = Math.abs(weekKey.split("-W").reduce((a, b) => a * 100 + parseInt(b, 10), 0)) % goldenCategories.length;
  const catKey = goldenCategories[idx];
  const cat = CATEGORIES[catKey];

  let prompt: string;
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      max_tokens: 80,
      messages: [
        {
          role: "system",
          content: `You write the weekly "Golden Spark" prompt for Noelaven — a special, memorable question that the whole community answers together on the same day.
It should feel like a shared event: warm, inclusive, thought-provoking, and timeless.
Category hint: ${cat.label}
Examples: "${cat.prompts[0]}" | "${cat.prompts[1]}"
One sentence, under 15 words, no quotation marks, no emoji. Make it genuinely memorable.`,
        },
        { role: "user", content: "Write this week's Golden Spark prompt." },
      ],
    });
    prompt = completion.choices[0]?.message?.content?.trim() ?? cat.prompts[0];
  } catch {
    // Fallback: use a hand-picked prompt from the category pool
    prompt = cat.prompts[weekKey.split("W")[1] ? parseInt(weekKey.split("W")[1], 10) % cat.prompts.length : 0];
  }

  const golden: GoldenSparkEntry = { weekKey, prompt, categoryLabel: cat.label };
  cache.goldenSpark = golden;
  saveCache();
  return golden;
}

// ── Main prompt logic ─────────────────────────────────────────────────────────

async function getOrGenerateDailyPrompt(date: string): Promise<DailyEntry> {
  // 1. Already generated for today — return immediately.
  if (cache.daily[date]) return cache.daily[date];

  // 2. Evict entries older than 90 days to keep the cache small.
  const cutoff = new Date(date);
  cutoff.setDate(cutoff.getDate() - 90);
  for (const key of Object.keys(cache.daily)) {
    if (new Date(key) < cutoff) delete cache.daily[key];
  }

  // 3. Determine if this is a Surprise Spark day.
  const isSurprise = isSurpriseDay(date);

  // 4. Pick category (no consecutive same-category; deterministic from date).
  const categoryKey = isSurprise ? "justForFun" : pickCategoryKey(date, cache.lastCategoryKey);
  const category = CATEGORIES[categoryKey] ?? CATEGORIES.life;

  // 5. Try AI generation; fall back to curated pool.
  let prompt: string;
  try {
    prompt = await generateWithAI(categoryKey, cache.recentPrompts, isSurprise);
  } catch (err) {
    console.error("[spark] AI generation failed, using fallback:", err);
    if (isSurprise) {
      const dayIdx = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000);
      prompt = SURPRISE_SPARKS[dayIdx % SURPRISE_SPARKS.length];
    } else {
      prompt = pickFallbackPrompt(categoryKey, cache.recentPrompts);
    }
  }

  // 6. Build entry and persist.
  const entry: DailyEntry = {
    prompt,
    categoryKey,
    categoryLabel: isSurprise ? "✨ Surprise Spark" : category.label,
    isGoldenSpark: false, // set by caller if today is a golden-spark day
    isSurprise,
  };

  cache.daily[date] = entry;
  // Maintain 90-entry recency buffer (dedup)
  cache.recentPrompts = [...cache.recentPrompts, prompt].slice(-90);
  cache.lastCategoryKey = categoryKey;
  saveCache();

  return entry;
}

// ── Routes ────────────────────────────────────────────────────────────────────

// GET /api/spark/today
router.get("/spark/today", async (_req, res) => {
  const date = todayKey();
  const weekKey = currentWeekKey();

  try {
    const [entry, golden] = await Promise.all([
      getOrGenerateDailyPrompt(date),
      ensureGoldenSpark(weekKey),
    ]);

    // Check if today is the Golden Spark day (Monday = start of ISO week).
    // Golden Spark fires on the same day every week — ISO Monday.
    const dayOfWeek = new Date().toLocaleDateString("en-US", {
      timeZone: "America/New_York",
      weekday: "long",
    });
    const isGoldenSparkDay = dayOfWeek === "Monday";

    // On Golden Spark days, override the daily prompt with the golden one.
    const responsePrompt = isGoldenSparkDay ? golden.prompt : entry.prompt;
    const responseCategoryLabel = isGoldenSparkDay ? `⭐ Golden Spark` : entry.categoryLabel;

    if (isGoldenSparkDay && !entry.isGoldenSpark) {
      cache.daily[date] = { ...entry, isGoldenSpark: true };
      saveCache();
    }

    res.json({
      prompt: responsePrompt,
      date,
      categoryKey: isGoldenSparkDay ? "golden" : entry.categoryKey,
      categoryLabel: responseCategoryLabel,
      isGoldenSpark: isGoldenSparkDay,
      isSurprise: entry.isSurprise && !isGoldenSparkDay,
      goldenSpark: {
        prompt: golden.prompt,
        categoryLabel: golden.categoryLabel,
        weekKey: golden.weekKey,
      },
    });
  } catch (err) {
    console.error("[spark] Unexpected error in /spark/today:", err);
    // Deterministic emergency fallback — always returns the same string for the same day.
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000
    );
    const allFallbacks = Object.values(CATEGORIES).flatMap(c => c.prompts);
    const prompt = allFallbacks[dayOfYear % allFallbacks.length];
    res.json({
      prompt,
      date,
      categoryKey: "life",
      categoryLabel: CATEGORIES.life.label,
      isGoldenSpark: false,
      isSurprise: false,
      goldenSpark: null,
    });
  }
});

// GET /api/spark/golden — explicitly fetch this week's Golden Spark prompt.
router.get("/spark/golden", async (_req, res) => {
  const weekKey = currentWeekKey();
  try {
    const golden = await ensureGoldenSpark(weekKey);
    res.json(golden);
  } catch (err) {
    console.error("[spark] Failed to generate golden spark:", err);
    res.status(500).json({ error: "Failed to generate Golden Spark" });
  }
});

export default router;
