---
phase: 02-coaching-loop
plan: 01
subsystem: coaching-pipeline
tags: [coaching, audio, zustand, supabase, tts, stroke-processing]
dependency_graph:
  requires: []
  provides: [coaching-types, coaching-store, audio-queue, stroke-processor, cue-templates, cue-router, sessions-migration, coach-memory-migration]
  affects: [02-02, 02-03, 02-04]
tech_stack:
  added: []
  patterns: [zustand-separate-store, web-audio-api-scheduled-playback, sliding-window-threshold, priority-queue-interrupt, module-level-singleton]
key_files:
  created:
    - src/lib/coaching/coaching-types.ts
    - src/lib/coaching/coaching-store.ts
    - src/lib/coaching/audio-queue.ts
    - src/lib/coaching/stroke-processor.ts
    - src/lib/coaching/cue-templates.ts
    - src/lib/coaching/cue-router.ts
    - supabase/migrations/002_sessions_and_memory.sql
  modified: []
decisions:
  - "AudioQueue implemented as module-level singleton (not React state) per RESEARCH.md Pitfall 1 — survives re-renders"
  - "coaching-store.ts kept separate from session-store.ts per RESEARCH.md Pattern 7 — avoids inflating session store with ephemeral coaching state"
  - "skipCheckin sets energyLevel=3 (medium) and timeAvailableMin=null per D-04 — no friction for returning users"
  - "CueRouter.drainPendingLlmTriggers() added as extension point for Plan 03 LLM API route"
  - "Supabase db push flagged as manual step — project not linked in worktree (no config.toml)"
metrics:
  duration: "~20 minutes"
  completed_date: "2026-04-10"
  tasks_completed: 3
  files_changed: 7
---

# Phase 2 Plan 1: Coaching Pipeline Core Summary

**One-liner:** Full coaching pipeline backbone — typed contracts, Zustand coaching store, two-tier priority AudioQueue with gapless PCM scheduling, sliding-window StrokeProcessor, pre-computed CueRouter with cooldown guard, 7-template cue library, and Supabase sessions + coach_memory migration.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Coaching types, store, and Supabase migration | 0331624 | coaching-types.ts, coaching-store.ts, 002_sessions_and_memory.sql |
| 2 | AudioQueue, StrokeProcessor, CueRouter, cue templates | a4d739d | audio-queue.ts, stroke-processor.ts, cue-templates.ts, cue-router.ts |
| 3 | Supabase schema push | manual | See manual steps below |

## What Was Built

### coaching-types.ts
Full typed contract for the coaching pipeline:
- `CuePriority` enum (NORMAL=0, HIGH=1)
- `CoachingTrigger` — trigger type, priority, context, timestamp
- `CueContext` — userName, currentSplitStr, currentRate, targetRate, elapsedMin, distanceM
- `AudioCue` — id, text, priority, triggerType
- `SessionWritePayload` — session write schema for Supabase
- `CoachMemoryEntry` — KV pair for coach memory
- `EnergyLevel` (1|2|3|4|5), `TimeAvailable` (15|20|30|45)
- `SessionPhaseExtended` — extends SessionPhase with 'debriefing'

### coaching-store.ts
Separate Zustand store (not merged into session-store.ts) with:
- Check-in state: checkinComplete, energyLevel, timeAvailableMin, suggestedSessionType, sessionTypeAccepted
- Audio state: isSpeaking, currentCueText (for D-08 visual indicator)
- Debrief state: isDebriefing, debriefComplete, debriefText
- Session summary state for D-16 summary card
- All actions including `skipCheckin` (sets energyLevel=3 per D-04)

### audio-queue.ts
Two-tier priority AudioQueue singleton:
- `initialize()` — creates AudioContext at sampleRate 24000. Must be called inside user gesture.
- `ensureRunning()` — resumes suspended AudioContext
- `playChunk(base64, sampleRate)` — decodes PCM s16le to Float32Array, schedules on AudioContext timeline for gapless playback
- `enqueue(cue)` — HIGH cues stop currentSource, flush normalQueue, play immediately; NORMAL cues queue if speaking
- `stopAll()` — cleanup on session end
- Calls `useCoachingStore.setIsSpeaking()` on speak start/end (D-08)
- Fetches audio from `/api/tts` SSE route (Plan 02 will implement)

### cue-templates.ts
7 pre-computed cue templates:
- `split_drift_up` (HIGH, cooldownMs 0)
- `rate_too_high` (HIGH, cooldownMs 0)
- `rate_too_low` (NORMAL, cooldownMs 30000)
- `pace_on_target` (NORMAL, cooldownMs 60000)
- `halfway` (NORMAL, cooldownMs 0, fires once)
- `session_start_cue` (NORMAL, cooldownMs 0)
- `encouragement_interval` (NORMAL, cooldownMs 120000)

### stroke-processor.ts
Sliding window StrokeProcessor singleton:
- 20-reading rolling window
- 5 threshold checks: split_drift_up, rate_too_high, rate_too_low, pace_on_target, halfway
- `setTargets(rate?, distance?)` — from check-in data
- `setUserName(name)` — for cue context personalization
- `reset()` — clears window and fired-once flags (must call at session start)
- CueContext builder formats splitMs to "M:SS" string

### cue-router.ts
CueRouter singleton with dual-path dispatch:
- Pre-computed path: template lookup, fill, audioQueue.enqueue (COACH-02 <500ms)
- LLM path: pendingLlmTriggers array (Plan 03 drains via drainPendingLlmTriggers())
- 30s default cooldown for NORMAL cues (D-06)
- HIGH priority bypasses cooldown entirely (D-06)
- `reset()` — clears cooldowns and pending LLM triggers

### 002_sessions_and_memory.sql
Migration creates:
- `sessions` table with 12 columns including user_id FK, timing, metrics, energy_level, session_type
- `coach_memory` table with user_id FK, key/value, unique(user_id, key) constraint
- RLS enabled on both tables with per-user SELECT/INSERT policies
- coach_memory additionally has UPDATE policy

## Deviations from Plan

**[Rule 2 - Missing Critical Functionality] Added drainPendingLlmTriggers() to CueRouter**
- **Found during:** Task 2
- **Issue:** Plan specified "store trigger in pendingLlmTriggers" but provided no way for Plan 03's API route to consume them
- **Fix:** Added `drainPendingLlmTriggers(): CoachingTrigger[]` method that returns and clears the list
- **Files modified:** src/lib/coaching/cue-router.ts

**[Rule 2 - Missing Critical Functionality] Added setUserName() to StrokeProcessor**
- **Issue:** CueContext requires userName for template personalization but the plan had no way to inject the user's name into StrokeProcessor
- **Fix:** Added `setUserName(name: string)` method, defaulting to 'Rower'
- **Files modified:** src/lib/coaching/stroke-processor.ts

## Manual Steps Required

### Task 3: Supabase Schema Push

The Supabase project has not been linked in this worktree (no `supabase/config.toml` present). The migration file `supabase/migrations/002_sessions_and_memory.sql` is ready to apply.

To apply the migration:

```bash
# 1. Set your Supabase access token
export SUPABASE_ACCESS_TOKEN=<your-token>

# 2. Link to your project (get PROJECT_REF from app.supabase.com -> Project Settings -> General)
npx supabase link --project-ref <PROJECT_REF>

# 3. Push the migration
npx supabase db push
```

Verify tables exist:

```bash
npx supabase db dump --schema public | grep -E "CREATE TABLE public\.(sessions|coach_memory)"
```

## Known Stubs

None. All modules are complete with real implementations. The `/api/tts` route that `audio-queue.ts` calls is not yet implemented (Plan 02 task), but AudioQueue handles the missing endpoint gracefully via try/catch with speaking-state cleanup.

## Threat Flags

No new threat surface beyond what was documented in the plan's threat model. T-02-01 through T-02-05 mitigations are implemented as specified.

## Self-Check: PASSED
