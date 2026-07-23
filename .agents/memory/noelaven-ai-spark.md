---
name: Noelaven AI spark — OpenAI model
description: Which OpenAI model and params work for the Daily Spark generation endpoint; gpt-5-nano silently returns empty content through the Replit proxy.
---

## Rule

Use `gpt-5.4-mini` with `max_completion_tokens` (not `max_tokens`) for the `/api/spark/today` route.

## Why

`gpt-5-nano` returns empty content through the Replit proxy (`choices[0].message.content` is null, call still 200s). `gpt-5.4-mini` with `max_completion_tokens` works correctly and produces real content. gpt-5-series models do not support `max_tokens` — always use `max_completion_tokens`.

## How to apply

For any gpt-5.x endpoint use `max_completion_tokens`, never `max_tokens`. Avoid `gpt-5-nano` on this proxy — it silently returns empty content.
