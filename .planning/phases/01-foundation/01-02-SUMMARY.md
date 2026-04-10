---
phase: 01-foundation
plan: 02
subsystem: ble
tags: [web-bluetooth, pm5, gatt, zustand, vitest, typescript, wake-lock]

# Dependency graph
requires: []
provides:
  - "pm5-constants.ts: PM5 GATT service UUID and 3 characteristic UUIDs with byte offset constants"
  - "pm5-parser.ts: DataView byte decoder producing typed StrokeReading objects with RangeError validation"
  - "pm5-parser.test.ts: 13 Vitest TDD tests covering all parse functions and all 4 validation error cases"
  - "pm5-service.ts: PM5Service EventTarget class — connect, GATT subscribe, 30s reconnect loop, setupStoreListeners"
  - "wake-lock-manager.ts: WakeLockManager — acquire, release, visibilitychange re-acquisition, singleton"
  - "session-store.ts: Zustand store — bleStatus, latestReading, sessionPhase, isSessionActive, startSession/endSession actions"
affects:
  - "01-03-session-ui"
  - "coaching-engine"
  - "any plan consuming pm5Service, useSessionStore, or WakeLockManager"

# Tech tracking
tech-stack:
  added:
    - "vitest 2.x — unit testing for pure TypeScript modules"
    - "zustand 5.0.12 — session state store"
    - "@types/web-bluetooth 0.0.21 — TypeScript types for navigator.bluetooth"
  patterns:
    - "EventTarget subclass for BLE service (PM5Service extends EventTarget)"
    - "Partial reading accumulation pattern — merge 3 GATT characteristic payloads before dispatching complete StrokeReading"
    - "TDD RED→GREEN for byte-level parsing with DataView test harness"
    - "Range validation at BLE boundary (validateStrokeReading) — corrupt bytes cannot reach coaching engine"
    - "Singleton module exports (pm5Service, wakeLockManager) for app-wide sharing"

key-files:
  created:
    - "src/lib/ble/pm5-constants.ts"
    - "src/lib/ble/pm5-parser.ts"
    - "src/lib/ble/pm5-parser.test.ts"
    - "src/lib/ble/pm5-service.ts"
    - "src/lib/wake-lock/wake-lock-manager.ts"
    - "src/lib/session/session-store.ts"
    - "package.json"
    - "tsconfig.json"
    - "vitest.config.ts"
  modified: []

key-decisions:
  - "Partial reading merge pattern: accumulate fields from 3 GATT characteristics independently, dispatch StrokeReading only when all fields present — avoids requiring synchronised notifications"
  - "splitMs=0 skips range validation: idle PM5 reports 0 split before rowing begins; treating 0 as invalid would discard legitimate pre-session readings"
  - "BleStoreActions interface (not Zustand ReturnType): direct interface avoids TypeScript Pick<> incompatibility with Zustand's inferred store type"
  - "setupStoreListeners function (not constructor injection): keeps PM5Service decoupled from Zustand; store binding is wired by the session page component at startup"
  - "RECONNECT_INTERVAL_MS=30000 (fixed interval, not exponential backoff): plan spec requires 30s fixed interval; exponential backoff from RESEARCH.md is documented but not implemented per plan"

patterns-established:
  - "Pattern: BLE service as isolated EventTarget — components never call navigator.bluetooth directly"
  - "Pattern: Validate at the trust boundary — validateStrokeReading() called before any store write"
  - "Pattern: Singleton service exports — pm5Service and wakeLockManager shared app-wide without prop drilling"
  - "Pattern: TDD with DataView test fixtures — makeDataView(bytes) helper pattern reusable for future GATT tests"

requirements-completed:
  - BLE-01
  - BLE-02
  - BLE-03
  - BLE-04
  - BLE-05

# Metrics
duration: 15min
completed: 2026-04-10
---

# Phase 1 Plan 2: BLE Data Pipeline Summary

**PM5Service GATT pipeline with DataView byte parser (13 TDD tests passing), 30s reconnect loop, WakeLockManager with visibilitychange re-acquisition, and Zustand session store wired to BLE events**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-10T22:26:00Z
- **Completed:** 2026-04-10T22:30:57Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- PM5 GATT byte parser with full TDD coverage (13 tests, RED→GREEN confirmed) — elapsedTimeMs, distanceMeters, strokeState, strokeRate, splitMs, watts all decoded from DataView
- RangeError validation at BLE boundary blocks physically impossible values from reaching session state (T-02-01 threat mitigation)
- PM5Service implements BLE-01 through BLE-05: filtered requestDevice, 3-characteristic subscription, gattserverdisconnected handler, 30s fixed-interval reconnect with MAX_RECONNECT_ATTEMPTS=3 cap
- WakeLockManager with acquire/release and visibilitychange re-acquisition prevents screen sleep mid-session (BLE-03)
- Zustand session store exposes bleStatus, latestReading, sessionPhase, isSessionActive — ready for Plan 03 session UI to consume

## Task Commits

1. **Task 1: PM5 constants, byte parser, and Zustand session store** - `b126b96` (feat + test)
2. **Task 2: PM5Service connection lifecycle and WakeLockManager** - `b55b87d` (feat)

## Files Created/Modified

- `src/lib/ble/pm5-constants.ts` — PM5 GATT UUIDs and byte offset constants (marked ASSUMED, need hardware verification)
- `src/lib/ble/pm5-parser.ts` — DataView decoder: getUint24LE, parseRowingGeneralStatus, parseExtraStatus1, parseExtraStatus2, validateStrokeReading
- `src/lib/ble/pm5-parser.test.ts` — 13 Vitest TDD tests covering all parse functions and all 4 RangeError cases
- `src/lib/ble/pm5-service.ts` — PM5Service class + setupStoreListeners + pm5Service singleton
- `src/lib/wake-lock/wake-lock-manager.ts` — WakeLockManager class + wakeLockManager singleton
- `src/lib/session/session-store.ts` — Zustand store with full session state and BLE status actions
- `package.json` — project scaffolding with zustand, vitest, @types/web-bluetooth
- `tsconfig.json` — TypeScript strict mode config
- `vitest.config.ts` — Vitest config for node environment

## Decisions Made

- **Partial reading merge pattern:** The 3 GATT characteristics (rowingStatus, extraStatus1, extraStatus2) notify independently and asynchronously. `partialReading` accumulates all fields; `tryDispatchReading()` fires only when all 6 fields are present. This avoids requiring the PM5 to synchronise its notifications.
- **splitMs=0 skips validation:** The PM5 reports 0 for split time before any rowing has begun. Treating 0 as a RangeError would discard valid pre-session idle readings. Validation only runs when `splitMs > 0`.
- **Fixed 30s reconnect interval (not exponential):** Plan spec (BLE-05) explicitly requires "30s intervals." The RESEARCH.md pattern uses exponential backoff, but the plan spec takes precedence for this implementation.
- **BleStoreActions interface:** TypeScript's `Pick<>` on Zustand's inferred store type produces `unknown` members in strict mode. An explicit `BleStoreActions` interface avoids the type inference issue while maintaining the same API contract.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed TypeScript Pick<> incompatibility with Zustand store type**
- **Found during:** Task 2 (PM5Service implementation)
- **Issue:** `Pick<SessionStore, 'setBleStatus' | 'setLatestReading'>` resolved to `unknown` method types because Zustand's ReturnType inference is not compatible with TypeScript strict mode Pick.
- **Fix:** Replaced with explicit `BleStoreActions` interface defining the two action signatures directly — same API surface, correctly typed.
- **Files modified:** `src/lib/ble/pm5-service.ts`
- **Verification:** `npx tsc --noEmit` exits 0 with no errors
- **Committed in:** b55b87d (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 — TypeScript type bug)
**Impact on plan:** Fix is necessary for TypeScript strict mode compliance. No scope creep. API contract unchanged.

## Issues Encountered

- No package.json existed in the worktree (greenfield project, Plan 01-01 running in parallel handles full Next.js scaffold). Created minimal `package.json`, `tsconfig.json`, and `vitest.config.ts` to support isolated library module testing. These files will be superseded or merged when Plan 01-01's scaffold lands.

## Known Stubs

- **Byte offsets in pm5-constants.ts:** All byte offset constants (`ROWING_STATUS_ELAPSED_TIME_OFFSET`, `ROWING_STATUS_DISTANCE_OFFSET`, `ROWING_STATUS_STROKE_STATE_OFFSET`, `EXTRA1_STROKE_RATE_OFFSET`, `EXTRA1_SPLIT_OFFSET`, `EXTRA2_WATTS_OFFSET`) are marked `[ASSUMED]` — derived from ErgometerJS source analysis, not verified against the official Concept2 PM5 Bluetooth Smart Interface Definition PDF.
- **GATT UUIDs for extra characteristics:** `PM5_EXTRA_STATUS1_UUID` (ce060032) and `PM5_EXTRA_STATUS2_UUID` (ce060033) are inferred from ErgometerJS patterns. The primary service UUID (ce060030) is confirmed from Concept2 documentation.
- **Hardware testing required:** Parser tests use constructed DataView buffers. Correctness against real PM5 hardware notifications is unverified until Plan 03 session UI testing with a physical device.

## Threat Surface Scan

No new network endpoints, auth paths, or server-side file access introduced. All new surface is client-side BLE browser API. Threat model fully addressed by plan's `<threat_model>` section.

| Mitigation | Implementation |
|-----------|----------------|
| T-02-01 Tampering (corrupt GATT bytes) | `validateStrokeReading()` throws RangeError before data reaches session store |
| T-02-02 DoS (infinite reconnect) | `MAX_RECONNECT_ATTEMPTS=3` cap + `reconnect_failed` event |
| T-02-04 Spoofing (non-PM5 BLE device) | `requestDevice` filtered by `PM5_SERVICE_UUID` |

## Parser Test Results

All 13 tests pass:
- `parseRowingGeneralStatus`: elapsedTimeMs decoding (2 tests), distanceMeters decoding (1 test), strokeState decoding (2 tests)
- `parseExtraStatus1`: strokeRate decoding (1 test), splitMs decoding (1 test)
- `parseExtraStatus2`: watts decoding (1 test)
- `validateStrokeReading`: valid reading no-throw (1 test), splitMs < 60000 (1 test), splitMs > 900000 (1 test), strokeRate > 60 (1 test), watts < 0 (1 test)

Byte offset assumptions in parser are consistent with ErgometerJS source patterns. Verification against physical PM5 hardware required in Plan 03.

## TypeScript Strict Mode Status

`npx tsc --noEmit` exits 0 — zero errors across all `src/lib/` modules in strict mode.

## Next Phase Readiness

- Plan 03 (session UI) can import `pm5Service`, `useSessionStore`, and `wakeLockManager` immediately
- `setupStoreListeners(pm5Service, useSessionStore.getState())` wires BLE events to Zustand — call once in session page component
- `pm5Service.connect()` must be triggered from a user gesture (connect button click)
- `wakeLockManager.acquire()` + `wakeLockManager.bindVisibilityChange()` should be called at session start
- **Blocker for production:** byte offsets in `pm5-constants.ts` need verification against official Concept2 PM5 BLE spec before shipping to users

---
*Phase: 01-foundation*
*Completed: 2026-04-10*
