---
phase: 01-foundation
plan: 03
subsystem: session-ui
tags: [session, ble, metrics, wake-lock, react, zustand, typescript, next-js]

# Dependency graph
requires:
  - "01-01 (auth scaffold, supabase client)"
  - "01-02 (pm5Service, useSessionStore, wakeLockManager, StrokeReading type)"
provides:
  - "useSessionLifecycle: auto-start on first stroke (D-08), 30s idle detection (D-09), no-pause dismiss (D-10)"
  - "BleConnectButton: rationale screen + Chrome BLE dialog trigger (D-06), plain-text status (D-07)"
  - "MetricDisplay: split time text-8xl centered primary, SPM/W secondaries, elapsed+distance progress bar (D-01,D-02,D-03)"
  - "SessionEndPrompt: Done rowing? overlay with Continue/End Session after 30s idle (D-09)"
  - "session/page.tsx: assembled session page — auth guard, BLE events wired, wake lock, cleanup"
affects:
  - "Phase 2 coaching engine (will import useSessionStore latestReading and sessionStartedAt)"
  - "Phase 2 session persistence (endSession should trigger Supabase write)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "useEffect + setInterval for idle polling — 5s tick, 30s threshold, clears on unmount"
    - "useRef for last-stroke timestamp — avoids stale closure in effect callbacks"
    - "setupStoreListeners called once via ref flag — prevents double-binding on StrictMode remount"
    - "addEventListener/removeEventListener on pm5Service (EventTarget) for wake lock wiring"
    - "Belt-and-suspenders auth guard: middleware + page-level getUser() check (T-03-04)"

key-files:
  created:
    - "src/hooks/useSessionLifecycle.ts"
    - "src/components/ble/BleConnectButton.tsx"
    - "src/components/metrics/MetricDisplay.tsx"
    - "src/components/session/SessionEndPrompt.tsx"
    - "src/app/session/page.tsx"
  modified: []

key-decisions:
  - "Wake Lock wired to pm5Service 'connected' event (not to bleStatus Zustand state) — avoids async race between store update and acquire() call"
  - "5s polling interval for idle detection (not 1s) — reduces CPU overhead during session; 30s threshold makes 5s granularity acceptable"
  - "setupStoreListeners called via useRef flag — prevents double event listener registration in React StrictMode (which unmounts/remounts effects)"
  - "MetricDisplay derives elapsed time from sessionStartedAt (not PM5 elapsedTimeMs) — PM5 timer resets on power cycle; app timer is authoritative"

# Metrics
duration: 20min
completed: 2026-04-10
---

# Phase 1 Plan 3: Session UI — Summary

**Status: PARTIAL — Tasks 1 and 2 complete. Task 3 (checkpoint:human-verify) reached — awaiting end-to-end hardware verification.**

Session page assembled: rationale screen → Chrome BLE dialog → live metrics (split/SPM/watts) → auto-start on first stroke → 30s idle end prompt → BLE disconnect recovery UI.

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-04-10T02:59:00Z
- **Tasks:** 2/3 complete (Task 3 is checkpoint:human-verify)
- **Files created:** 5

## Accomplishments

### Task 1: Session lifecycle hook + BLE connect button + metrics display

- `useSessionLifecycle` hook: auto-starts session on first non-idle strokeState (D-08), polls every 5s to detect 30s of no strokes (D-09), dismisses end prompt automatically when user rows again (D-10)
- `BleConnectButton`: shows rationale card ("RowAI reads your PM5 data in real time over Bluetooth...") before calling pm5Service.connect() — rationale is shown BEFORE Chrome BLE dialog (D-06). Status text is plain text only with no animation classes (D-07).
- `MetricDisplay`: split time in text-8xl centered (D-01, D-02), SPM and W secondaries below, elapsed time and distance in top bar (D-03). Placeholder dashes when no reading.
- `SessionEndPrompt`: "Done rowing?" overlay with Continue (dismissEnd) and End Session (confirmEnd) buttons (D-09). Backdrop click also dismisses.

### Task 2: Session page assembly

- Auth guard on mount via `supabase.auth.getUser()` — redirects to /login if no session (T-03-04 belt-and-suspenders)
- `setupStoreListeners` called once per mount via `useRef` flag — wires pm5Service events to Zustand
- Wake Lock acquired on pm5Service 'connected' event; `bindVisibilityChange` bound once per mount (BLE-03)
- `BleConnectButton` always visible in header for status; `MetricDisplay` shown when connected/reconnecting
- Cleanup on unmount: `pm5Service.disconnect()` + `wakeLockManager.release()`

## Task Commits

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Session lifecycle hook, BLE connect button, metric display, end prompt | `20e560c` |
| 2 | Session page assembly — BLE, metrics, lifecycle, wake lock wired | `452f395` |

## Files Created

- `src/hooks/useSessionLifecycle.ts` — auto-start D-08, idle detection D-09, no-pause D-10
- `src/components/ble/BleConnectButton.tsx` — rationale screen D-06, plain text status D-07
- `src/components/metrics/MetricDisplay.tsx` — split time primary D-01, secondaries D-02, progress bar D-03
- `src/components/session/SessionEndPrompt.tsx` — "Done rowing?" prompt D-09
- `src/app/session/page.tsx` — assembled session page with auth guard, wake lock, cleanup

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written. Minor implementation choices noted:

**1. [Rule 2 — Missing guard] Added removeEventListener for connected handler in session page**
- **Found during:** Task 2
- **Issue:** Plan spec showed addEventListener for 'connected' but did not explicitly mention removeEventListener. Without cleanup, the handler would persist after unmount and could trigger acquire() on a stale component.
- **Fix:** Added removeEventListener in the effect cleanup function alongside pm5Service.disconnect().
- **Commit:** 452f395

## Verification Results

- `npx tsc --noEmit` — exits 0, zero TypeScript errors
- `npm run build` — exits 0, all 6 routes compiled successfully (/session route included)
- `npx vitest run` — 26 tests pass (all parser tests from Plan 02 intact)
- Human verification (Task 3 checkpoint) — PENDING

## Known Stubs

None — all data flows are wired to real sources:
- Metrics come from `latestReading` (Zustand store, driven by pm5Service GATT events)
- Elapsed time derived from `sessionStartedAt` (set by `startSession()` action in Zustand)
- BLE status comes from `bleStatus` (Zustand store, updated by setupStoreListeners)

## Phase 1 Success Criteria Status

| Criterion | Status | Evidence |
|-----------|--------|---------|
| ONBD-01: Sign up/log in | ✓ (Plan 01) | signup/login pages with Supabase auth |
| ONBD-02: Onboarding persists | ✓ (Plan 01) | user_profile table, onboarding page |
| ONBD-03: Session persists across refresh | ✓ (Plan 01) | middleware calls getUser() every request |
| BLE-01: Pair PM5 via Web Bluetooth | ✓ (Plan 02+03) | pm5Service.connect() in BleConnectButton |
| BLE-02: Live metrics | ✓ (Plan 02+03) | GATT pipeline → Zustand → MetricDisplay |
| BLE-03: Screen awake during session | ✓ (Plan 02+03) | wakeLockManager.acquire() on connect event |
| BLE-04: Announce disconnect | ✓ (Plan 02+03) | "Connection lost — reconnecting..." status |
| BLE-05: Auto-reconnect every 30s | ✓ (Plan 02+03) | PM5Service scheduleReconnect() |
| D-08: Auto-start on first stroke | ✓ (Plan 03) | useSessionLifecycle strokeState > 0 trigger |
| D-09: 30s idle end prompt | ✓ (Plan 03) | useSessionLifecycle setInterval + SessionEndPrompt |

All Phase 1 success criteria are implemented. Hardware verification (Task 3 checkpoint) will confirm they work against a real PM5.

## Notes for Phase 2

- The coaching engine should subscribe to `useSessionStore` for `latestReading` — all fields (splitMs, strokeRate, watts, distanceMeters, elapsedTimeMs) are available
- `sessionStartedAt` (epoch ms) is the authoritative session start time — use for duration calculations
- `endSession()` currently only resets Zustand state — Phase 2 needs to add Supabase write-back in `confirmEnd` handler or via a `useEffect` on `isSessionActive` changing to false
- Byte offsets in `pm5-constants.ts` are still marked `[ASSUMED]` — hardware test in Task 3 checkpoint will determine if corrections are needed
- `sessionPhase` ('idle' | 'active' | 'ending') is available in Zustand for the coaching engine to know when to start/stop generating cues

## Threat Surface Scan

No new network endpoints, auth paths, or server-side file access introduced. All new surface is client-side React components consuming the BLE/Zustand/WakeLock layer built in Plan 02.

| Mitigation | Implementation |
|-----------|----------------|
| T-03-01 Spoofing (BLE connect) | pm5Service.connect() called from onClick (user gesture); requestDevice filtered by PM5_SERVICE_UUID |
| T-03-04 EoP (session page auth) | middleware (proxy.ts) + page-level getUser() double guard |

## Self-Check: PASSED

- `src/hooks/useSessionLifecycle.ts` exists: YES
- `src/components/ble/BleConnectButton.tsx` exists: YES
- `src/components/metrics/MetricDisplay.tsx` exists: YES
- `src/components/session/SessionEndPrompt.tsx` exists: YES
- `src/app/session/page.tsx` exists: YES
- Commit `20e560c` exists: YES
- Commit `452f395` exists: YES
- `npx tsc --noEmit` exits 0: YES
- `npm run build` exits 0: YES
- 26 vitest tests pass: YES
