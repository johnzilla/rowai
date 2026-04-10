---
phase: 02-coaching-loop
plan: "02"
subsystem: server-api
tags: [llm, tts, supabase, edge-functions, streaming, coaching]
dependency_graph:
  requires:
    - src/lib/supabase/client.ts
    - "@anthropic-ai/sdk"
    - "@cartesia/cartesia-js"
  provides:
    - src/app/api/coach/route.ts
    - src/app/api/tts/route.ts
    - src/lib/coaching/session-writer.ts
  affects:
    - Phase 02 plans that call /api/coach or /api/tts
    - Plan 02-03 (wave 2) which wires coaching pipeline to UI
tech_stack:
  added:
    - "@anthropic-ai/sdk@0.87.0"
    - "@cartesia/cartesia-js@3.0.0"
  patterns:
    - Edge runtime SSE streaming (Next.js 16)
    - Fire-and-forget Supabase writes
    - Upsert with onConflict for KV memory
key_files:
  created:
    - src/app/api/coach/route.ts
    - src/app/api/tts/route.ts
    - src/lib/coaching/session-writer.ts
  modified:
    - package.json
    - package-lock.json
decisions:
  - "Debrief uses ---COACH_MEMORY--- separator in LLM response to co-locate spoken text and memory extraction in one call, avoiding a second LLM round trip"
  - "TTS route passes Cartesia SSE response body directly (no re-encoding) to minimize latency overhead in the proxy"
  - "Types defined locally in session-writer.ts because coaching-types.ts (Plan 01, wave 1 parallel) may not exist at execution time; Plan 03 reconciles imports"
metrics:
  duration: "~5 minutes"
  completed_date: "2026-04-10T16:39:28Z"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 2
---

# Phase 02 Plan 02: Server API Routes Summary

**One-liner:** Claude SSE streaming proxy for 5 coaching intents, Cartesia TTS proxy keeping API key server-side, and fire-and-forget Supabase session + coach_memory writers.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install deps and create LLM coach API route | 7b648d7 | src/app/api/coach/route.ts, package.json |
| 2 | TTS proxy route and session writer | c3ebc83 | src/app/api/tts/route.ts, src/lib/coaching/session-writer.ts |

## What Was Built

### /api/coach (Edge SSE route)
- Accepts 5 intents: `too_hard`, `push_me`, `im_good`, `checkin`, `debrief`
- Intent validation returns 400 on invalid; 500 if `ANTHROPIC_API_KEY` not set
- Per-intent max tokens: checkin=80, too_hard/push_me=60, im_good=40, debrief=300
- Streams `claude-haiku-4-5` responses as `data: {"text":"..."}\n\n` SSE events
- Sends `data: [DONE]\n\n` terminator
- Debrief prompt instructs Claude to append `---COACH_MEMORY---` separator followed by JSON array of `{key, value}` memory entries

### /api/tts (Edge SSE route)
- Accepts `{ text: string, voiceId?: string }`, validates text non-empty and <= 500 chars
- Proxies to `https://api.cartesia.ai/tts/sse` with model `sonic-3`, `pcm_s16le` at 24000 Hz
- Streams Cartesia SSE response body directly back — no re-encoding
- Returns 500 if `CARTESIA_API_KEY` not set; 502 if Cartesia API returns error

### session-writer.ts
- `writeSession(payload)`: inserts into `sessions` table, returns `{id}` or null
- `writeCoachMemory(userId, entries)`: upserts into `coach_memory` with `onConflict: 'user_id,key'`
- Both functions catch all errors, log via `console.error`, never throw (fire-and-forget)

## Deviations from Plan

None — plan executed exactly as written. One expected condition handled as documented:
- coaching-types.ts not available (Plan 01 running in parallel): types defined locally in session-writer.ts with re-exports per plan instructions.

## Threat Mitigations Applied

| Threat ID | Mitigation |
|-----------|------------|
| T-02-06 | Intent validated against 5-value allowlist; 400 on unknown intent |
| T-02-07 | Text length <= 500 chars enforced before calling Cartesia |
| T-02-08 | ANTHROPIC_API_KEY in server-side env only (edge runtime, never in client bundle) |
| T-02-09 | CARTESIA_API_KEY in server-side env only for this route |
| T-02-10 | Supabase RLS enforces auth.uid() = user_id; fire-and-forget pattern doesn't bypass RLS |

## Known Stubs

None — all functions are fully wired. Session writer uses real Supabase client. Coach route calls real Anthropic API. TTS route calls real Cartesia API. No mock data or placeholder values.

## Threat Flags

None — no new trust boundaries introduced beyond those in the plan's threat model.

## Self-Check: PASSED

Files exist:
- FOUND: src/app/api/coach/route.ts
- FOUND: src/app/api/tts/route.ts
- FOUND: src/lib/coaching/session-writer.ts

Commits exist:
- FOUND: 7b648d7 (feat(02-02): create LLM coach API route with SSE streaming)
- FOUND: c3ebc83 (feat(02-02): add TTS proxy route and session/memory writer)
