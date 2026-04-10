---
phase: 01-foundation
reviewed: 2026-04-09T00:00:00Z
depth: standard
files_reviewed: 21
files_reviewed_list:
  - src/app/(auth)/login/page.tsx
  - src/app/(auth)/signup/page.tsx
  - src/app/onboarding/page.tsx
  - src/app/session/page.tsx
  - src/app/layout.tsx
  - src/app/sw.ts
  - src/components/ble/BleConnectButton.tsx
  - src/components/metrics/MetricDisplay.tsx
  - src/components/session/SessionEndPrompt.tsx
  - src/hooks/useSessionLifecycle.ts
  - src/lib/ble/pm5-constants.ts
  - src/lib/ble/pm5-parser.ts
  - src/lib/ble/pm5-parser.test.ts
  - src/lib/ble/pm5-service.ts
  - src/lib/session/session-store.ts
  - src/lib/supabase/client.ts
  - src/lib/supabase/middleware.ts
  - src/lib/supabase/server.ts
  - src/lib/wake-lock/wake-lock-manager.ts
  - src/proxy.ts
  - supabase/migrations/001_initial_schema.sql
  - next.config.ts
findings:
  critical: 2
  warning: 5
  info: 4
  total: 11
status: issues_found
---

# Phase 01: Code Review Report

**Reviewed:** 2026-04-09T00:00:00Z
**Depth:** standard
**Files Reviewed:** 21
**Status:** issues_found

## Summary

This is a well-structured Phase 1 foundation. The authentication flow, BLE layer, session store, and Supabase schema are cleanly separated. The BLE parser has solid validation logic and good test coverage for happy paths. The PM5 service's reconnect strategy and partialReading merge pattern are well-designed.

Two critical issues exist: a `'connected'` event fired twice during successful reconnects in `pm5-service.ts`, which corrupts the Zustand store's BLE status; and the `validateStrokeReading` function silently passes invalid `splitMs === 0` readings through to the store, which can display garbage metrics during idle states. Five warnings cover a memory leak in `WakeLockManager.bindVisibilityChange`, missing `setLoading(false)` on the onboarding happy path, unguarded DataView byte-range access in the parsers, the `signup` page leaking the Supabase error message verbatim to users, and stale-closure risk in the idle check interval. Four info-level items cover the `user_profile` coaching_tone field being unconstrained text, dead UI code in session page, missing `elapsedTimeMs` validation in `validateStrokeReading`, and a missing `SECURITY DEFINER` guard on the updated_at trigger function.

---

## Critical Issues

### CR-01: `'connected'` event dispatched twice on successful reconnect

**File:** `src/lib/ble/pm5-service.ts:221-222`

**Issue:** In `scheduleReconnect()`, after `connectGatt()` succeeds, the code calls `this.dispatchEvent(new CustomEvent('connected'))` manually at line 222. However `connectGatt()` itself (line 88) also dispatches `'connected'`. This means every successful reconnect fires two `'connected'` events in sequence, causing `setupStoreListeners` to call `store.setBleStatus('connected')` twice. While idempotent for status, it also causes `wakeLockManager.acquire()` to be called a second time and the `visibilityBound` guard to be bypassed if the `handleConnected` listener was re-registered, creating unpredictable behavior as the codebase grows.

**Fix:** Remove the redundant dispatch at line 222. `connectGatt()` already dispatches `'connected'` as its final step, which is the canonical notification point.

```typescript
// In scheduleReconnect(), after awaiting connectGatt():
try {
  await this.connectGatt();
  // Success — reset attempt counter for next disconnect event
  this.reconnectAttempts = 0;
  // DELETE the line below — connectGatt() already dispatches 'connected'
  // this.dispatchEvent(new CustomEvent('connected'));
} catch {
  this.scheduleReconnect();
}
```

---

### CR-02: `validateStrokeReading` skipped for idle readings, allowing `splitMs = 0` to reach the store

**File:** `src/lib/ble/pm5-service.ts:179`

**Issue:** The guard `if (reading.splitMs > 0)` intentionally bypasses validation when the PM5 is not in motion, reasoning this is a normal idle state. However, `splitMs = 0` will pass through and be dispatched via `'stroke_reading'`, causing `MetricDisplay` to call `formatMSS(0)` which renders `0:00` as the split time — an invalid and confusing metric value. Additionally, `strokeRate`, `watts`, and `distanceMeters` are not validated when `splitMs === 0`, so a corrupt idle-state packet could populate the display with impossible values (e.g., negative watts from a malformed `getUint16` would not be caught).

The real issue is that idle readings (`strokeState === 0`) should probably not be dispatched to the store at all, or should be dispatched with sentinel values clearly marked as non-data. Skipping validation entirely is the wrong fix.

**Fix:** Either suppress dispatch entirely for idle readings (cleanest), or validate the non-split fields unconditionally:

```typescript
// Option A — skip dispatching idle readings (no strokeState > 0 means no metrics to show)
private tryDispatchReading(): void {
  // ...completeness checks...

  const reading: StrokeReading = { /* ...fields... */ };

  // Do not dispatch idle readings — they carry no valid performance data.
  // useSessionLifecycle already handles auto-start on first non-idle stroke.
  if (reading.strokeState === 0) {
    return;
  }

  try {
    validateStrokeReading(reading);
  } catch (err) {
    console.warn('[PM5Service] Discarding out-of-range reading:', err);
    return;
  }

  this.dispatchEvent(new CustomEvent('stroke_reading', { detail: reading }));
}
```

---

## Warnings

### WR-01: `WakeLockManager.bindVisibilityChange` adds unbounded event listeners — memory leak

**File:** `src/lib/wake-lock/wake-lock-manager.ts:71`

**Issue:** `bindVisibilityChange()` calls `document.addEventListener('visibilitychange', ...)` with no way to remove the listener. In `session/page.tsx` (lines 69-72), `bindVisibilityChange()` is guarded by `visibilityBound` ref to call it once per mount. However, on component unmount the listener is never removed. If the session page is mounted and unmounted multiple times (e.g., the user navigates away and back), and React strict mode double-invoking effects causes `visibilityBound.current` to not reset between invocations, additional listeners will accumulate on `document`. Each listener holds a closure over `this` (the singleton), so the sentinel reference stays alive but listener calls multiply.

**Fix:** Return and store the handler so it can be removed; expose an `unbindVisibilityChange()` method, and call it in the session page unmount cleanup:

```typescript
// wake-lock-manager.ts
private visibilityChangeHandler: (() => void) | null = null;

bindVisibilityChange(): void {
  if (this.visibilityChangeHandler) return; // already bound
  this.visibilityChangeHandler = async () => {
    if (document.visibilityState === 'visible' && this.sentinel === null) {
      await this.acquire();
    }
  };
  document.addEventListener('visibilitychange', this.visibilityChangeHandler);
}

unbindVisibilityChange(): void {
  if (this.visibilityChangeHandler) {
    document.removeEventListener('visibilitychange', this.visibilityChangeHandler);
    this.visibilityChangeHandler = null;
  }
}
```

```typescript
// session/page.tsx — in the unmount cleanup effect:
return () => {
  pm5Service.disconnect();
  wakeLockManager.release();
  wakeLockManager.unbindVisibilityChange(); // add this
};
```

---

### WR-02: `onboarding/page.tsx` — `setLoading(false)` missing on the success path

**File:** `src/app/onboarding/page.tsx:47-53`

**Issue:** In `handleSubmit`, `setLoading(true)` is called at line 28. On the error path, `setLoading(false)` is correctly called at line 50. On the success path, `router.push('/session')` is called at line 53 without first resetting loading state. If navigation is delayed (slow hydration, prerender), the button remains disabled and spinner text shows indefinitely. More critically, if the user presses the browser back button after the push, they return to the onboarding page in a perpetually-loading state with no way to resubmit.

**Fix:**
```typescript
// After successful upsert, before push:
setLoading(false);
router.push('/session');
```

---

### WR-03: DataView access in parsers is not bounds-checked — potential RangeError crash

**File:** `src/lib/ble/pm5-parser.ts:35-39`, `src/lib/ble/pm5-parser.ts:71-73`, `src/lib/ble/pm5-parser.ts:84`

**Issue:** `getUint24LE`, `parseExtraStatus1`, and `parseExtraStatus2` call `DataView.getUint8` and `getUint16` at fixed offsets without checking `data.byteLength` first. If the PM5 sends a truncated packet (e.g., a firmware quirk or a mid-transmission disconnect), `DataView` will throw a `RangeError` for out-of-bounds access. This RangeError propagates uncaught through `handleRowingStatus`/`handleExtraStatus1`/`handleExtraStatus2` (the BLE characteristic event handlers), which have no try/catch. An uncaught error in a Web Bluetooth event handler can terminate the notification subscription silently in some browsers.

**Fix:** Add a minimum byte length guard at the top of each parse function:

```typescript
export function parseRowingGeneralStatus(data: DataView): ... {
  if (data.byteLength < 7) {
    throw new RangeError(`ROWING_STATUS too short: ${data.byteLength} bytes (need 7)`);
  }
  // ...existing parse logic
}

// And wrap handler calls in pm5-service.ts:
private handleRowingStatus = (event: Event): void => {
  const characteristic = event.target as BluetoothRemoteGATTCharacteristic;
  if (!characteristic.value) return;
  try {
    const parsed = parseRowingGeneralStatus(characteristic.value);
    this.partialReading = { ...this.partialReading, ...parsed };
    this.tryDispatchReading();
  } catch (err) {
    console.warn('[PM5Service] Malformed ROWING_STATUS packet:', err);
  }
};
```

---

### WR-04: `signup/page.tsx` — Supabase error message leaked verbatim to the user

**File:** `src/app/(auth)/signup/page.tsx:32`

**Issue:** `setError(signUpError.message)` displays the raw Supabase error message directly to the user. Supabase auth errors can include technical strings such as `"User already registered"`, `"Email rate limit exceeded"`, `"Password should be at least 6 characters"`, or internal server error descriptions. These messages may be confusing, inconsistent in tone, and could reveal implementation details (e.g., that Supabase is being used, or what password policy is enforced at the service level). The login page correctly uses a generic `'Invalid email or password'` message instead.

**Fix:** Map to user-friendly messages, falling back to a generic string:

```typescript
function friendlySignupError(message: string): string {
  if (message.toLowerCase().includes('already registered')) {
    return 'An account with this email already exists. Try logging in instead.';
  }
  if (message.toLowerCase().includes('rate limit')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  return 'Could not create your account. Please try again.';
}

// In handleSignup:
if (signUpError) {
  setError(friendlySignupError(signUpError.message));
  setLoading(false);
  return;
}
```

---

### WR-05: Stale closure in `useSessionLifecycle` idle-check interval

**File:** `src/hooks/useSessionLifecycle.ts:51-65`

**Issue:** The idle-check `setInterval` effect has `[isSessionActive, sessionPhase, setSessionPhase]` as its dependency array. The interval callback reads `sessionPhase` from its closure. However, because the interval is recreated only when `isSessionActive` or `sessionPhase` changes, the `sessionPhase` captured inside the interval body is always the value at the time the effect last ran. If `sessionPhase` transitions from `'active'` to `'ending'` outside of this effect (e.g., from a future external trigger), the already-running interval will still see the old `sessionPhase` value and re-trigger `setSessionPhase('ending')` and `setShowEndPrompt(true)` redundantly. The effect does re-run on `sessionPhase` changes (it's a dependency), so this is currently low risk, but the pattern is fragile. Additionally, adding `sessionPhase` as an interval dependency means the interval is torn down and restarted every time phase changes, resetting no state — a hidden interaction.

**Fix:** Use a ref for `sessionPhase` inside the interval, or use `useSessionStore.getState()` inside the callback to always read fresh state:

```typescript
const idleCheckInterval = setInterval(() => {
  if (lastStrokeAt.current === null) return;
  const idleMs = Date.now() - lastStrokeAt.current;
  // Read phase fresh from store rather than from stale closure
  const currentPhase = useSessionStore.getState().sessionPhase;
  if (idleMs >= 30000 && currentPhase === 'active') {
    setSessionPhase('ending');
    setShowEndPrompt(true);
  }
}, 5000);
```

---

## Info

### IN-01: `coaching_tone` column is unconstrained text — should be an enum or check constraint

**File:** `supabase/migrations/001_initial_schema.sql:6`

**Issue:** `coaching_tone text not null default 'calm_supportive'` allows any string value. The onboarding page hard-codes `'calm_supportive'` (onboarding/page.tsx:44) as the only value, but the DB has no constraint enforcing valid tones. When more tones are added, invalid values can be inserted without error, and querying by tone becomes unreliable without application-layer validation.

**Fix:** Add a check constraint or use a Postgres enum:

```sql
coaching_tone text not null default 'calm_supportive'
  check (coaching_tone in ('calm_supportive', 'energetic', 'strict')),
```

---

### IN-02: Dead UI code in `session/page.tsx`

**File:** `src/app/session/page.tsx:110`

**Issue:** Inside the `else` branch (BLE not active), there is a conditional that renders `null`:
```tsx
{!isConnected && bleStatus !== 'disconnected' && null}
```
This expression is always `null` — it renders nothing. The double negative logic (`!isConnected` and `bleStatus !== 'disconnected'`) evaluates to true only when `bleStatus === 'connecting'`, but even then it renders `null`. This appears to be a placeholder that was never replaced with actual connecting state UI.

**Fix:** Either add the intended connecting state indicator, or remove the dead expression:
```tsx
// Remove entirely, or replace with actual connecting UI:
{bleStatus === 'connecting' && (
  <p className="text-gray-400 text-sm">Connecting to PM5...</p>
)}
```

---

### IN-03: `validateStrokeReading` does not validate `elapsedTimeMs`

**File:** `src/lib/ble/pm5-parser.ts:95-126`

**Issue:** `validateStrokeReading` validates `splitMs`, `strokeRate`, `watts`, and `distanceMeters`, but does not validate `elapsedTimeMs`. A corrupt 3-byte LE value could yield up to 16,777,215 × 10ms = ~46 hours of elapsed time, which would render as a nonsensical timer value and could interfere with session duration calculations.

**Fix:** Add a maximum elapsed time bound (e.g., 4 hours = 14,400,000ms covers any realistic ergometer session):

```typescript
const ELAPSED_TIME_MAX_MS = 14_400_000; // 4 hours

// In validateStrokeReading:
if (reading.elapsedTimeMs > ELAPSED_TIME_MAX_MS) {
  throw new RangeError(
    `elapsedTimeMs above plausible maximum: ${reading.elapsedTimeMs}ms`
  );
}
```

---

### IN-04: `set_updated_at` trigger function is not `SECURITY DEFINER` with a fixed search_path

**File:** `supabase/migrations/001_initial_schema.sql:29-33`

**Issue:** The PL/pgSQL trigger function `public.set_updated_at()` is created with default security settings. In Postgres, trigger functions run with the privileges of the calling role and with the caller's `search_path`. Without `SECURITY DEFINER` and an explicit `SET search_path = public`, a user with the ability to create objects in their own schema could shadow `public` objects and potentially affect trigger execution in misconfigured multi-tenant environments. This is a low-risk concern for a Supabase project where the schema is managed, but is a best-practice gap.

**Fix:**
```sql
create or replace function public.set_updated_at()
returns trigger language plpgsql
security definer
set search_path = public
as $$
begin new.updated_at = now(); return new; end;
$$;
```

---

_Reviewed: 2026-04-09T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
