import { Router } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";

const router = Router();

// ── In-memory daily cache ─────────────────────────────────────────────────────
// Keyed by YYYY-MM-DD so it regenerates at midnight without a restart.
const cache: Map<string, string> = new Map();

const FALLBACK_PROMPTS = [
  "What made you smile today?",
  "Share a song that's been stuck in your head.",
  "What's a small win you had this week?",
  "If you could travel anywhere right now, where would it be?",
  "What's your current favorite hobby?",
  "Share a photo that means a lot to you.",
  "What are you looking forward to this weekend?",
];

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
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

  // Serve from cache when available
  if (cache.has(date)) {
    res.json({ prompt: cache.get(date), date });
    return;
  }

  try {
    const prompt = await generateSparkPrompt();
    cache.set(date, prompt);
    // Evict old dates so the map never grows unbounded
    for (const key of cache.keys()) {
      if (key !== date) cache.delete(key);
    }
    res.json({ prompt, date });
  } catch (err) {
    console.error("Spark generation failed, using fallback:", err);
    // Deterministic fallback: same prompt for everyone on the same day
    const dayOfYear = Math.floor(
      (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) /
        86_400_000
    );
    const prompt = FALLBACK_PROMPTS[dayOfYear % FALLBACK_PROMPTS.length];
    res.json({ prompt, date });
  }
});

export default router;
