---
phase: 02-coaching-loop
reviewed: 2026-04-10T00:00:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - src/app/api/coach/route.ts
  - src/app/api/tts/route.ts
  - src/app/checkin/page.tsx
  - src/app/session/page.tsx
  - src/components/checkin/CheckinScreen.tsx
  - src/components/checkin/TapInputRow.tsx
  - src/components/coaching/CoachingIndicator.tsx
  - src/components/coaching/MidSessionControls.tsx
  - src/components/session/SessionSummaryCard.tsx
  - src/hooks/useCoachingSession.ts
  - src/hooks/useSessionLifecycle.ts
  - src/lib/coaching/audio-queue.ts
  - src/lib/coaching/coaching-store.ts
  - src/lib/coaching/coaching-types.ts
  - src/lib/coaching/cue-router.ts
  - src/lib/coaching/cue-templates.ts
  - src/lib/coaching/session-writer.ts
  - src/lib/coaching/stroke-processor.ts
  - src/lib/session/session-store.ts
  - supabase/migrations/002_sessions_and_memory.sql
findings:
  critical: 3
  warning: 4
  info: 2
  total: 9
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-04-10
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

This is a well-structured coaching loop implementation. The separation between the stroke processor, cue router, audio queue, and Zustand stores is clean, the intent-based API design is appropriate, and the priority/cooldown system in the cue router is solid.

Three critical bugs would silently prevent the system from working in production: two SSE parsing bugs cause all LLM text to be dropped before TTS (the checkin greeting plays nothing; the debrief plays nothing), and a trigger key mismatch causes the session-start cue to never fire via the pre-computed path. A fourth issue causes session averages to be corrupted by at-rest/idle readings. These are all silent failures — no errors thrown, just wrong behavior.

---

## Critical Issues

### CR-01: SSE parser drops all text — checkin and mid-session cues never play

**File:** `src/components/checkin/CheckinScreen.tsx:273`, `src/components/coaching/MidSessionControls.tsx:139`

**Issue:** `streamSseText` checks `parsed.type === 'text_delta'` before accumulating text. But the `/api/coach` route emits `{ text: event.delta.text }` — an object with a `text` key and no `type` field at all. `parsed.type` is always `undefined`, the condition is always false, and `fullText` is always an empty string. The greeting and all mid-session cue texts are silently discarded. TTS is never fed any content; `playTextViaTts` receives `''` and returns early.

**Fix:**
```typescript
// In streamSseText — replace the inner condition with:
const parsed = JSON.parse(payload) as { text?: string };
if (parsed.text) {
  fullText += parsed.text;
}
```
Apply the same fix in both `CheckinScreen.tsx` (line 273) and `MidSessionControls.tsx` (line 139).

---

### CR-02: Debrief SSE parser drops all text — debrief TTS never plays

**File:** `src/hooks/useSessionLifecycle.ts:200`

**Issue:** The inline SSE reader inside `runDebriefFlow` checks `parsed.type === 'text'` before accumulating debrief text. The `/api/coach` route emits `{ text: ... }` with no `type` property, so `parsed.type` is always `undefined`. `fullDebriefText` is always empty. The `---COACH_MEMORY---` separator is never found; `spokenText` is `''`; TTS is skipped entirely; `completeDebrief('')` fires immediately and the summary card appears with no spoken debrief. Coach memory is never extracted.

**Fix:**
```typescript
// In runDebriefFlow — replace the inner condition with:
const parsed = JSON.parse(payload) as { text?: string };
if (parsed.text) {
  fullDebriefText += parsed.text;
}
```

---

### CR-03: Session-start cue never fires — trigger type key mismatch

**File:** `src/hooks/useCoachingSession.ts:58`, `src/lib/coaching/cue-templates.ts:54`

**Issue:** `useCoachingSession` fires a trigger with `type: 'session_start'` (line 58). The matching template in `cue-templates.ts` has `key: 'session_start_cue'` (line 54). These do not match. `cueRouter.route()` calls `templates.find((t) => t.key === trigger.type)` which returns `undefined`, so the trigger is pushed to `pendingLlmTriggers` instead of the pre-computed path. No session-start audio cue ever plays. The fix is to align the key in one of the two locations.

**Fix — Option A: change the trigger type in useCoachingSession.ts:**
```typescript
cueRouter.route({
  type: 'session_start_cue',   // was: 'session_start'
  priority: CuePriority.NORMAL,
  ...
});
```

**Fix — Option B: change the template key in cue-templates.ts:**
```typescript
{
  key: 'session_start',        // was: 'session_start_cue'
  priority: CuePriority.NORMAL,
  cooldownMs: 0,
  text: (ctx) => `Alright ${ctx.userName}, let's go. Nice and steady.`,
},
```
Either is correct; Option A is preferred since the template key is the canonical identifier.

---

## Warnings

### WR-01: Stroke processor accumulates idle/zero readings into session averages

**File:** `src/lib/coaching/stroke-processor.ts:97-100`

**Issue:** `processReading` accumulates `splitMs`, `watts`, and `strokeRate` into session totals for every reading regardless of `strokeState`. When the rower is at rest (`strokeState === 0`), the PM5 typically reports a very high split (infinity or a large sentinel value) and 0 watts. These get included in `totalSplitMs` and `totalWatts`, dragging the averages toward zero watts and inflating the average split. The `getAccumulatedAvgs()` result used for the debrief summary and Supabase write will be wrong for any session where the rower paused.

**Fix:** Guard the accumulation block on active stroke state:
```typescript
// After the window push, before accumulation:
if (reading.strokeState > 0 && reading.watts > 0) {
  this.totalSplitMs += reading.splitMs;
  this.totalWatts += reading.watts;
  this.totalStrokeRate += reading.strokeRate;
  this.readingCount++;
}
```

---

### WR-02: AudioBufferSourceNode.stop() can throw if source has already ended

**File:** `src/lib/coaching/audio-queue.ts:93`

**Issue:** `this.currentSource?.stop()` is called in `enqueue()` when a HIGH-priority cue interrupts. `AudioBufferSourceNode.stop()` throws `InvalidStateError` if the node has already reached its natural end. This is a race condition: if the last scheduled chunk finishes playing between the HIGH-priority cue being enqueued and `stop()` being called, the exception propagates out of `enqueue()` uncaught, corrupting `isSpeaking` state and potentially leaving the coaching store with `isSpeaking: true` permanently.

**Fix:**
```typescript
try {
  this.currentSource?.stop();
} catch {
  // Source already ended naturally — no action needed
}
```
Apply the same guard in `stopAll()` at line 114.

---

### WR-03: `confirmEnd` captures stale `sessionStartedAt` when called immediately after session start

**File:** `src/hooks/useSessionLifecycle.ts:109`

**Issue:** `sessionStartedAt` is read from the Zustand selector at the top of `useSessionLifecycle`. React may not re-render the hook between `startSession()` (which sets `sessionStartedAt`) and `confirmEnd()` being called. In practice this is unlikely during a real session (minutes pass), but in a very short or test session, `sessionStartedAt` could still be `null` at the time `confirmEnd` runs, causing `durationS` to be `0` and the session write to record a zero-duration session.

**Fix:** Read `sessionStartedAt` fresh from the store inside `confirmEnd`:
```typescript
const confirmEnd = () => {
  setShowEndPrompt(false);
  const now = Date.now();
  const startedAt = useSessionStore.getState().sessionStartedAt ?? now;
  const durationS = Math.round((now - startedAt) / 1000);
  // ...rest of confirmEnd
};
```

---

### WR-04: Missing `CARTESIA_VOICE_ID` sends empty voice ID to Cartesia with no warning

**File:** `src/app/api/tts/route.ts:26-29`

**Issue:** If `CARTESIA_VOICE_ID` is not set in the environment, `resolvedVoiceId` becomes an empty string `''`. This is silently sent to the Cartesia API as `{ voice: { mode: 'id', id: '' } }`. Cartesia will reject this with a 4xx error, which is then surfaced as a 502 to the client. There is no log or startup warning to indicate the variable is missing, making this a silent misconfiguration.

**Fix:** Add a guard before making the Cartesia request:
```typescript
if (!resolvedVoiceId) {
  return Response.json({ error: 'CARTESIA_VOICE_ID not configured' }, { status: 500 });
}
```

---

## Info

### IN-01: `SessionWritePayload` and `CoachMemoryEntry` are duplicated between two files

**File:** `src/lib/coaching/session-writer.ts:5-18`, `src/lib/coaching/coaching-types.ts:35-50`

**Issue:** Both types are defined identically in `session-writer.ts` (lines 5–18) and `coaching-types.ts` (lines 35–50). A comment in `session-writer.ts` explains this was intentional for wave-1 parallel plan execution, but both plans are now complete. Having two canonical definitions means a change to one requires remembering to update the other.

**Fix:** Remove the duplicate definitions from `session-writer.ts` and import from `coaching-types.ts`:
```typescript
import type { SessionWritePayload, CoachMemoryEntry } from '@/lib/coaching/coaching-types';
```

---

### IN-02: `streamSseText` / `playTextViaTts` are duplicated in two client components

**File:** `src/components/checkin/CheckinScreen.tsx:250-330`, `src/components/coaching/MidSessionControls.tsx:116-191`

**Issue:** The `streamSseText` and `playTextViaTts` helpers are copied verbatim between `CheckinScreen.tsx` and `MidSessionControls.tsx`. The comment in `MidSessionControls.tsx` line 113 acknowledges this: "duplicated from CheckinScreen for component isolation." Once CR-01 is fixed in both locations, this duplication will re-introduce the same bug risk — a future fix in one file will need to be manually replicated in the other.

**Fix:** Extract to a shared utility, e.g. `src/lib/coaching/sse-helpers.ts`, and import from both components.

---

_Reviewed: 2026-04-10_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
