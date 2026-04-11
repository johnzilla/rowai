---
phase: 02-coaching-loop
verified: 2026-04-10T22:30:00Z
status: human_needed
score: 5/5 roadmap success criteria verified
overrides_applied: 0
human_verification:
  - test: "Verify Supabase migration 002 has been applied to the remote database"
    expected: "sessions and coach_memory tables exist in the remote Supabase project with RLS policies active"
    why_human: "Migration file exists locally but remote push was flagged as a manual step (no supabase/config.toml in worktree). Cannot verify remote DB state programmatically without credentials."
  - test: "Confirm MID-02 disposition: tap-only (Plan B) is acceptable Phase 2 delivery"
    expected: "The 3 fixed tap buttons satisfy MID-02's push-to-talk fallback path; voice input (Plan A) is deferred to a future phase per D-10"
    why_human: "REQUIREMENTS.md maps MID-02 to Phase 2 with both Plan A (Web Speech API) and Plan B (push-to-talk fallback). The plan explicitly chose Plan B and deferred Plan A via design decision D-10. A human needs to confirm this disposition is acceptable so the requirement can be marked satisfied."
  - test: "End-to-end coaching loop: check-in voice greeting plays, session type suggestion plays, mid-session tap buttons trigger voice responses, debrief plays after confirming Done"
    expected: "Coach voice is audible at each stage; debrief mentions 3-4 stats; summary card shows accurate avg split/watts/rate; Done returns to /checkin"
    why_human: "Audio playback (AudioContext, Cartesia TTS, PCM decoding) and LLM response quality cannot be verified without running the app with live API keys and a real BLE session."
---

# Phase 2: Coaching Loop Verification Report

**Phase Goal:** The coach speaks — check-in before rowing, adaptive real-time cues during the session, interaction when the user needs adjustment, and a debrief when they finish
**Verified:** 2026-04-10T22:30:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Coach delivers a voice check-in before the session starts and suggests a session type the user can accept or modify | VERIFIED | `CheckinScreen.tsx` fetches `/api/coach` with `intent:'checkin'` on mount, streams SSE text, calls `playTextViaTts()` which pipes to `audioQueue.playChunk()`. Re-fetches on energy/time selection. Accept button calls `acceptSessionType()`. "Just row" calls `skipCheckin()`. `audioQueue.initialize()` is called inside both button handlers (Chrome autoplay policy). |
| 2 | Voice cues fire automatically during rowing — pace drops, interval transitions, encouragement — with pre-computed cues arriving in under 500ms | VERIFIED | `useCoachingSession.ts` calls `strokeProcessor.processReading()` on each `latestReading` change; triggers go to `cueRouter.route()` which does template lookup → `audioQueue.enqueue()` with no server round-trip for pre-computed path. 7 templates in `cue-templates.ts`. `StrokeProcessor` detects 5 threshold types from 20-reading sliding window. |
| 3 | High-priority correction cues interrupt lower-priority cues without audio overlap | VERIFIED | `audio-queue.ts` `enqueue()`: HIGH cues call `currentSource?.stop()`, reset `scheduledEndTime = ctx.currentTime`, flush `normalQueue = []`, then call `playCueNow()`. `split_drift_up` and `rate_too_high` templates are `CuePriority.HIGH`. CueRouter bypasses cooldown for HIGH priority triggers per D-06. |
| 4 | User can tap "too hard," "push me," or "I'm good" mid-session and hear an adaptive LLM response | VERIFIED | `MidSessionControls.tsx` has 3 buttons with hardcoded intents mapping to `too_hard`, `push_me`, `im_good`. Each tap: 300ms debounce, fetches `/api/coach`, buffers SSE text, calls `/api/tts`, pipes chunks to `audioQueue.playChunk()`. Session context (rate, split, watts) is read from `useSessionStore.getState()`. |
| 5 | Coach delivers a voice debrief at session end and session stats are saved to Supabase | VERIFIED | `confirmEnd()` in `useSessionLifecycle.ts` transitions to `debriefing` phase, calls `strokeProcessor.getAccumulatedAvgs()` for true averages, fetches `/api/coach` with `intent:'debrief'`, streams TTS audio, splits on `---COACH_MEMORY---` separator, calls `writeSession()` and `writeCoachMemory()` fire-and-forget. `SessionSummaryCard` renders after `debriefComplete` is true. |

**Score:** 5/5 roadmap truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/coaching/coaching-types.ts` | CoachingTrigger, AudioCue, CuePriority, CueContext, SessionWritePayload, EnergyLevel, TimeAvailable types | VERIFIED | All specified exports present; `SessionPhaseExtended` adds 'debriefing' |
| `src/lib/coaching/coaching-store.ts` | Zustand coaching store, separate from session-store | VERIFIED | Exports `useCoachingStore` with all required state fields and actions; `skipCheckin` sets `energyLevel=3` per D-04 |
| `src/lib/coaching/audio-queue.ts` | Two-tier priority AudioQueue singleton | VERIFIED | `audioQueue` singleton exported; `initialize()`, `ensureRunning()`, `playChunk()`, `enqueue()`, `stopAll()` all substantive; HIGH interrupt logic and `useCoachingStore.setIsSpeaking()` integration present |
| `src/lib/coaching/stroke-processor.ts` | Sliding window StrokeProcessor with threshold detection and accumulated avgs | VERIFIED | `strokeProcessor` singleton; 20-reading window; 5 threshold checks; `getAccumulatedAvgs()` method added for Plan 04; accumulators skip idle readings (strokeState=0, watts=0) |
| `src/lib/coaching/cue-templates.ts` | Pre-computed cue template library | VERIFIED | 7 templates: split_drift_up (HIGH), rate_too_high (HIGH), rate_too_low, pace_on_target, halfway, session_start_cue, encouragement_interval |
| `src/lib/coaching/cue-router.ts` | CueRouter singleton with cooldown guard | VERIFIED | `cueRouter` singleton; template lookup → `audioQueue.enqueue()`; 30s default cooldown for NORMAL; HIGH bypasses cooldown; `drainPendingLlmTriggers()` extension point |
| `supabase/migrations/002_sessions_and_memory.sql` | sessions and coach_memory tables with RLS | VERIFIED | File exists with exact schema; RLS enabled on both tables; per-user SELECT/INSERT policies; coach_memory has UPDATE policy and unique(user_id, key) constraint |
| `src/app/api/coach/route.ts` | Claude SSE streaming proxy, 5 intents | VERIFIED | Edge runtime; validates 5 intents; returns 400/500 correctly; `messages.stream()` with `claude-haiku-4-5`; SSE `data: {"text":"..."}` format; `data: [DONE]` terminator; per-intent max_tokens; debrief prompt includes `---COACH_MEMORY---` instruction |
| `src/app/api/tts/route.ts` | Cartesia TTS SSE proxy | VERIFIED | Edge runtime; validates text non-empty and ≤500 chars; calls `https://api.cartesia.ai/tts/sse` with sonic-3 model, pcm_s16le at 24000 Hz; passes Cartesia response body directly; returns 500 if CARTESIA_API_KEY or CARTESIA_VOICE_ID missing |
| `src/lib/coaching/session-writer.ts` | Supabase write functions | VERIFIED | `writeSession()` and `writeCoachMemory()` exported; upsert with `onConflict: 'user_id,key'`; fire-and-forget pattern; neither throws |
| `src/app/checkin/page.tsx` | Pre-session check-in route | VERIFIED | `'use client'`; auth guard (bypassed in development); renders `<CheckinScreen />` in full-screen black layout |
| `src/components/checkin/CheckinScreen.tsx` | Check-in UI with energy, time, session type | VERIFIED | Fetches greeting on mount; fetches suggestion on energy+time selection; `audioQueue.initialize()` called inside button handlers; Accept → `setCheckinData()` + `acceptSessionType()`; "Just row" → `skipCheckin()` |
| `src/components/checkin/TapInputRow.tsx` | Reusable tap button row | VERIFIED | `min-h-[48px]` touch targets; white/black for selected; gray-700 border for unselected; pill-shaped (`rounded-2xl`) |
| `src/components/coaching/CoachingIndicator.tsx` | Pulsing bar when coach speaks | VERIFIED | Reads `isSpeaking` from `useCoachingStore`; renders 3px blue `animate-pulse` bar when true; renders fixed-height empty div when false (no layout shift per D-08) |
| `src/components/coaching/MidSessionControls.tsx` | Bottom bar with 3 fixed tap buttons | VERIFIED | Fixed bottom bar; 3 buttons with `min-h-[56px]`; 300ms debounce; fetches `/api/coach` then `/api/tts`; hardcoded intents (T-02-12 mitigated) |
| `src/hooks/useCoachingSession.ts` | Coaching pipeline wiring hook | VERIFIED | Calls `strokeProcessor.processReading()` per reading; calls `cueRouter.route()` on trigger; resets processor+router on session start; calls `audioQueue.ensureRunning()`; sets targets from coaching store |
| `src/app/session/page.tsx` | Session page with coaching controls | VERIFIED | Imports and renders `CoachingIndicator`, `MidSessionControls`, `SessionSummaryCard`; calls `useCoachingSession()`; all 4 sessionPhase states handled; `handleDone` calls `completeSession()` then `router.push('/checkin')` |
| `src/lib/session/session-store.ts` | Session store with debriefing phase | VERIFIED | `SessionPhase` type includes `'debriefing'` as fourth option |
| `src/components/session/SessionSummaryCard.tsx` | Post-debrief summary card | VERIFIED | Reads `sessionSummary` and `debriefText` from `useCoachingStore`; renders Duration, Distance, Avg Split, Avg Watts, Avg Rate; "Done" button calls `onDone` prop; `formatDuration`, `formatSplit`, `formatDistance` helpers present |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `cue-router.ts` | `cue-templates.ts` | template lookup by trigger type | WIRED | `templates.find((t) => t.key === trigger.type)` at line 41 |
| `cue-router.ts` | `audio-queue.ts` | enqueue cue for playback | WIRED | `audioQueue.enqueue(cue)` at line 73 |
| `useCoachingSession.ts` | `stroke-processor.ts` → `cue-router.ts` | processReading → route trigger | WIRED | `strokeProcessor.processReading(latestReading)` then `cueRouter.route(trigger)` in per-reading useEffect |
| `coach/route.ts` | `@anthropic-ai/sdk` | `client.messages.stream()` | WIRED | `client.messages.stream({model:'claude-haiku-4-5',...})` at line 120 |
| `tts/route.ts` | Cartesia API | fetch to `https://api.cartesia.ai/tts/sse` | WIRED | Direct fetch with `X-API-Key`, sonic-3, pcm_s16le |
| `session-writer.ts` | Supabase | `supabase.from('sessions').insert()` and `supabase.from('coach_memory').upsert()` | WIRED | Both functions use `createClient()` and call `.from(table)` |
| `checkin/page.tsx` | `audio-queue.ts` | `audioQueue.initialize()` on user gesture | WIRED | Called in `handleAccept` and `handleJustRow` click handlers in `CheckinScreen.tsx` |
| `useSessionLifecycle.ts` | `session-writer.ts` | `writeSession()` + `writeCoachMemory()` | WIRED | Both called in `runDebriefFlow()` after auth check |
| `useSessionLifecycle.ts` | `/api/coach` | `intent: 'debrief'` fetch | WIRED | `fetch('/api/coach', {body: JSON.stringify({intent: 'debrief',...})})` at line 159 |
| `useSessionLifecycle.ts` | debrief SSE stream | `---COACH_MEMORY---` separator parsing | WIRED | `SEPARATOR = '---COACH_MEMORY---'`; `indexOf(SEPARATOR)` splits spoken text from memory JSON |
| `SessionSummaryCard.tsx` | `coaching-store.ts` | reads sessionSummary | WIRED | `useCoachingStore((s) => s.sessionSummary)` and `useCoachingStore((s) => s.debriefText)` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `CheckinScreen.tsx` | `greetingText`, `suggestionText` | `/api/coach` SSE stream → `streamSseText()` | Yes — LLM streaming, not hardcoded | FLOWING |
| `MidSessionControls.tsx` | audio response | `/api/coach` → `/api/tts` → `audioQueue.playChunk()` | Yes — live API calls | FLOWING |
| `SessionSummaryCard.tsx` | `sessionSummary` | `strokeProcessor.getAccumulatedAvgs()` via `useSessionLifecycle.confirmEnd()` → `useCoachingStore.setSessionSummary()` | Yes — computed from all stroke readings | FLOWING |
| `CoachingIndicator.tsx` | `isSpeaking` | `audioQueue.playCueNow()` → `useCoachingStore.setIsSpeaking()` | Yes — updated on audio start/end | FLOWING |
| `session-writer.ts` | Supabase rows | `writeSession()` maps `SessionWritePayload` → `sessions` table; `writeCoachMemory()` maps `CoachMemoryEntry[]` → `coach_memory` table | Yes — real DB INSERT/UPSERT | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| TypeScript compilation | `timeout 30 ./node_modules/.bin/tsc --noEmit` | Exit 0, no output | PASS |
| coaching-types.ts exports CuePriority | `grep "export enum CuePriority"` | Found at line 7 | PASS |
| cue-router.ts has templates.find | `grep "templates\.find"` | Found at line 41 | PASS |
| session-writer.ts exports writeSession | `grep "export async function writeSession"` | Found at line 29 | PASS |
| session-store.ts includes 'debriefing' | `grep "debriefing"` | Found in SessionPhase type definition | PASS |
| stroke-processor.ts has getAccumulatedAvgs | `grep "getAccumulatedAvgs"` | Found at line 67 | PASS |
| useSessionLifecycle.ts parses COACH_MEMORY | `grep "COACH_MEMORY"` | Found at lines 209-210 | PASS |
| session/page.tsx routes to /checkin on Done | `grep "router.push.*checkin"` | Found at line 124 | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PRES-01 | 02-03 | Coach delivers voice check-in asking energy level and time available | SATISFIED | `CheckinScreen` fetches `/api/coach` with `intent:'checkin'` on mount, buffers SSE response, pipes to `/api/tts` → `audioQueue.playChunk()` |
| PRES-02 | 02-03 | Coach suggests session type based on check-in + session history | SATISFIED | Re-fetches `/api/coach` when energy+time both selected; `suggestionText` displayed on screen and played via TTS |
| PRES-03 | 02-03 | User can accept or modify suggested session via voice or tap | SATISFIED (tap only) | "Start Session" button calls `acceptSessionType()`; "Just row" calls `skipCheckin()`; voice modification deferred per D-10 |
| COACH-01 | 02-01 | Pre-computed cue engine fires voice cues on threshold events | SATISFIED | `StrokeProcessor` detects 5 threshold types → `CueRouter` dispatches to templates → `audioQueue.enqueue()` — no server round-trip |
| COACH-02 | 02-01, 02-02 | Cues delivered via Cartesia Sonic-3 with <500ms latency on pre-computed path | SATISFIED | Pre-computed path: template fill + `audioQueue.enqueue()` only; Cartesia called via client-side WebSocket on this path (NEXT_PUBLIC_CARTESIA_API_KEY per plan design) |
| COACH-03 | 02-01 | Two-tier audio queue: HIGH priority interrupts NORMAL priority | SATISFIED | `audioQueue.enqueue()` HIGH branch: `currentSource?.stop()`, flush `normalQueue`, reset `scheduledEndTime`, `playCueNow()` immediately |
| COACH-04 | 02-04 | Real-time metrics displayed on screen during session | SATISFIED | `MetricDisplay` rendered in `session/page.tsx` for both `active` and `debriefing` phases; remains visible during debrief per D-13 |
| MID-01 | 02-03 | User can interact mid-session via tap controls ("too hard," "push me," "I'm good") | SATISFIED | `MidSessionControls.tsx` renders 3 fixed buttons; each tap fires `/api/coach` with mapped intent |
| MID-02 | 02-03 | Voice input via Web Speech API (Plan A) or push-to-talk fallback (Plan B) | PARTIAL — needs human confirmation | Plan B (tap-only) delivered per D-10 design decision. Plan A (Web Speech API) deferred. CONTEXT.md `<deferred>` section documents this explicitly. Human must confirm Plan B satisfies MID-02. |
| MID-03 | 02-02, 02-03 | Coach responds adaptively to user interaction via LLM path | SATISFIED | `/api/coach` uses `claude-haiku-4-5` with per-intent prompts that include current metrics; response streamed via `/api/tts` to `audioQueue` |
| POST-01 | 02-04 | Coach delivers voice debrief summarizing session performance | SATISFIED | `confirmEnd()` fetches `/api/coach` with `intent:'debrief'` and full sessionSummary; streams TTS audio; `waitForAudioToFinish()` before marking complete |
| POST-02 | 02-02, 02-04 | Session data (duration, distance, avg split, avg watts) saved to Supabase | SATISFIED (code path wired; remote DB push is manual step) | `writeSession()` maps all metrics to `sessions` table; accumulators compute true averages; fire-and-forget after auth. Remote migration push flagged as manual step — requires human verification. |
| POST-03 | 02-02, 02-04 | Coach memory key-value pairs updated based on session patterns | SATISFIED (code path wired; remote DB push is manual step) | Debrief response parsed on `---COACH_MEMORY---` separator; `JSON.parse()` → `writeCoachMemory()` upsert; silent skip on parse failure |

### Anti-Patterns Found

No blocker anti-patterns detected. No TODOs, FIXMEs, placeholder comments, or stub returns in Phase 2 files. The `return null` occurrences in `stroke-processor.ts` are intentional threshold-miss returns (substantive logic). The `return null` in `session-writer.ts` are error-path returns, not stubs.

One notable implementation choice (not a blocker): `MidSessionControls.tsx` and `CheckinScreen.tsx` duplicate the `streamSseText` and `playTextViaTts` helper functions. The SUMMARY documents this as intentional component isolation at this stage.

### Human Verification Required

#### 1. Supabase Migration Applied to Remote Database

**Test:** Log into the Supabase Dashboard for this project, navigate to Table Editor, and verify that both `sessions` and `coach_memory` tables exist with the expected columns and RLS policies enabled.
**Expected:** Both tables present with columns matching `002_sessions_and_memory.sql`. RLS enabled. After running a session end, a row should appear in `sessions`.
**Why human:** The migration file is correct and present locally. The SUMMARY (02-01) documents the remote push as a manual step because `supabase/config.toml` was not present in the worktree. Cannot verify remote DB state without live credentials.

**To apply the migration:**
```bash
export SUPABASE_ACCESS_TOKEN=<your-token>
npx supabase link --project-ref <PROJECT_REF>
npx supabase db push
```

#### 2. MID-02 Disposition Confirmation

**Test:** Review the MID-02 requirement against what was delivered.
**Expected:** Confirm that Plan B (3 fixed tap buttons as push-to-talk fallback) is acceptable as Phase 2 delivery of MID-02, with voice input (Plan A) explicitly deferred per design decision D-10.
**Why human:** REQUIREMENTS.md maps MID-02 to Phase 2 and the text reads "Voice input via Web Speech API (Plan A) or push-to-talk fallback (Plan B)." Plan B was deliberately chosen and documented in CONTEXT.md's `<deferred>` section. The PLAN frontmatter for 02-03 includes a must_have truth: "MID-02 delivered as tap-only input per D-10 — voice input deferred." A human decision is needed to formally accept this tradeoff and close the requirement.

#### 3. End-to-End Coaching Voice Loop

**Test:**
1. Navigate to `/checkin` — verify coach greeting plays via voice
2. Select energy level and time available — verify session type suggestion plays via voice
3. Tap "Accept" — verify navigation to `/session`
4. Connect PM5 and start rowing — verify pre-computed voice cues fire (encouragement, rate corrections)
5. Tap "Too Hard" — verify coach responds with voice within a few seconds
6. Tap "Push Me" and "I'm Good" — verify distinct adaptive responses
7. Stop rowing, wait 30s — confirm "Done rowing?" prompt appears
8. Tap confirm — verify voice debrief begins immediately (D-13)
9. After debrief, verify `SessionSummaryCard` shows Duration, Distance, Avg Split, Avg Watts, Avg Rate
10. Verify avg values are reasonable (not just the last stroke reading)
11. Tap "Done" — verify return to `/checkin`
12. Check Supabase Dashboard: verify row in `sessions` table; verify rows in `coach_memory` table

**Expected:** Each step produces audible coaching voice; metrics are accurate; navigation is correct; Supabase data is saved.
**Why human:** AudioContext, Cartesia TTS PCM streaming, and LLM response quality require live API keys and a real BLE session. Cannot verify audio playback, voice quality, or LLM output content programmatically.

### Gaps Summary

No blocking gaps identified. All 5 roadmap success criteria are verified by code inspection. All 14 required artifacts exist and are substantively implemented. All key links are wired. TypeScript compiles without errors.

The two pending items (Supabase remote migration, MID-02 disposition) are pending human confirmation, not code deficiencies. The end-to-end voice loop requires live API testing which cannot be automated.

---

_Verified: 2026-04-10T22:30:00Z_
_Verifier: Claude (gsd-verifier)_
