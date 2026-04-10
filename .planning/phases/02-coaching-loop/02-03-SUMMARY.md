---
phase: 02-coaching-loop
plan: "03"
subsystem: ui-coaching
tags: [checkin, mid-session, coaching-pipeline, tap-controls, tts, audio-queue]
dependency_graph:
  requires: [02-01, 02-02]
  provides: [checkin-ui, mid-session-controls, coaching-hook, session-integration]
  affects: [src/app/session/page.tsx, src/app/checkin/page.tsx]
tech_stack:
  added: []
  patterns:
    - SSE streaming from /api/coach buffered to full text before TTS
    - audioQueue.initialize() called strictly inside user gesture handlers (Chrome autoplay)
    - Module-level singleton services (strokeProcessor, cueRouter, audioQueue) subscribed via useEffect
    - Zustand getState() for non-reactive reads inside async handlers
key_files:
  created:
    - src/app/checkin/page.tsx
    - src/components/checkin/CheckinScreen.tsx
    - src/components/checkin/TapInputRow.tsx
    - src/components/coaching/CoachingIndicator.tsx
    - src/components/coaching/MidSessionControls.tsx
    - src/hooks/useCoachingSession.ts
  modified:
    - src/app/session/page.tsx
decisions:
  - "audioQueue.initialize() placed inside Start Session and Just Row click handlers — required by Chrome autoplay policy, not called on mount"
  - "TTS helper functions duplicated in CheckinScreen and MidSessionControls rather than shared util — component isolation preferred at this stage"
  - "useCoachingSession fires session_start cue via cueRouter.route() which takes the LLM path since no session_start template exists — acceptable latency post-start"
  - "audioQueue.ensureRunning() in BLE connected handler wrapped in try/catch — gracefully handles case where user enters /session directly without check-in"
metrics:
  duration: "~20 min"
  completed_date: "2026-04-10"
  tasks_completed: 2
  tasks_total: 3
  files_created: 6
  files_modified: 1
---

# Phase 2 Plan 03: Check-In UI and Mid-Session Coaching Controls Summary

**One-liner:** Tap-driven check-in screen with voice greeting + session suggestion, and 3-button mid-session controls wiring the full strokeProcessor → cueRouter → audioQueue coaching pipeline.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Check-in screen and tap input components | a4ac918 | src/app/checkin/page.tsx, src/components/checkin/CheckinScreen.tsx, src/components/checkin/TapInputRow.tsx |
| 2 | Coaching indicator, mid-session controls, coaching hook, session page integration | 54f679f | src/components/coaching/CoachingIndicator.tsx, src/components/coaching/MidSessionControls.tsx, src/hooks/useCoachingSession.ts, src/app/session/page.tsx |
| 3 | Human verify check-in flow and mid-session coaching | — | CHECKPOINT: awaiting human verification |

## What Was Built

### Task 1: Check-In Screen

- **TapInputRow** (`src/components/checkin/TapInputRow.tsx`): Reusable pill-button row. Selected = white bg / black text. Unselected = gray-800 border / white text. min-h-[48px] touch targets per spec.
- **CheckinScreen** (`src/components/checkin/CheckinScreen.tsx`): Full check-in flow — streams coach greeting on mount via `/api/coach` + `/api/tts`, collects energy (1–5) and time (15/20/30/45) via tap, re-fetches suggestion when both selected, displays and plays suggestion text.
  - `audioQueue.initialize()` called exclusively inside Start Session and Just Row click handlers (Chrome autoplay policy enforced).
  - "Just row" calls `skipCheckin()` → defaults to energy=3, time=null → navigates to `/session`.
  - "Start Session" calls `setCheckinData()` + `acceptSessionType()` → navigates to `/session`.
- **checkin/page.tsx** (`src/app/checkin/page.tsx`): `'use client'` route with Supabase auth guard (T-02-11 mitigation). Loads before BLE pairing (D-01).

### Task 2: Session Page Coaching Integration

- **CoachingIndicator** (`src/components/coaching/CoachingIndicator.tsx`): 3px pulsing blue bar (`animate-pulse`) when `isSpeaking` is true. Returns fixed-height empty div when false — no layout shift (D-08).
- **MidSessionControls** (`src/components/coaching/MidSessionControls.tsx`): Fixed bottom bar with 3 buttons: "Too Hard", "Push Me", "I'm Good". Each tap: 300ms debounce (T-02-13), POST to `/api/coach` with hardcoded intent (T-02-12), SSE response buffered, piped through `/api/tts` to `audioQueue.playChunk()` (MID-01, D-09, D-10, D-12).
- **useCoachingSession** (`src/hooks/useCoachingSession.ts`): Wires per-stroke pipeline: `strokeProcessor.processReading(reading)` → `cueRouter.route(trigger)`. On session start: resets processor+router (Pitfall 3), calls `audioQueue.ensureRunning()`, sets targets from coaching store, fires `session_start` trigger via cueRouter.
- **session/page.tsx** updated: imports and renders CoachingIndicator above MetricDisplay, MidSessionControls below, calls `useCoachingSession()`, adds `audioQueue.ensureRunning()` on BLE connect event.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all components have real data sources wired. No hardcoded placeholder values that affect functionality.

## Threat Flags

No new security surface introduced beyond what is documented in the plan's threat model (T-02-11, T-02-12, T-02-13 all mitigated per plan).

## Self-Check

- [x] `src/app/checkin/page.tsx` — created, contains CheckinScreen
- [x] `src/components/checkin/CheckinScreen.tsx` — created, exports CheckinScreen
- [x] `src/components/checkin/TapInputRow.tsx` — created, exports TapInputRow
- [x] `src/components/coaching/CoachingIndicator.tsx` — created, exports CoachingIndicator
- [x] `src/components/coaching/MidSessionControls.tsx` — created, exports MidSessionControls
- [x] `src/hooks/useCoachingSession.ts` — created, exports useCoachingSession
- [x] `src/app/session/page.tsx` — updated with coaching imports and components
- [x] Build: `npx next build` passes cleanly, /checkin route appears in output
- [x] Commit a4ac918 — Task 1
- [x] Commit 54f679f — Task 2
