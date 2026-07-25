import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import fs from "node:fs";
import path from "node:path";

const router = Router();

// ── Persistent file-based cache ───────────────────────────────────────────────
//
// WHY: The previous in-memory cache (Map) was cleared on every server restart.
// In development the server restarts often, so Account A and Account B could
// receive *different* prompts from different server instances on the same day.
// The Firestore community query is:
//   where('sparkPrompt', '==', prompt)
// which requires an exact string match. A prompt mismatch produces 0 results
// even though Account A's post is public and readable.
//
// FIX: Persist the cache to a JSON file. All users on the same day get the
// identical prompt string regardless of how many times the server restarts.
const CACHE_FILE = path.join(process.cwd(), ".spark-prompt-cache.json");

let fileCache: Record<string, string> = {};

// Load persisted cache on startup.
try {
  if (fs.existsSync(CACHE_FILE)) {
    const raw = fs.readFileSync(CACHE_FILE, "utf8");
    fileCache = JSON.parse(raw) as Record<string, string>;
  }
} catch {
  fileCache = {};
}

function saveFileCache(): void {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(fileCache, null, 2), "utf8");
  } catch {}
}

const FALLBACK_PROMPTS = [
  "What made you smile today?",
  "Share a song that's been stuck in your head.",
  "What's a small win you had this week?",
  "If you could travel anywhere right now, where would it be?",
  "What's your current favorite hobby?",
  "Share a photo that means a lot to you.",
  "What are you looking forward to this weekend?",
];

/** Returns today's date as YYYY-MM-DD in America/New_York (Eastern Time). */
function todayKey(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(new Date());
}

async function generateSparkPrompt(): Promise<string> {
  const completion = await openai.chat.completions.create({
    model: "gpt-5.4-mini",
    max_completion_tokens: 80,
    messages: [
      {
        role: "system",
        content:
          "You write short, warm, conversational daily prompts for a positive social media community. " +
          "Each prompt should invite genuine personal reflection or sharing — no politics, no controversy. " +
          "Keep it to one sentence, under 12 words, no quotation marks, no emoji.",
      },
      {
        role: "user",
        content: "Generate today's Daily Spark prompt.",
      },
    ],
  });
  const text = completion.choices[0]?.message?.content?.trim();
  if (!text) {
    console.error("Unexpected completion shape:", JSON.stringify(completion));
    throw new Error("Empty response from OpenAI");
  }
  return text;
}

// GET /api/spark/today
router.get("/spark/today", async (_req, res) => {
  const date = todayKey();

  // 1. Serve from file cache (survives server restarts).
  if (fileCache[date]) {
    res.json({ prompt: fileCache[date], date });
    return;
  }

  try {
    const prompt = await generateSparkPrompt();

    // Evict stale dates before writing so the file never grows unbounded.
    for (const key of Object.keys(fileCache)) {
      if (key !== date) delete fileCache[key];
    }
    fileCache[date] = prompt;
    saveFileCache();

    res.json({ prompt, date });
  } catch (err) {
    console.error("Spark generation failed, using fallback:", err);
    // Deterministic fallback: same index for everyone on the same day.
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) /
        86_400_000
    );
    const prompt = FALLBACK_PROMPTS[dayOfYear % FALLBACK_PROMPTS.length];

    // Persist the fallback too — next restart still returns the same string.
    for (const key of Object.keys(fileCache)) {
      if (key !== date) delete fileCache[key];
    }
    fileCache[date] = prompt;
    saveFileCache();

    res.json({ prompt, date });
  }
});

export default router;
