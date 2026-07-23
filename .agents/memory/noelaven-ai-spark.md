---
name: Noelaven AI spark — OpenAI model
description: Which OpenAI model and params work for the Daily Spark generation endpoint; gpt-5-nano silently returns empty content through the Replit proxy.
---

## Rule

Use `gpt-4.1-mini` with `max_tokens` (not `max_completion_tokens`) for the `/api/spark/today` route.

## Why

`gpt-5-nano` (and presumably other gpt-5-series models) returns a completion where `choices[0].message.content` is null/empty when called through the Replit AI Integrations proxy. No error is thrown — the call succeeds with 200 but the content field is absent. Switching to `gpt-4.1-mini` with `max_tokens: 80` produces real content.

## How to apply

If adding other simple text-generation endpoints (not conversations, not streaming), start with `gpt-4.1-mini` + `max_tokens`. Only move to newer models if explicitly requested and after verifying they return non-empty content via the proxy.
