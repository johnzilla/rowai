---
phase: 02-coaching-loop
plan: "04"
subsystem: coaching-loop
tags: [debrief, session-lifecycle, supabase, tts, coach-memory, summary-card]
dependency_graph:
  requires: [02-01, 02-02, 02-03]
  provides: [POST-01, POST-02, POST-03, COACH-04]
  affects: [src/hooks/useSessionLifecycle.ts, src/lib/session/session-store.ts, src/lib/coaching/stroke-processor.ts, src/components/session/SessionSummaryCard.tsx, src/app/session/page.tsx]
tech_stack:
  added: []
  patterns: [SSE-streaming-debrief, COACH_MEMORY-separator-parsing, fire-and-forget-supabase-writes, accumulated-averages-vs-sliding-window]
key_files:
  created:
    - src/components/session/SessionSummaryCard.tsx
  modified:
    - src/lib/coaching/stroke-processor.ts
    - src/lib/session/session-store.ts
    - src/hooks/useSessionLifecycle.ts
    - src/app/session/page.tsx
decisions:
  - "Debrief TTS streamed directly via audioQueue.playChunk() (not enqueue()) so coaching store speaking indicator tracks debrief audio without requiring an AudioCue wrapper"
  - "waitForAudioToFinish() polls useCoachingStore.isSpeaking every 250ms rather than hooking into AudioQueue internals — avoids coupling to private AudioQueue state"
  - "bleStatus 'failed' mapped to 'disconnected' for MetricDisplay prop (pre-existing latent type mismatch fixed as Rule 1 deviation)"
metrics:
  duration_minutes: 25
  completed_date: "2026-04-10"
  tasks_completed: 2
  tasks_total: 3
  files_changed: 5
---

# Phase 2 Plan 04: Post-Session Debrief and Summary Card Summary

**One-liner:** Post-session coaching loop closure: voice debrief via LLM streaming + TTS, coach memory parsed from `---COACH_MEMORY---` separator, session + memory persisted to Supabase, summary card shown after debrief.

## What Was Built

### StrokeProcessor — accumulated averages (stroke-processor.ts)

Added four session-wide accumulator fields (`totalSplitMs`, `totalWatts`, `totalStrokeRate`, `readingCount`) incremented in every `processReading()` call. Added `getAccumulatedAvgs()` returning true session averages from all readings (not just the 20-reading sliding window). `reset()` clears all accumulators.

### SessionPhase extended (session-store.ts)

`SessionPhase` type extended from `'idle' | 'active' | 'ending'` to include `'debriefing'`. No action changes — `endSession()` still resets to `'idle'`, but lifecycle controls when it is called.

### useSessionLifecycle — debrief + persistence (useSessionLifecycle.ts)

`confirmEnd()` rewritten per RESEARCH.md Pitfall 5:
1. Calls `strokeProcessor.getAccumulatedAvgs()` for true session averages
2. Transitions to `'debriefing'` phase (NOT `endSession()`)
3. Calls `startDebrief()` and `setSessionSummary()` on coaching store
4. Fires `runDebriefFlow()` async (fire-and-forget)

`runDebriefFlow()`:
- Streams `/api/coach` with `intent: 'debrief'`
- Buffers full SSE response text
- Splits on `---COACH_MEMORY---` separator: spoken text → TTS, JSON part → `writeCoachMemory()`
- Streams TTS via `/api/tts` and plays chunks via `audioQueue.playChunk()`
- Waits for audio to finish, then calls `completeDebrief(spokenText)`
- Fire-and-forget: `writeSession()` + `writeCoachMemory()` after `supabase.auth.getUser()`
- If debrief fails: calls `completeDebrief('')` so summary card still shows

New `completeSession()` export: `stopAll()` + `endSession()` + `resetCoachingState()` + `strokeProcessor.reset()` + `cueRouter.reset()`

Idle check interval still guards `currentPhase === 'active'` only.

### SessionSummaryCard (SessionSummaryCard.tsx)

New component rendered as fixed overlay after debrief completes:
- Reads `sessionSummary` and `debriefText` from `useCoachingStore`
- Stats grid: Duration (MM:SS), Distance (Xm), Avg Split (M:SS/500m), Avg Watts, Avg Rate (spm)
- Shows coach debrief excerpt in italic if `debriefText` is set
- "Done" button calls `onDone` prop

### session/page.tsx — debrief UI integration

- Reads `sessionPhase` and `debriefComplete` from stores
- Gets `completeSession` from updated `useSessionLifecycle()` return
- `debriefing` phase: keeps MetricDisplay + CoachingIndicator visible, hides MidSessionControls
- Shows `SessionSummaryCard` when `sessionPhase === 'debriefing' && debriefComplete`
- `handleDone`: calls `completeSession()` then `router.push('/checkin')`
- All 4 session phases handled: idle, active, ending, debriefing

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed bleStatus 'failed' prop type mismatch**
- **Found during:** Task 2 TypeScript check
- **Issue:** `BleStatus` from session-store includes `'failed'` but `MetricDisplay.bleStatus` prop only accepts `'disconnected' | 'connecting' | 'connected' | 'reconnecting'`. Pre-existing latent error exposed when TypeScript checked the updated page.
- **Fix:** Map `bleStatus === 'failed'` to `'disconnected'` before passing to `MetricDisplay` — semantically correct (failed = no connection).
- **Files modified:** `src/app/session/page.tsx`
- **Commit:** 26619b4

## Known Stubs

None. All data sources are wired: session summary from `strokeProcessor.getAccumulatedAvgs()`, debrief text from LLM streaming response, Supabase writes fire-and-forget after auth.

## Threat Flags

No new threat surface beyond what was modeled in the plan's threat register (T-02-14, T-02-15, T-02-16).

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | af681b3 | feat(02-04): extend session store + lifecycle for debrief + persistence |
| Task 2 | 26619b4 | feat(02-04): add SessionSummaryCard and wire debrief UI into session page |

## Self-Check: PASSED

All files exist. All commits present (af681b3, 26619b4). Build exit 0.
