---
phase: 01-foundation
verified: 2026-04-10T03:11:14Z
status: gaps_found
score: 12/14 must-haves verified
overrides_applied: 0
gaps:
  - truth: "App announces BLE disconnect and attempts automatic reconnect; session can continue in timer fallback mode"
    status: failed
    reason: "The app announces disconnect ('Connection lost — reconnecting...') and attempts reconnect correctly, but no timer fallback mode exists. When BLE disconnects, the MetricDisplay freezes on last reading — there is no elapsed-time-only mode that continues counting while BLE is unavailable. BLE-04 in REQUIREMENTS.md explicitly requires 'announces fallback to timer mode'; ROADMAP SC #5 explicitly requires 'session can continue in timer fallback mode'."
    artifacts:
      - path: "src/components/ble/BleConnectButton.tsx"
        issue: "Shows 'Connection lost — reconnecting...' text but provides no timer mode fallback"
      - path: "src/components/metrics/MetricDisplay.tsx"
        issue: "Freezes on last StrokeReading when BLE disconnects — no elapsed timer continues independently"
      - path: "src/hooks/useSessionLifecycle.ts"
        issue: "No timer-based elapsed tracking that continues without BLE readings"
    missing:
      - "A timer fallback mode: when bleStatus === 'reconnecting', MetricDisplay or a sibling component should continue counting elapsed time from sessionStartedAt so the user can see the session continuing without live BLE data"
      - "UI indication that elapsed time is from internal timer (not PM5) while BLE is reconnecting"
  - truth: "User completes onboarding (name, experience level, coaching tone, injuries) and data persists"
    status: partial
    reason: "ROADMAP SC #2 lists 'name, experience level, coaching tone, injuries' but REQUIREMENTS.md ONBD-02 explicitly qualifies: 'name (experience level, coaching tone, injuries collected progressively after first session per D-04)'. The name-only onboarding is CORRECT per ONBD-02 and D-04. However, the ROADMAP success criterion text is a genuine wording inconsistency. Marking partial because the implementation satisfies the authoritative REQUIREMENTS.md/ONBD-02 spec but does not match the literal ROADMAP SC wording. Developer should confirm intent and optionally update ROADMAP SC wording."
    artifacts:
      - path: "src/app/onboarding/page.tsx"
        issue: "Collects name only — correct per ONBD-02 and D-04, but ROADMAP SC #2 mentions experience level, coaching tone, injuries"
    missing:
      - "ROADMAP.md SC #2 should be updated to match ONBD-02 wording: 'User completes onboarding (name only per D-04) and data persists' — or confirm that deferred fields are intentional and the ROADMAP SC is a known documentation inconsistency"
human_verification:
  - test: "End-to-end session with physical PM5: sign up, onboard, connect PM5, row, see live metrics"
    expected: "Split time large and centered, SPM and watts below, elapsed time and distance at top, all updating in real time from PM5 GATT notifications"
    why_human: "Requires physical Concept2 PM5 hardware and Chrome Android or Chrome desktop with BLE. Cannot verify GATT byte offsets (marked ASSUMED in pm5-constants.ts) without hardware. Cannot verify notification timing or data correctness without a real device."
  - test: "BLE disconnect recovery: disconnect PM5 mid-session, observe reconnect behavior"
    expected: "Status changes to 'Connection lost — reconnecting...', reconnect attempted after 30s, successful reconnect restores live metrics"
    why_human: "Requires physical PM5 to test gattserverdisconnected event and actual 30s reconnect timer behavior"
  - test: "Session auto-start: row a few strokes and verify session starts automatically without a button press (D-08)"
    expected: "First non-idle stroke transitions sessionPhase from 'idle' to 'active' and starts the elapsed timer"
    why_human: "Requires physical PM5 to produce strokeState > 0 readings"
  - test: "Session auto-end: stop rowing for 35s and verify 'Done rowing?' prompt appears (D-09)"
    expected: "Prompt appears after 30s idle; 'Continue' dismisses it; 'End Session' ends the session"
    why_human: "Requires physical PM5 to produce strokeState = 0 readings for 30s"
  - test: "Screen Wake Lock: lock screen mid-session on Android, verify BLE stays connected on unlock"
    expected: "Wake lock prevents screen sleep; on visibility restore, wake lock is re-acquired"
    why_human: "Requires Android device and physical PM5; Wake Lock behavior is device and OS dependent"
---

# Phase 1: Foundation Verification Report

**Phase Goal:** A logged-in user can pair their PM5 over BLE and see live rowing data in a stable PWA session
**Verified:** 2026-04-10T03:11:14Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | User can sign up with email and password and land on the onboarding screen | VERIFIED | `src/app/(auth)/signup/page.tsx` calls `supabase.auth.signUp()` and redirects to `/onboarding` on success |
| 2 | User can log in with existing credentials and be redirected to the app | VERIFIED | `src/app/(auth)/login/page.tsx` calls `signInWithPassword()` and redirects to `/session` |
| 3 | User session survives browser refresh — reopening the app keeps the user logged in | VERIFIED | `src/proxy.ts` exports `proxy()` which calls `updateSession()` from `src/lib/supabase/middleware.ts`; Next.js 16 recognizes `proxy.ts` as middleware (confirmed by `ƒ Proxy (Middleware)` in build output) |
| 4 | Onboarding collects name only (per D-04), writes a user_profile row, and marks onboarding_complete=true | VERIFIED | `src/app/onboarding/page.tsx` upserts `{ id, name, onboarding_complete: true, coaching_tone: 'calm_supportive' }` — no experience_level, injuries, or tone selection fields |
| 5 | Login and signup pages are accessible at /login and /signup respectively | VERIFIED | Files exist at `src/app/(auth)/login/page.tsx` and `src/app/(auth)/signup/page.tsx`; build confirms `○ /login` and `○ /signup` as static routes |
| 6 | PM5Service.connect() triggers Chrome BLE device chooser (from a user gesture) | VERIFIED | `BleConnectButton.tsx` calls `pm5Service.connect()` in `onClick` handler; `pm5-service.ts` calls `navigator.bluetooth.requestDevice()` filtered by `PM5_SERVICE_UUID` |
| 7 | GATT notifications produce typed StrokeReading objects with all required fields | VERIFIED | `pm5-service.ts` subscribes to 3 characteristics; `pm5-parser.ts` decodes elapsedTimeMs, distanceMeters, strokeState, strokeRate, splitMs, watts; 13 Vitest tests pass |
| 8 | gattserverdisconnected fires reconnect with 30s intervals — up to 3 attempts | VERIFIED | `pm5-service.ts` registers `gattserverdisconnected` listener; `RECONNECT_INTERVAL_MS = 30000`, `MAX_RECONNECT_ATTEMPTS = 3`, `scheduleReconnect()` implemented |
| 9 | WakeLockManager.acquire() holds a WakeLockSentinel and re-acquires it on visibilitychange | VERIFIED | `wake-lock-manager.ts` calls `navigator.wakeLock.request('screen')`, stores sentinel, binds `visibilitychange` listener in `bindVisibilityChange()` |
| 10 | Zustand session-store exports BLE status and live StrokeReading | VERIFIED | `session-store.ts` exports `useSessionStore` with `bleStatus` ('disconnected'\|'connecting'\|'connected'\|'reconnecting'\|'failed') and `latestReading: StrokeReading \| null` |
| 11 | Logged-in user sees rationale screen then taps Connect which opens the Chrome BLE device chooser | VERIFIED | `BleConnectButton.tsx` shows rationale card when `bleStatus === 'disconnected'` with "Connect PM5" button that calls `pm5Service.connect()` |
| 12 | Live metrics appear: split time large and centered, SPM/watts/distance smaller below | VERIFIED | `MetricDisplay.tsx` uses `text-8xl` for split, `text-3xl` for SPM/watts secondary row, `/500m` label; distance shown in top bar |
| 13 | App announces BLE disconnect and attempts automatic reconnect; session can continue in timer fallback mode | FAILED | Disconnect is announced ("Connection lost — reconnecting...") and reconnect is attempted every 30s, but no timer fallback mode exists. MetricDisplay freezes on last reading — no elapsed time continues independently during BLE outage. BLE-04 requirement text and ROADMAP SC #5 both explicitly require "timer fallback mode". |
| 14 | User completes onboarding (name, experience level, coaching tone, injuries) and data persists | PARTIAL | Onboarding collects name only, which is CORRECT per REQUIREMENTS.md ONBD-02 ("name (experience level, coaching tone, injuries collected progressively after first session per D-04)"). ROADMAP SC #2 wording inconsistently omits the D-04 qualifier — this is a documentation gap, not an implementation gap. Marking partial to flag for developer confirmation. |

**Score:** 12/14 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/lib/supabase/client.ts` | Browser Supabase client (createBrowserClient) | VERIFIED | Exports `createClient()` using `createBrowserClient` from `@supabase/ssr` |
| `src/lib/supabase/server.ts` | Server Supabase client for route handlers | VERIFIED | Exports `createServerClient()` with cookie handlers using `next/headers` |
| `src/proxy.ts` | Cookie refresh middleware (plan specified src/middleware.ts) | VERIFIED (with note) | Deployed as `src/proxy.ts` per Next.js 16 convention (PROXY_FILENAME = 'proxy' in Next.js constants). Build confirms `ƒ Proxy (Middleware)`. Calls `updateSession()` which refreshes auth token and protects `/session` and `/onboarding`. |
| `src/app/(auth)/signup/page.tsx` | Email/password signup form — ONBD-01 | VERIFIED | Calls `supabase.auth.signUp()`, redirects to `/onboarding` |
| `src/app/onboarding/page.tsx` | Name collection form — ONBD-02 (D-04 minimal friction) | VERIFIED | Single name field, upserts `user_profile` with `onboarding_complete: true` |
| `supabase/migrations/001_initial_schema.sql` | user_profile table with RLS | VERIFIED | Contains `enable row level security`, `auth.uid() = id` policy, `coaching_tone text not null default 'calm_supportive'` |
| `src/lib/ble/pm5-constants.ts` | PM5 GATT UUIDs and byte offset constants | VERIFIED | Exports `PM5_SERVICE_UUID`, `PM5_ROWING_STATUS_UUID`, `PM5_EXTRA_STATUS1_UUID`, `PM5_EXTRA_STATUS2_UUID` |
| `src/lib/ble/pm5-parser.ts` | DataView → StrokeReading decoder with range validation | VERIFIED | Exports `StrokeReading`, `parseRowingGeneralStatus`, `parseExtraStatus1`, `parseExtraStatus2`, `validateStrokeReading` with `RangeError` |
| `src/lib/ble/pm5-service.ts` | PM5Service class: connect, reconnect, characteristic subscriptions | VERIFIED | Exports `PM5Service`, `pm5Service` singleton, `setupStoreListeners`; `RECONNECT_INTERVAL_MS = 30000`, `MAX_RECONNECT_ATTEMPTS = 3`, `gattserverdisconnected` listener |
| `src/lib/wake-lock/wake-lock-manager.ts` | WakeLockManager: acquire, release, visibilitychange binding | VERIFIED | Exports `WakeLockManager`, `wakeLockManager` singleton; `acquire()`, `release()`, `bindVisibilityChange()` |
| `src/lib/session/session-store.ts` | Zustand store: bleStatus, latestReading, sessionPhase, isSessionActive | VERIFIED | Exports `useSessionStore` with all required state fields and actions |
| `src/hooks/useSessionLifecycle.ts` | Auto-start on stroke, auto-end detection, 30s idle timer | VERIFIED | Exports `useSessionLifecycle`; watches `strokeState`, calls `startSession()` on first non-zero stroke, polls every 5s for 30s idle, triggers `SessionEndPrompt` |
| `src/components/ble/BleConnectButton.tsx` | Rationale screen + Chrome BLE dialog trigger (D-06) | VERIFIED | Shows rationale text, "Connect PM5" button, all status variants; no animation CSS; no `wakeLockManager` calls |
| `src/components/metrics/MetricDisplay.tsx` | One big number layout — split time centered, secondaries below | VERIFIED | `text-8xl` split, `/500m` label, `text-3xl` SPM/watts row, top bar with elapsed/distance |
| `src/components/session/SessionEndPrompt.tsx` | Done rowing? prompt after 30s idle (D-09) | VERIFIED | "Done rowing?" text, "Continue" and "End Session" buttons, backdrop overlay |
| `src/app/session/page.tsx` | Session page — BLE connect trigger, live metrics, session lifecycle | VERIFIED | `'use client'`, imports all components/hooks, `wakeLockManager.acquire()`, `wakeLockManager.bindVisibilityChange()`, `wakeLockManager.release()` in cleanup, `pm5Service.disconnect()` in cleanup, `useSessionLifecycle` wired |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `src/proxy.ts` | `src/lib/supabase/middleware.ts` | `updateSession` call | WIRED | `proxy.ts` imports and calls `updateSession(request)` |
| `src/app/onboarding/page.tsx` | Supabase `user_profile` table | upsert on form submit | WIRED | `supabase.from('user_profile').upsert({ id, name, onboarding_complete: true, coaching_tone: 'calm_supportive' })` |
| `src/components/ble/BleConnectButton.tsx` | `src/lib/ble/pm5-service.ts` | onClick calls `pm5Service.connect()` | WIRED | `handleConnect()` calls `await pm5Service.connect()` |
| `src/hooks/useSessionLifecycle.ts` | `src/lib/session/session-store.ts` | `useSessionStore` reads/writes | WIRED | Reads `latestReading.strokeState`, calls `startSession()`, `endSession()`, `setSessionPhase()` |
| `src/app/session/page.tsx` | `src/lib/wake-lock/wake-lock-manager.ts` | `wakeLockManager.acquire()` + `bindVisibilityChange()` | WIRED | Called in `pm5Service 'connected'` event handler; `release()` in unmount cleanup |
| `src/lib/ble/pm5-service.ts` | `src/lib/session/session-store.ts` | `setupStoreListeners` called from session page | WIRED | `session/page.tsx` calls `setupStoreListeners(pm5Service, useSessionStore.getState())` on mount |
| `src/lib/ble/pm5-parser.ts` | `src/lib/ble/pm5-service.ts` | characteristic notification handler calls parse functions | WIRED | `handleRowingStatus`, `handleExtraStatus1`, `handleExtraStatus2` each call the respective parse function |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| `MetricDisplay.tsx` | `reading: StrokeReading \| null` | Prop from `session/page.tsx` ← `useSessionStore.latestReading` ← `setupStoreListeners` ← `pm5Service 'stroke_reading'` event ← GATT characteristic notification | Yes — from live PM5 GATT notifications via real BLE hardware | FLOWING (requires hardware) |
| `BleConnectButton.tsx` | `bleStatus` | `useSessionStore.bleStatus` ← `setupStoreListeners` ← pm5Service events | Yes — driven by real BLE connection events | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Parser unit tests (13 cases) | `npx vitest run src/lib/ble/pm5-parser.test.ts` | 13 passed | PASS |
| TypeScript strict mode | `npx tsc --noEmit` | 0 errors | PASS |
| Production build | `npm run build` | Compiled successfully, all 9 routes generated, `ƒ Proxy (Middleware)` shown | PASS |
| Module exports `pm5Service` singleton | Build passes with all imports resolved | Confirmed at build time | PASS |
| BLE session with physical PM5 | — | Requires hardware | SKIP |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| ONBD-01 | 01-01-PLAN | User can sign up with email/password via Supabase Auth | SATISFIED | `signup/page.tsx` calls `supabase.auth.signUp()`, form has email + password fields |
| ONBD-02 | 01-01-PLAN | User completes onboarding with name (progressive fields deferred per D-04) | SATISFIED | `onboarding/page.tsx` collects name only, upserts `user_profile` with `onboarding_complete: true` |
| ONBD-03 | 01-01-PLAN | User session persists across browser refresh | SATISFIED | `src/proxy.ts` calls `updateSession()` on every request — refreshes auth token cookie |
| BLE-01 | 01-02-PLAN, 01-03-PLAN | User can pair PM5 via Web Bluetooth on Chrome Android | SATISFIED (code) | `pm5Service.connect()` calls `navigator.bluetooth.requestDevice()` filtered by `PM5_SERVICE_UUID`; hardware test required |
| BLE-02 | 01-02-PLAN, 01-03-PLAN | App reads real-time PM5 data (stroke rate, split, watts, distance) | SATISFIED (code) | All 3 GATT characteristics subscribed; `StrokeReading` includes all 4 fields; hardware test required |
| BLE-03 | 01-02-PLAN, 01-03-PLAN | Screen Wake Lock keeps BLE + audio alive during sessions | SATISFIED (code) | `WakeLockManager.acquire()` on connect, `bindVisibilityChange()` for re-acquisition; hardware test required |
| BLE-04 | 01-02-PLAN, 01-03-PLAN | App detects BLE disconnect and announces fallback to timer mode | PARTIAL | Disconnect detected and announced ("Connection lost — reconnecting..."); timer fallback mode NOT implemented |
| BLE-05 | 01-02-PLAN, 01-03-PLAN | App attempts BLE reconnect every 30s after disconnect | SATISFIED | `scheduleReconnect()` with `RECONNECT_INTERVAL_MS = 30000`, `MAX_RECONNECT_ATTEMPTS = 3` |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/lib/ble/pm5-constants.ts` | All byte offsets | `[ASSUMED]` comments on byte offsets derived from ErgometerJS, not verified against official Concept2 BLE spec | Warning | Parser tests pass with constructed DataView buffers; real PM5 hardware may use different byte positions. Hardware verification required before production use. |
| `src/app/manifest.json` | icons | Icon PNG paths referenced (`/icons/icon-192x192.png`, `/icons/icon-512x512.png`) | Info | Icon files exist in `public/icons/` — not a stub. PWA manifest is valid. |

No blocker anti-patterns found in business logic. The `[ASSUMED]` byte offsets are a known, documented technical risk (not a code stub) — real values produce correct decoding only if the ErgometerJS analysis matches the official Concept2 spec.

### Human Verification Required

#### 1. End-to-End Session with Physical PM5

**Test:** Run `npm run dev`, sign up with a new account, complete onboarding (enter your name, tap "Start Rowing"), navigate to `/session`, tap "Connect PM5", select the PM5 from Chrome BLE chooser, row a few strokes.
**Expected:** Split time appears in large text at center (`M:SS /500m`), SPM and watts appear in smaller text below, elapsed time and total distance appear at top. All fields update as you row.
**Why human:** Requires physical Concept2 PM5 and Chrome Android/desktop. Cannot verify GATT byte offset correctness without real PM5 notifications.

#### 2. BLE Reconnect After Disconnect

**Test:** With an active session, power off the PM5 (or move out of BLE range).
**Expected:** Status banner changes to "Connection lost — reconnecting..." immediately. After 30s, reconnect is attempted. Up to 3 attempts. After 3 failures, "Unable to reconnect. Tap to try again." appears.
**Why human:** Requires physical PM5 and BLE range manipulation to trigger `gattserverdisconnected` event.

#### 3. Session Auto-Start (D-08)

**Test:** Connect PM5, sit idle on the erg, then begin rowing.
**Expected:** Session starts automatically on first stroke — elapsed timer begins, no "Start Session" button needed.
**Why human:** Requires PM5 hardware to produce non-zero `strokeState` readings.

#### 4. Session Auto-End Prompt (D-09)

**Test:** Row for a bit, then stop for 35+ seconds.
**Expected:** "Done rowing?" prompt appears after 30s idle. "Continue" dismisses it. "End Session" ends the session and stops the timer.
**Why human:** Requires PM5 hardware to produce `strokeState = 0` readings during idle.

#### 5. Screen Wake Lock on Android (BLE-03)

**Test:** Start a session on Chrome Android, lock the screen mid-session, unlock after 30 seconds.
**Expected:** BLE connection remains alive after unlock; WakeLockManager re-acquires the lock on `visibilitychange`.
**Why human:** Screen Wake Lock behavior is OS and device dependent; requires Android + physical PM5.

### Gaps Summary

**1 blocking gap (BLE-04 timer fallback mode):**

The phase delivers a working BLE connection lifecycle — connect, live metrics, reconnect on disconnect — but does not deliver the "timer fallback mode" that BLE-04 and ROADMAP SC #5 both explicitly require. When the PM5 disconnects mid-session, the user sees "Connection lost — reconnecting..." but the session experience degrades: the split time freezes on the last reading and the elapsed timer in MetricDisplay stops updating from live BLE data. A timer fallback should continue counting elapsed time from `sessionStartedAt` so the user knows their session is still in progress while reconnection is attempted.

**1 documentation inconsistency (ROADMAP SC #2 vs ONBD-02):**

The ROADMAP success criterion #2 says "name, experience level, coaching tone, injuries" but REQUIREMENTS.md ONBD-02 explicitly defers those fields to after first session per D-04. The implementation correctly follows ONBD-02 and D-04. Developer should update ROADMAP SC #2 wording to match ONBD-02, or confirm the discrepancy is intentional.

---

_Verified: 2026-04-10T03:11:14Z_
_Verifier: Claude (gsd-verifier)_
