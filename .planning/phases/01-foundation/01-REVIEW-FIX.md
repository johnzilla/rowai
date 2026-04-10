---
phase: 01-foundation
fixed_at: 2026-04-10T12:20:45Z
review_path: .planning/phases/01-foundation/01-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 01: Code Review Fix Report

**Fixed at:** 2026-04-10T12:20:45Z
**Source review:** .planning/phases/01-foundation/01-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7
- Fixed: 7
- Skipped: 0

## Fixed Issues

### CR-01: `'connected'` event dispatched twice on successful reconnect

**Files modified:** `src/lib/ble/pm5-service.ts`
**Commit:** 0694ab0
**Applied fix:** Removed the redundant `this.dispatchEvent(new CustomEvent('connected'))` call in `scheduleReconnect()` after `await this.connectGatt()`. `connectGatt()` already dispatches `'connected'` as its final step, so the manual re-dispatch was causing two `'connected'` events per successful reconnect.

---

### CR-02: `validateStrokeReading` skipped for idle readings, allowing `splitMs = 0` to reach the store

**Files modified:** `src/lib/ble/pm5-service.ts`
**Commit:** aef84f4
**Applied fix:** Replaced the `if (reading.splitMs > 0)` conditional-validation pattern with an early return when `reading.strokeState === 0`. Idle readings are now dropped entirely before dispatch rather than bypassing validation. Non-idle readings continue through full `validateStrokeReading()` without the special-case guard.

---

### WR-01: `WakeLockManager.bindVisibilityChange` adds unbounded event listeners — memory leak

**Files modified:** `src/lib/wake-lock/wake-lock-manager.ts`, `src/app/session/page.tsx`
**Commit:** e955cde
**Applied fix:** Added a `visibilityChangeHandler` private field to `WakeLockManager` to store the listener reference. `bindVisibilityChange()` now guards against double-registration and stores the handler. Added `unbindVisibilityChange()` method that removes the listener from `document` and clears the stored reference. Called `wakeLockManager.unbindVisibilityChange()` in the session page unmount cleanup effect.

---

### WR-02: `onboarding/page.tsx` — `setLoading(false)` missing on the success path

**Files modified:** `src/app/onboarding/page.tsx`
**Commit:** 5a4b12f
**Applied fix:** Added `setLoading(false)` before `router.push('/session')` on the success path so that the button is re-enabled before navigation, preventing a perpetually-loading state if the user navigates back.

---

### WR-03: DataView access in parsers is not bounds-checked — potential RangeError crash

**Files modified:** `src/lib/ble/pm5-parser.ts`, `src/lib/ble/pm5-service.ts`
**Commit:** ea8eff2
**Applied fix:** Added minimum byte-length guards at the top of all three parse functions: `parseRowingGeneralStatus` (needs 7 bytes), `parseExtraStatus1` (needs 6 bytes), `parseExtraStatus2` (needs 2 bytes). Each throws a descriptive `RangeError` on a too-short packet. Wrapped all three BLE characteristic handler methods (`handleRowingStatus`, `handleExtraStatus1`, `handleExtraStatus2`) in `try/catch` blocks so a truncated-packet `RangeError` is logged as a warning and does not propagate to the Web Bluetooth notification subscription.

---

### WR-04: `signup/page.tsx` — Supabase error message leaked verbatim to the user

**Files modified:** `src/app/(auth)/signup/page.tsx`
**Commit:** 195deab
**Applied fix:** Added a `friendlySignupError(message)` helper function that maps known Supabase error message substrings ("already registered", "rate limit") to user-facing strings, with a generic fallback. The `handleSignup` error path now calls `setError(friendlySignupError(signUpError.message))` instead of `setError(signUpError.message)`.

---

### WR-05: Stale closure in `useSessionLifecycle` idle-check interval

**Files modified:** `src/hooks/useSessionLifecycle.ts`
**Commit:** 4cc2a98
**Applied fix:** Inside the idle-check `setInterval` callback, replaced the closure-captured `sessionPhase` variable with a fresh read via `useSessionStore.getState().sessionPhase`. Removed `sessionPhase` from the effect dependency array so the interval is no longer torn down and restarted on every phase transition. The `sessionPhase` selector at the hook's top level is retained for the other two effects that still use it.

---

_Fixed: 2026-04-10T12:20:45Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
