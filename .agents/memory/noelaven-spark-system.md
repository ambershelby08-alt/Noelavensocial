---
name: Noelaven Daily Spark prompt system
description: Architecture of the categorized prompt system with Golden Spark and 90-day rotation
---

## Rule
All prompt generation logic lives server-side in `artifacts/api-server/src/routes/spark.ts`. The client only caches and displays.

## API response shape (v2)
```json
{
  "prompt": "...",
  "date": "YYYY-MM-DD",
  "categoryKey": "heartfelt",
  "categoryLabel": "❤️ Heartfelt",
  "isGoldenSpark": false,
  "isSurprise": false,
  "goldenSpark": { "prompt": "...", "categoryLabel": "...", "weekKey": "YYYY-Www" }
}
```

## Cache file format (`.spark-prompt-cache.json`)
```json
{
  "daily": { "YYYY-MM-DD": { "prompt", "categoryKey", "categoryLabel", "isGoldenSpark", "isSurprise" } },
  "recentPrompts": ["..."],   // last 90 — used for 90-day dedup
  "lastCategoryKey": "...",  // prevents same category on consecutive days
  "goldenSpark": { "weekKey", "prompt", "categoryLabel" }
}
```

## Category keys
heartfelt | funny | nostalgia | life | relationships | debates | justForFun | positive | wouldYouRather | thisOrThat

## Golden Spark
- Generated once per ISO week; all users get the same prompt on Mondays.
- Comes from heartfelt/life/relationships/positive pool — memorable, community-wide.
- Endpoint: `GET /api/spark/golden` (also included in `/api/spark/today` response).

## Surprise Sparks
- ~10% of days (`dayOfYear % 10 === 3`), deterministic.
- Visual/physical prompts: "Post your lock screen", "Show the oldest photo on your phone".

## Client localStorage keys
- `noelaven_spark_prompt_{YYYY-MM-DD}` — prompt text
- `noelaven_spark_meta_{YYYY-MM-DD}` — `{ categoryLabel, isGoldenSpark, isSurprise }`
- `noelaven_spark_golden_{YYYY-Www}` — golden spark for the week

## Context exposure
`DailySparkContext` exposes `categoryLabel: string` and `isGoldenSpark: boolean` from `useDailySpark`. Both initialized from localStorage so they're available before the API call returns.

## OpenAI model
Use `gpt-4.1-mini` (NOT gpt-5-nano / gpt-5.4-mini — those return empty content via Replit proxy).
