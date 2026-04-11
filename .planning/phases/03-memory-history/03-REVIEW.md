---
phase: 03-memory-history
reviewed: 2026-04-10T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - src/lib/coaching/memory-snapshot.ts
  - src/lib/coaching/offline-cache.ts
  - src/lib/coaching/session-writer.ts
  - src/app/api/coach/route.ts
  - src/app/layout.tsx
  - src/app/history/page.tsx
  - src/components/history/SessionHistoryList.tsx
  - src/components/SyncTrigger.tsx
  - src/components/checkin/CheckinScreen.tsx
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-04-10T00:00:00Z
**Depth:** standard
**Files Reviewed:** 9
**Status:** issues_found

## Summary

This phase introduces the memory snapshot pipeline (LLM context building), an offline-cache queue backed by localStorage, a session writer, the coach API route with SSE streaming, session history UI, and the checkin flow. The overall architecture is solid — the circular-dependency avoidance in `offline-cache.ts` is well-considered, SSR guards are present, and error handling is generally correct.

One critical issue was found: the `/api/coach` route does not enforce authentication. An unauthenticated caller receives a full LLM response (hitting the Anthropic API at your cost); with a valid `userId` forged through other means they could also read another user's memory snapshot. Four warnings cover a logic double-log in the flush path, a missing AbortController cleanup on component unmount, missing `isLoading` reset in an error branch, and duplicate type definitions. Three info items cover duplicated formatting helpers, a loose `as` cast, and a `console.log` in production flush code.

---

## Critical Issues

### CR-01: Unauthenticated requests reach the LLM and can probe memory snapshots

**File:** `src/app/api/coach/route.ts:154-164`

**Issue:** `supabase.auth.getUser()` is called but its result is never validated before continuing. When `user` is `null` (unauthenticated request), `memoryBlock` is simply left empty and the route proceeds to call the Anthropic API with the caller-supplied `sessionContext`. This means:

1. Any anonymous HTTP client can trigger LLM calls at your Anthropic cost.
2. If a `userId` is extracted from the session cookie of a legitimate user (or guessed), `buildMemorySnapshot` would return that user's training history to the caller without further authorization checks.

```typescript
// Current — no auth enforcement
const { data: { user } } = await supabase.auth.getUser();
let memoryBlock = '';
if (user) {
  // ... builds snapshot
}
// Continues even when user === null
```

**Fix:** Return 401 immediately when `user` is null:

```typescript
const { data: { user }, error: authError } = await supabase.auth.getUser();
if (authError || !user) {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}
```

---

## Warnings

### WR-01: Double-log in `flushPendingWrites` logs inflated counts after partial flush

**File:** `src/lib/coaching/offline-cache.ts:194-200`

**Issue:** After the per-item flush loops, the code re-reads both queues to check if they are fully drained and then logs the *original* pending counts (not the flushed counts). This fires even when the combined flush was only partial, and the logged number includes items that may still be pending. The condition `sessionsLeft === 0 && memoryLeft === 0` only holds when *all* items succeeded, but then it logs `pendingSessions.length` which is the pre-flush total — giving a misleading "flushed N sessions" message when the individual loops already logged the same thing. The net result is either a duplicate log or a confusing one.

```typescript
// Lines 196-200: fires when everything succeeded, but "flushedSessions" was
// already logged inside the per-item block above.
if (sessionsLeft === 0 && memoryLeft === 0 && (pendingSessions.length > 0 || pendingMemory.length > 0)) {
  console.log(
    `[offline-cache] flushed ${pendingSessions.length} sessions, ${pendingMemory.length} memory writes`
  );
}
```

**Fix:** Remove the combined log block entirely. The per-item loops already emit targeted logs (lines 162-164, 187-189). Alternatively, remove the per-item logs and keep only this combined one — but remove the re-read of the queues and use the already-computed `flushedSessions` / `flushedMemory` counters instead.

---

### WR-02: `suggestionAbortRef` controller not cleaned up on component unmount

**File:** `src/components/checkin/CheckinScreen.tsx:96-139`

**Issue:** The `useEffect` that fires when `selectedEnergy` / `selectedTime` change creates an `AbortController` and stores it in `suggestionAbortRef.current`. The previous controller is aborted before creating a new one (correct). However, the effect's cleanup function does not abort the *current* in-flight controller on component unmount. If the component unmounts while a fetch is in progress (e.g., user navigates away mid-request), the fetch completes and calls `setSuggestionText`, `setSuggestedSessionType`, and `setIsLoadingSuggestion` on an unmounted component — which is a React state-update-on-unmounted-component warning and can interact badly with the store.

```typescript
// Missing cleanup return in the effect
useEffect(() => {
  if (!selectedEnergy || !selectedTime) return;
  // ...
  void fetchSuggestion();
  // no cleanup returned!
}, [selectedEnergy, selectedTime, setSuggestedSessionType]);
```

**Fix:** Return a cleanup function that aborts the current controller:

```typescript
useEffect(() => {
  if (!selectedEnergy || !selectedTime) return;
  suggestionAbortRef.current?.abort();
  const controller = new AbortController();
  suggestionAbortRef.current = controller;

  const fetchSuggestion = async () => { /* ... */ };
  void fetchSuggestion();

  return () => controller.abort(); // add this
}, [selectedEnergy, selectedTime, setSuggestedSessionType]);
```

---

### WR-03: `isLoadingGreeting` not reset to `false` on non-ok response in greeting fetch

**File:** `src/components/checkin/CheckinScreen.tsx:65-69`

**Issue:** When the greeting fetch returns a non-ok status (`!res.ok`), the code sets `greetingText` to a fallback string and calls `setIsLoadingGreeting(false)` — which is correct. However, if `res.ok` is `true` but `res.body` is `null` (the `!res.body` branch), `setIsLoadingGreeting(false)` is also called — this is fine. The real gap is in the outer `catch` block (line 81): it sets `greetingText` to a fallback but also correctly calls `setIsLoadingGreeting(false)`. So this path is actually handled.

Re-examining: the issue is that if `streamSseText` throws (e.g., network drops mid-stream after `res.ok`), the `catch` at line 80 handles it. That is correct. No bug here — removing from warnings.

*Self-correction: WR-03 is a false positive. See WR-04 below.*

### WR-03: Duplicate `SessionWritePayload` and `CoachMemoryEntry` definitions

**File:** `src/lib/coaching/session-writer.ts:5-20`

**Issue:** `SessionWritePayload` and `CoachMemoryEntry` are defined locally at the top of `session-writer.ts` (lines 5-20) and also exported from `src/lib/coaching/coaching-types.ts` (lines 35-50). The types are structurally identical. The local definitions shadow the canonical ones, and `offline-cache.ts` already imports from `coaching-types.ts` (`import type { CoachMemoryEntry, SessionWritePayload } from './coaching-types'`), creating a split: some consumers use the canonical types, `session-writer.ts` uses its own. A structural mismatch introduced in either file would be invisible to the TypeScript compiler until a consumer breaks.

**Fix:** Delete the local interface definitions in `session-writer.ts` and import from `coaching-types.ts`:

```typescript
// Remove lines 5-20 (local type definitions) and add:
import type { SessionWritePayload, CoachMemoryEntry } from './coaching-types';
```

The comment above the local definitions acknowledges this as a temporary measure ("Plan 03 (wave 2) will reconcile imports once both plans complete"). Phase 3 is now complete — reconcile now.

---

### WR-04: `SessionHistoryList` fetches all sessions with no row limit

**File:** `src/components/history/SessionHistoryList.tsx:143-146`

**Issue:** The Supabase query selects all rows from `sessions` with no `.limit()` call. A user with hundreds of sessions will receive the full table scan on every history page load, held entirely in component state. This is a correctness concern (not just performance): if a user has enough sessions that the response payload exceeds Supabase's default 1 MB response limit, the query will silently return a truncated result with no error, and the UI will show incomplete history with no indication to the user.

**Fix:** Add a reasonable limit (e.g., 100) and consider adding a "load more" affordance, or at minimum cap at a value safely below Supabase's row/payload limits:

```typescript
.order('started_at', { ascending: false })
.limit(100)
```

---

## Info

### IN-01: Formatting helpers are duplicated across three files

**Files:** `src/lib/coaching/memory-snapshot.ts:6-21`, `src/components/history/SessionHistoryList.tsx:26-39`, `src/app/api/coach/route.ts:70-75`

**Issue:** `formatSplit` (split ms to `M:SS`) and `formatDuration` (seconds to `MM:SS`) are independently implemented in all three files with slight variations (e.g., `memory-snapshot.ts` calls them `formatSplitFromMs` / `formatDurationFromS`; `SessionHistoryList` calls them `formatSplit` / `formatDuration`; `route.ts` has an inline `formatSplit`). The logic is equivalent but the names and guard conditions differ slightly.

**Fix:** Extract to a shared `src/lib/coaching/format-utils.ts` and import from there. This is low-priority but will prevent divergence as the codebase grows.

---

### IN-02: Loose `as` cast when reading Supabase single-row result

**File:** `src/lib/coaching/memory-snapshot.ts:78`

**Issue:** `profileResult.data` is cast with `as ProfileRow | null`. The Supabase JS client types `.single()` results as the table row type when a schema is provided, but without a generated schema the data is typed as `unknown` or `any`. The cast is safe here because the query only selects `display_name`, but it silences TypeScript if the column name changes.

**Fix:** Either use optional chaining without the cast (`profileResult.data?.display_name ?? 'Unknown'`) or wire up Supabase type generation so the cast is verified against the actual schema.

---

### IN-03: `console.log` in production flush path

**Files:** `src/lib/coaching/offline-cache.ts:163, 189, 197`

**Issue:** `console.log` calls in `flushPendingWrites` will appear in production browser consoles. The `console.warn` calls for error conditions are appropriate; the success logs are noise for end users and can leak behavioral information (e.g., that there were pending offline writes).

**Fix:** Gate behind a `process.env.NODE_ENV === 'development'` check, or remove the success logs entirely since flush failures are already warned about.

---

_Reviewed: 2026-04-10T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
