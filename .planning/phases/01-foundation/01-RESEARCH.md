# Phase 1: Foundation - Research

**Researched:** 2026-04-09
**Domain:** Next.js 16 PWA + Web Bluetooth (PM5 GATT) + Supabase Auth + Screen Wake Lock
**Confidence:** MEDIUM-HIGH — stack verified against npm registry and official docs; PM5 byte-level characteristic offsets need official spec confirmation

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Split time is the primary metric — displayed large and central, glanceable from ~3 feet during rowing
- **D-02:** Layout is "one big number + small secondaries" — split time huge in center, SPM/watts/distance smaller below
- **D-03:** Elapsed time and total distance shown as session progress indicators (top of screen)
- **D-04:** Minimal friction before first row — name + email signup only. Experience level, coaching tone, and injuries collected progressively after first session or via profile settings.
- **D-05:** Single coaching tone for MVP: "calm & supportive" — no tone selection UI needed.
- **D-06:** Show rationale screen before Chrome BLE dialog — brief explanation with a Connect button. Reduces permission denial rate.
- **D-07:** Connection status is simple text — "Connecting..." then "Connected to PM5" with checkmark. No animated indicators.
- **D-08:** Session starts automatically on first stroke detection — no explicit "Start Session" button.
- **D-09:** Session ends via auto-detection — after ~30s of no strokes, prompt "Done rowing?" with option to continue or end.
- **D-10:** No pause state — if you stop rowing, data stops. Resume by rowing again.

### Claude's Discretion

- Color scheme, typography, and overall visual design
- Exact layout spacing and responsive breakpoints
- Error message wording for edge cases
- Onboarding form field validation rules

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BLE-01 | User can pair PM5 via Web Bluetooth on Chrome Android | Web Bluetooth API patterns documented; user-gesture requirement, requestDevice filter by service UUID, GATT connect flow |
| BLE-02 | App reads real-time PM5 data (stroke rate, split, watts, distance) sampled every 5s | GATT notification subscription on characteristic UUIDs; DataView byte parsing from ErgometerJS source analysis |
| BLE-03 | Screen Wake Lock keeps BLE + audio alive during sessions | Screen Wake Lock API documented; visibilitychange re-acquisition pattern confirmed |
| BLE-04 | App detects BLE disconnect and announces fallback to timer mode | gattserverdisconnected event + exponential backoff reconnect from Chrome official samples |
| BLE-05 | App attempts BLE reconnect every 30s after disconnect | Exponential backoff pattern with 3 attempts verified from Chrome sample code |
| ONBD-01 | User can sign up with email/password via Supabase Auth | @supabase/ssr confirmed current; middleware cookie refresh pattern documented |
| ONBD-02 | User completes onboarding: name, experience level, coaching tone preference, injuries/limitations | D-04 locks minimal upfront fields; profile table schema outlined |
| ONBD-03 | User session persists across browser refresh | @supabase/ssr middleware handles cookie-based session; confirmed via official Supabase docs |

</phase_requirements>

---

## Summary

Phase 1 establishes the complete data foundation: a working PWA where an authenticated user can pair their Concept2 PM5 over BLE and see live rowing metrics in a stable session. No coaching, no AI — just reliable BLE data ingestion, session lifecycle management, and auth persistence.

The stack is Next.js 16 (not 15 as previously researched — the npm registry confirms 16.2.3 is `latest`). This is a significant version change from the project-level STACK.md which assumed 15.x. The PWA layer should use Serwist (`@serwist/next` v9.5.7) rather than `@ducanh2912/next-pwa`, which is what the 2026 Next.js ecosystem recommends. Tailwind v4 (confirmed at 4.2.2) uses CSS-based configuration — no `tailwind.config.js` by default. Supabase auth uses `@supabase/ssr` (confirmed at 0.10.2) with `createBrowserClient` / `createServerClient` and middleware for token refresh.

The most technically sensitive parts of this phase are: (1) the PM5 GATT byte parsing — the official Concept2 spec PDF is the authoritative source and must be fetched before implementation; (2) the Screen Wake Lock + BLE reconnect loop, which is well-documented and must be wired in from day one; (3) session auto-start on first stroke detection, which requires monitoring the `strokeState` byte in the rowing general status characteristic rather than a button press.

**Primary recommendation:** Scaffold with `npx create-next-app@latest`, add Serwist for PWA, wire Supabase auth with middleware, build the BLE ingestion layer as an isolated service module, and keep all BLE state in Zustand. Do not proceed to session UI until the BLE notification pipeline produces correct typed data.

---

## Project Constraints (from CLAUDE.md)

The global CLAUDE.md specifies gstack skill conventions for web browsing and code review. No framework restrictions or forbidden patterns are listed that conflict with the recommended stack. Security-relevant directives: API keys must not reach the client (enforced by Next.js route handlers). No other directives directly constrain Phase 1 implementation choices.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.2.3 | App shell, routing, API route handlers | Latest stable (`latest` tag on npm). App Router supports server components + route handlers for server-side key proxying. Required for Vercel deployment story. [VERIFIED: npm registry] |
| React | 19.x | UI rendering | Peer dependency of Next.js 16. [VERIFIED: npm registry peerDependencies] |
| TypeScript | 5.x | Type safety | BLE DataView types, Supabase typed queries, session state machine all benefit from strict mode. [ASSUMED] |
| Tailwind CSS | 4.2.2 | Utility CSS | v4 confirmed latest. CSS-first config (no tailwind.config.js). Uses `@tailwindcss/postcss` plugin. [VERIFIED: npm registry + official docs] |
| Zustand | 5.0.12 | Session state (BLE status, live metrics) | Latest stable. React context re-renders too broadly for PM5 data updating every stroke. [VERIFIED: npm registry] |
| Zod | 4.3.6 | Runtime validation of PM5 data and API payloads | Guards against corrupt GATT data reaching session state. [VERIFIED: npm registry] |

### PWA Layer

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `@serwist/next` | 9.5.7 | Service worker, precaching, PWA installability | Current recommended approach for Next.js 16 PWA — `@ducanh2912/next-pwa` is deprecated in favour of Serwist in 2026 community. Works with Turbopack. [VERIFIED: npm registry + WebSearch] |
| `serwist` | 9.5.7 | Serwist core (dev dep) | Required peer of `@serwist/next`. [VERIFIED: npm registry peerDependencies] |
| Web App Manifest | Browser spec | PWA installability, display mode | Built into Next.js App Router (no extra package needed). Set `"display": "standalone"`, `"orientation": "portrait"`. [VERIFIED: Next.js official docs] |
| Screen Wake Lock API | Browser API | Prevent screen sleep during BLE session | Native browser API. No package. Stable W3C spec, Chrome 84+, Firefox 126+, Safari 16.4+. Requires HTTPS. [VERIFIED: MDN + Chrome Dev docs] |

### Auth + Database

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `@supabase/supabase-js` | 2.103.0 | Supabase JS client | v2 stable. Typed queries via generated types. [VERIFIED: npm registry] |
| `@supabase/ssr` | 0.10.2 | SSR client for Next.js App Router | Current package replacing deprecated `@supabase/auth-helpers-nextjs`. Exports `createBrowserClient` / `createServerClient`. Middleware handles cookie refresh. [VERIFIED: npm registry + Supabase official docs] |

### BLE Layer

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| Web Bluetooth API | Browser API | PM5 GATT data ingestion | Native Chrome API. No package. Stable on Chrome Android. [VERIFIED: Chrome Dev docs] |
| `@types/web-bluetooth` | 0.0.21 | TypeScript types for BLE | `navigator.bluetooth` typed as `any` without this package. [VERIFIED: npm registry] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `clsx` | latest | Conditional className | Every component with connection/session state variants |
| `date-fns` | latest | Date formatting | Session timestamps |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@serwist/next` | `@ducanh2912/next-pwa` | next-pwa fork is older; Serwist is the current ecosystem recommendation for Next.js 16 |
| `@serwist/next` | Next.js built-in PWA (no library) | Built-in gives manifest wiring; Serwist adds precaching + background sync stubs needed for offline session recovery |
| Zustand | React context | Context triggers broad re-renders on each PM5 notification (~4Hz); Zustand selective subscriptions prevent this |
| Tailwind v4 | Tailwind v3 | v4 is confirmed latest; config approach differs significantly. Use v4 to avoid future migration cost. |

**Installation:**

```bash
# Scaffold
npx create-next-app@latest rowai --typescript --app --src-dir
# (tailwind is included via create-next-app prompts — select yes for tailwind)

# Auth + DB
npm install @supabase/supabase-js @supabase/ssr

# BLE types
npm install @types/web-bluetooth

# State
npm install zustand

# Validation
npm install zod

# PWA
npm install @serwist/next
npm install -D serwist

# Tailwind v4 PostCSS (if not auto-added by scaffolder)
npm install tailwindcss @tailwindcss/postcss postcss

# Dev
npm install -D vitest @vitest/ui
npm install -D @playwright/test
```

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── onboarding/page.tsx
│   ├── session/page.tsx         # live rowing UI
│   ├── layout.tsx
│   ├── manifest.json
│   ├── sw.ts                    # Serwist service worker entry
│   └── globals.css
├── lib/
│   ├── ble/
│   │   ├── pm5-service.ts       # BLE connect, disconnect, reconnect
│   │   ├── pm5-parser.ts        # DataView byte parsing → StrokeReading
│   │   └── pm5-constants.ts     # UUID constants
│   ├── wake-lock/
│   │   └── wake-lock-manager.ts # acquire, release, visibilitychange handler
│   ├── session/
│   │   └── session-store.ts     # Zustand store: metrics, BLE status, session phase
│   └── supabase/
│       ├── client.ts            # createBrowserClient
│       └── server.ts            # createServerClient (for route handlers)
├── components/
│   ├── metrics/
│   │   └── MetricDisplay.tsx    # "one big number" layout
│   └── ble/
│       └── BleConnectButton.tsx # rationale screen + connect trigger
└── middleware.ts                # Supabase cookie refresh
```

### Pattern 1: BLE Ingestion as an Isolated Service Module

**What:** All Web Bluetooth logic lives in `lib/ble/pm5-service.ts`. Components never call `navigator.bluetooth` directly. The service emits typed events that the Zustand store subscribes to.

**When to use:** Always — this is the architectural boundary for Phase 1.

```typescript
// Source: Web Bluetooth API spec + ErgometerJS patterns
// lib/ble/pm5-constants.ts
export const PM5_SERVICE_UUID = 'ce060030-43e5-11e4-916c-0800200c9a66';
export const PM5_ROWING_STATUS_UUID = 'ce060031-43e5-11e4-916c-0800200c9a66';
export const PM5_EXTRA_STATUS1_UUID = 'ce060032-43e5-11e4-916c-0800200c9a66';
export const PM5_EXTRA_STATUS2_UUID = 'ce060033-43e5-11e4-916c-0800200c9a66';

// NOTE: UUIDs ce060031/32/33 are inferred from ErgometerJS source analysis [ASSUMED].
// MUST verify against official Concept2 PM5 Bluetooth Smart Interface Definition PDF
// before implementation. Fetch from: developers.concept2.com or request via
// Concept2 software development contact form.
```

```typescript
// lib/ble/pm5-service.ts — connection lifecycle
// Source: Chrome Web Bluetooth official sample (automatic-reconnect-async-await)
export class PM5Service extends EventTarget {
  private device: BluetoothDevice | null = null;

  async connect(): Promise<void> {
    // MUST be called from a user gesture handler
    this.device = await navigator.bluetooth.requestDevice({
      filters: [{ services: [PM5_SERVICE_UUID] }],
      optionalServices: [PM5_EXTRA_STATUS1_UUID, PM5_EXTRA_STATUS2_UUID]
    });
    this.device.addEventListener('gattserverdisconnected', this.onDisconnected);
    await this.connectGatt();
  }

  private async connectGatt(): Promise<void> {
    const server = await this.device!.gatt!.connect();
    const service = await server.getPrimaryService(PM5_SERVICE_UUID);
    // subscribe to all 3 rowing characteristics
    await this.subscribeCharacteristic(service, PM5_ROWING_STATUS_UUID, this.handleRowingStatus);
    await this.subscribeCharacteristic(service, PM5_EXTRA_STATUS1_UUID, this.handleExtraStatus1);
    await this.subscribeCharacteristic(service, PM5_EXTRA_STATUS2_UUID, this.handleExtraStatus2);
    this.dispatchEvent(new CustomEvent('connected'));
  }

  private onDisconnected = () => {
    this.dispatchEvent(new CustomEvent('disconnected'));
    this.reconnectWithBackoff(3, 2); // 3 attempts, starting 2s delay
  };

  private async reconnectWithBackoff(maxAttempts: number, delaySeconds: number): Promise<void> {
    if (maxAttempts === 0) {
      this.dispatchEvent(new CustomEvent('reconnect_failed'));
      return;
    }
    setTimeout(async () => {
      try {
        await this.connectGatt();
      } catch {
        await this.reconnectWithBackoff(maxAttempts - 1, delaySeconds * 2);
      }
    }, delaySeconds * 1000);
  }
}
```

### Pattern 2: Screen Wake Lock Manager with Visibility Re-acquisition

**What:** Acquire wake lock at session start, re-acquire on visibility restore.

```typescript
// Source: Chrome Dev Wake Lock guide + MDN Screen Wake Lock API
// lib/wake-lock/wake-lock-manager.ts
export class WakeLockManager {
  private sentinel: WakeLockSentinel | null = null;

  async acquire(): Promise<void> {
    if (!('wakeLock' in navigator)) return; // graceful degradation
    try {
      this.sentinel = await navigator.wakeLock.request('screen');
    } catch (err) {
      console.warn('Wake Lock not acquired:', err);
    }
  }

  release(): void {
    this.sentinel?.release();
    this.sentinel = null;
  }

  // Call this once on session start — it registers the visibility handler
  bindVisibilityChange(): void {
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible' && this.sentinel === null) {
        await this.acquire();
      }
    });
  }
}
```

### Pattern 3: PM5 Byte Parsing — StrokeReading Shape

**What:** Decode DataView bytes into typed `StrokeReading` immediately at the BLE notification boundary.

```typescript
// Source: ErgometerJS TypeScript source analysis [MEDIUM confidence on byte offsets]
// MUST verify byte offsets against official Concept2 PM5 BLE Interface Definition PDF

export interface StrokeReading {
  elapsedTimeMs: number;      // from Rowing General Status
  distanceMeters: number;     // from Rowing General Status (24-bit / 10)
  strokeState: number;        // 0=idle, 1=drive, 2=recover etc.
  strokeRate: number;         // from Extra Status 1 (spm)
  splitMs: number;            // from Extra Status 1 (pace per 500m in ms)
  watts: number;              // from Extra Status 2 (16-bit LE)
  timestamp: number;          // Date.now() at notification receipt
}

function parseRowingGeneralStatus(data: DataView): Partial<StrokeReading> {
  // Byte layout from ErgometerJS analysis [ASSUMED — verify offsets]
  const elapsedTimeMs = getUint24LE(data, 0) * 10; // offset 0, units 10ms
  const distanceMeters = getUint24LE(data, 3) / 10; // offset 3, units 0.1m
  const strokeState = data.getUint8(8);              // offset 8 [ASSUMED]
  return { elapsedTimeMs, distanceMeters, strokeState };
}

function parseExtraStatus1(data: DataView): Partial<StrokeReading> {
  // strokeRate: getUint8 at some offset [ASSUMED]
  // splitMs: (lowByte + highByte*256) * 10 — little-endian 16-bit [ASSUMED]
  const strokeRate = data.getUint8(0);               // [ASSUMED offset]
  const splitMs = (data.getUint8(1) + data.getUint8(2) * 256) * 10; // [ASSUMED]
  return { strokeRate, splitMs };
}

function parseExtraStatus2(data: DataView): Partial<StrokeReading> {
  const watts = data.getUint16(0, true);             // little-endian [ASSUMED offset]
  return { watts };
}

function getUint24LE(data: DataView, offset: number): number {
  return data.getUint8(offset) |
    (data.getUint8(offset + 1) << 8) |
    (data.getUint8(offset + 2) << 16);
}
```

### Pattern 4: Supabase Auth with Next.js App Router Middleware

**What:** `@supabase/ssr` with middleware that refreshes tokens on every request. Required for session persistence across browser refresh (ONBD-03).

```typescript
// Source: Supabase official docs (supabase.com/docs/guides/auth/quickstarts/nextjs)
// middleware.ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options));
        },
      },
    }
  );
  // Refresh token — this is what keeps the session alive across refreshes
  await supabase.auth.getUser();
  return supabaseResponse;
}
```

### Pattern 5: Session Auto-Start on First Stroke Detection

**What:** Monitor `strokeState` from PM5 notifications. Session "starts" when strokeState transitions from 0 (idle/waiting to drive) to 1 (drive phase). No button needed.

```typescript
// lib/session/session-store.ts (Zustand)
import { create } from 'zustand';

interface SessionStore {
  phase: 'idle' | 'active' | 'ended';
  metrics: StrokeReading | null;
  bleStatus: 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
  handleStrokeReading: (reading: StrokeReading) => void;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  phase: 'idle',
  metrics: null,
  bleStatus: 'disconnected',
  handleStrokeReading: (reading) => {
    const current = get();
    // Auto-start: first non-idle stroke state triggers session
    if (current.phase === 'idle' && reading.strokeState > 0) {
      set({ phase: 'active', metrics: reading });
      return;
    }
    set({ metrics: reading });
  }
}));
```

### Pattern 6: Serwist PWA Configuration

```typescript
// Source: serwist.pages.dev/docs/next/getting-started [VERIFIED]
// next.config.ts
import withSerwistInit from '@serwist/next';
const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development', // prevent caching headaches in dev
});
export default withSerwist({ /* next config */ });
```

### Pattern 7: Tailwind v4 Configuration

```css
/* src/app/globals.css — replaces tailwind.config.js directives */
@import "tailwindcss";

/* Custom theme tokens via @theme */
@theme {
  --color-primary: oklch(65% 0.15 220);
  /* breakpoints, fonts etc. go here */
}
```

### Anti-Patterns to Avoid

- **BLE in components:** Never call `navigator.bluetooth` from a React component. Always go through the `PM5Service` class.
- **AudioContext at module load:** Do NOT create AudioContext during app init (Phase 2 concern, but establish the discipline now — see Pitfalls).
- **Raw bytes in Zustand:** Decode DataView → `StrokeReading` at the BLE layer boundary, never store raw bytes in state.
- **`@ducanh2912/next-pwa`:** Don't use this — Serwist is the 2026 standard for Next.js 16.
- **`@supabase/auth-helpers-nextjs`:** Deprecated, use `@supabase/ssr`.
- **Tailwind config file assumed:** Do not create `tailwind.config.js` expecting v3 behavior — v4 is CSS-first.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Auth session cookies | Custom JWT parsing | `@supabase/ssr` middleware | Token refresh edge cases, CSRF handling, secure cookie flags |
| Service worker caching | Custom fetch interceptor | Serwist | Cache versioning, stale-while-revalidate, precaching strategy |
| BLE exponential backoff | Custom setTimeout chain | Pattern from Chrome official sample (tested) | Off-by-one bugs, memory leaks in retry closures |
| PM5 byte parsing | Schema inference from raw bytes | Official Concept2 BLE spec PDF | Firmware version differences silently produce wrong values |
| Wake Lock re-acquisition | App-level polling | Standard `visibilitychange` listener | The browser tells you exactly when to re-acquire |

**Key insight:** The BLE and PWA APIs are well-specified. The failure modes are in implementation discipline (when to acquire wake lock, when to re-acquire, decode at the boundary) — not in missing libraries.

---

## Common Pitfalls

### Pitfall 1: BLE GATT Connection Dies on Screen Lock (CRITICAL)

**What goes wrong:** Chrome Android suspends BLE when the screen locks or the PWA goes to background.

**Why it happens:** Battery management kills background radio operations in PWAs without an active Wake Lock. Wake Lock also releases on tab hide and must be re-requested.

**How to avoid:**
- Request Wake Lock before BLE connect, inside session start handler
- Register `visibilitychange` listener to re-acquire Wake Lock
- Register `gattserverdisconnected` handler on the device object before connecting

**Warning signs:** No `visibilitychange` handler; Wake Lock acquired once and never refreshed.

### Pitfall 2: Bluetooth Permission Denied — No Recovery Path

**What goes wrong:** User taps "Deny" on the Android Bluetooth system dialog. App breaks silently. User can't re-request without going to Android settings.

**Why it happens:** Chrome BLE dialog lacks context about why Bluetooth is needed.

**How to avoid (D-06):**
- Show rationale screen BEFORE calling `requestDevice()`
- Handle `DOMException: User cancelled` explicitly — show a recovery UI with link to Android Bluetooth settings
- Test this path explicitly on a real Android device

**Warning signs:** `requestDevice()` called without a rationale screen; no catch for `DOMException`.

### Pitfall 3: PM5 Characteristic Byte Offsets Wrong

**What goes wrong:** Parser produces plausible but wrong values — e.g., stroke rate always reads as 0, split reads as a garbage number. Silently wrong during a real workout.

**Why it happens:** Byte offsets inferred from community sources rather than the official Concept2 BLE spec PDF. ErgometerJS source analysis gives HIGH-confidence structure but MEDIUM-confidence exact offsets.

**How to avoid:**
- Fetch the official Concept2 PM5 Bluetooth Smart Interface Definition PDF from developers.concept2.com before writing the parser
- Add range validation: `splitMs` must be between 60_000 (1:00/500m) and 900_000 (15:00/500m); `strokeRate` must be 0-60 spm; `watts` must be 0-1000
- Log raw DataView bytes in development for the first 10 strokes to verify parsing

**Warning signs:** Parser written without consulting the official PDF; no range assertions on parsed values.

### Pitfall 4: Next.js 16 vs Stack Doc Assumptions (CRITICAL for Scaffolding)

**What goes wrong:** The project-level STACK.md assumes Next.js 15.x. The npm registry shows 16.2.3 is `latest`. If the team scaffolds with `create-next-app@latest`, they get Next.js 16. If they pin to 15.x assuming that's stable, they incur tech debt immediately.

**Why it happens:** STACK.md was written in August 2025; Next.js 16 shipped since then.

**How to avoid:** Use `create-next-app@latest` (gets 16.2.3). Do not pin to 15.x. The peerDependency on React is `^18.2.0 || ^19.0.0` — both work.

### Pitfall 5: Tailwind v4 Config Mismatch

**What goes wrong:** Developer creates `tailwind.config.js` expecting v3 behavior. Config is silently ignored in v4. Custom colors and breakpoints don't apply.

**Why it happens:** `create-next-app@latest --tailwind` may scaffold differently than expected; muscle memory from v3.

**How to avoid:** Use CSS-based config with `@theme` directive in `globals.css`. Do NOT create `tailwind.config.js`. If customizations are needed, all go in CSS.

### Pitfall 6: Supabase RLS Disabled (Silent Security Hole)

**What goes wrong:** All users can read each other's session data via the Supabase anon key.

**Why it happens:** Supabase new tables default to RLS disabled.

**How to avoid:** Enable RLS on ALL tables at creation time. Write the RLS policies in the first migration, before any data. Test with three personas: anon, user A, user B.

### Pitfall 7: `@supabase/auth-helpers-nextjs` Import After Migration

**What goes wrong:** Old import paths cause runtime errors or silent auth failures.

**How to avoid:** Use only `@supabase/ssr` imports. The `createBrowserClient` / `createServerClient` API is the current pattern. Do not install `@supabase/auth-helpers-nextjs`.

---

## Code Examples

### Supabase Auth Sign-Up (ONBD-01)

```typescript
// Source: Supabase official docs — email/password signup
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';

export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Signup call
const { data, error } = await supabase.auth.signUp({
  email,
  password,
});
```

### Session Persistence Check (ONBD-03)

```typescript
// Run in middleware — refreshes the token and keeps session alive across refresh
// Source: Supabase official docs, middleware pattern
await supabase.auth.getUser(); // this internally refreshes cookies
```

### BLE Request Device (BLE-01) — Must Be in User Gesture Handler

```typescript
// Source: Chrome Web Bluetooth API docs
const device = await navigator.bluetooth.requestDevice({
  filters: [{ services: ['ce060030-43e5-11e4-916c-0800200c9a66'] }],
});
```

### Screen Wake Lock with Re-acquisition (BLE-03)

```typescript
// Source: Chrome Dev Wake Lock guide
let wakeLock: WakeLockSentinel | null = null;

async function acquireWakeLock() {
  try {
    wakeLock = await navigator.wakeLock.request('screen');
  } catch (err) {
    console.warn('Wake lock failed:', err);
  }
}

// Register once at session start
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible') {
    await acquireWakeLock();
  }
});

await acquireWakeLock(); // initial acquire
```

### BLE Auto-Reconnect (BLE-05)

```typescript
// Source: Chrome official automatic-reconnect-async-await sample
device.addEventListener('gattserverdisconnected', () => {
  exponentialBackoff(3, 2,
    () => device.gatt!.connect(),
    (server) => { /* re-subscribe characteristics */ },
    () => { /* surface "reconnect failed" to user */ }
  );
});

async function exponentialBackoff(max: number, delay: number,
  toTry: () => Promise<unknown>,
  success: (result: unknown) => void,
  fail: () => void
): Promise<void> {
  try {
    success(await toTry());
  } catch {
    if (max === 0) return fail();
    setTimeout(() => exponentialBackoff(--max, delay * 2, toTry, success, fail),
      delay * 1000);
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `@shadowwalker/next-pwa` | `@serwist/next` | 2024-2025 | `@ducanh2912/next-pwa` (the active fork) is now itself superseded by Serwist as the 2026 community standard |
| Next.js 15.x (STACK.md assumption) | Next.js 16.2.3 | 2025-2026 | `latest` tag on npm; must scaffold with this version |
| Tailwind v3 `tailwind.config.js` | Tailwind v4 CSS-first `@theme` | Early 2025 | No config JS file by default; `@tailwindcss/postcss` replaces direct `tailwindcss` PostCSS plugin |
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2024 | Auth Helpers deprecated; `@supabase/ssr` is the current SSR package |
| Zustand v4 | Zustand v5 | 2025 | v5.0.12 is `latest`; API largely compatible but verify store creation patterns |

**Deprecated / outdated (do not use):**
- `@shadowwalker/next-pwa`: Original next-pwa, unmaintained
- `@ducanh2912/next-pwa`: Active fork but Serwist is now preferred for Next.js 16
- `@supabase/auth-helpers-nextjs`: Deprecated, replaced by `@supabase/ssr`

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Characteristic UUIDs for PM5 rowing data are ce060031 (general status), ce060032 (extra status 1), ce060033 (extra status 2) | Standard Stack / Code Examples | Wrong UUIDs mean BLE connect succeeds but data subscriptions fail silently. Blocks BLE-02. |
| A2 | Byte offsets for strokeRate, splitMs, distanceMeters in the three characteristics match ErgometerJS source analysis | Code Examples (parseExtraStatus1/2) | Silently wrong metric values — rows at 28 spm, app shows 0 or garbage. Blocks BLE-02. |
| A3 | Zustand v5 store creation API is backward-compatible with v4 patterns shown | Code Examples | Minor — store API may need update if `create()` signature changed |
| A4 | Serwist v9.5.7 is fully compatible with Next.js 16.2.3 (peerDep says `>=14.0.0`) | Standard Stack | PWA service worker may not generate; app not installable |

**Critical:** A1 and A2 MUST be resolved by consulting the official Concept2 PM5 Bluetooth Smart Interface Definition PDF before writing any GATT parsing code. Do not skip this verification step.

---

## Open Questions

1. **Official Concept2 BLE Spec Access**
   - What we know: The spec PDF exists at developers.concept2.com or via concept2.com/support/software-development contact. The URL http://www.concept2.cn/files/pdf/us/monitors/PM5_BluetoothSmartInterfaceDefinition.pdf exists but may be outdated.
   - What's unclear: Whether the spec is freely downloadable or requires a developer account request.
   - Recommendation: Wave 0 task — fetch or request the spec PDF before writing `pm5-parser.ts`. The ErgometerJS TypeScript source (`api/typescript/ergometer/performancemonitorBle.ts`) on GitHub is a viable reference while waiting.

2. **Supabase Project Creation**
   - What we know: CONTEXT.md lists "Supabase project (to be created)" as an integration point.
   - What's unclear: Whether a Supabase project and credentials exist yet.
   - Recommendation: Wave 0 task — create Supabase project, copy URL and anon key to `.env.local`, run `supabase gen types typescript` after schema creation.

3. **`strokeState` Values for Auto-Start Detection (D-08)**
   - What we know: `strokeState` is a byte in the Rowing General Status characteristic. ErgometerJS references states like idle, drive, recover.
   - What's unclear: Exact numeric values for each state (0=idle? 1=drive? 2=catch? 3=recover?).
   - Recommendation: Verify in the official Concept2 spec PDF. Interim: treat any non-zero strokeState as "rowing in progress" for auto-start.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|---------|
| Node.js | npm installs, Next.js dev server | ✓ | (assumed present) | — |
| npm | Package installation | ✓ | (assumed present) | — |
| Chrome Android (physical) | BLE-01, BLE-02 full integration test | ✗ (not in this env) | — | Playwright Chromium for unit tests; PM5 emulator for integration |
| Supabase project | ONBD-01, ONBD-03 | ✗ (to be created) | — | No fallback — must create before Wave 1 |
| Concept2 PM5 hardware | BLE-01, BLE-02 smoke test | ✗ (not in this env) | — | ErgometerJS-style emulator or pm5-emulator (Go) for dev; physical device needed for acceptance |
| Vercel account | Deployment | ✗ (to be configured) | — | `next dev` sufficient for Phase 1 dev; Vercel needed before HTTPS-requiring BLE tests on device |

**Missing dependencies with no fallback:**
- Supabase project: must be created before any auth work can proceed. Wave 0 task.

**Missing dependencies with fallback:**
- Chrome Android + PM5 hardware: can develop and unit-test BLE parsing with mocked DataView fixtures; full integration requires real device.
- Vercel: local dev works for everything except testing BLE on a real Android device (requires HTTPS). Set up Vercel tunnel or ngrok as interim.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.4 |
| Config file | `vitest.config.ts` — Wave 0 gap, does not exist yet |
| Quick run command | `npx vitest run` |
| Full suite command | `npx vitest run --coverage` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| BLE-01 | requestDevice called from user gesture, correct service filter | unit (mock navigator.bluetooth) | `npx vitest run src/lib/ble/pm5-service.test.ts` | ❌ Wave 0 |
| BLE-02 | DataView bytes → StrokeReading values correct | unit (fixture DataViews) | `npx vitest run src/lib/ble/pm5-parser.test.ts` | ❌ Wave 0 |
| BLE-03 | Wake Lock acquired on session start; re-acquired on visibilitychange | unit (mock navigator.wakeLock) | `npx vitest run src/lib/wake-lock/wake-lock-manager.test.ts` | ❌ Wave 0 |
| BLE-04 | gattserverdisconnected fires → bleStatus = 'reconnecting', announcement shown | unit (mock device event) | `npx vitest run src/lib/ble/pm5-service.test.ts` | ❌ Wave 0 |
| BLE-05 | Reconnect attempts with backoff; max 3 tries; reconnect_failed event after exhaustion | unit | `npx vitest run src/lib/ble/pm5-service.test.ts` | ❌ Wave 0 |
| ONBD-01 | Email/password signup creates Supabase user | integration (test Supabase project) | manual smoke test | ❌ Wave 0 |
| ONBD-02 | Onboarding form submits name+email; profile row created | integration | manual smoke test | ❌ Wave 0 |
| ONBD-03 | Browser refresh → user still logged in (cookie present) | integration (Playwright) | `npx playwright test tests/auth.spec.ts` | ❌ Wave 0 |

**Note:** BLE-01, BLE-04, BLE-05 cannot be fully integration-tested without a physical PM5 + Chrome Android. The above Vitest tests use mocked `navigator.bluetooth` and synthetic events. Physical device testing is the acceptance gate, not automated CI.

### Sampling Rate

- **Per task commit:** `npx vitest run` (unit tests only, <10s)
- **Per wave merge:** `npx vitest run --coverage` + manual smoke on dev server
- **Phase gate:** All unit tests green + manual BLE smoke test on Chrome Android with physical PM5

### Wave 0 Gaps

- [ ] `src/lib/ble/pm5-service.test.ts` — covers BLE-01, BLE-04, BLE-05
- [ ] `src/lib/ble/pm5-parser.test.ts` — covers BLE-02 with fixture DataViews
- [ ] `src/lib/wake-lock/wake-lock-manager.test.ts` — covers BLE-03
- [ ] `vitest.config.ts` — test framework config
- [ ] `tests/auth.spec.ts` — Playwright test for ONBD-03

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Supabase Auth (email/password); `@supabase/ssr` for session cookies |
| V3 Session Management | yes | `@supabase/ssr` middleware refreshes tokens; cookie-based session |
| V4 Access Control | yes | Supabase RLS on all tables; no anon read on any user data |
| V5 Input Validation | yes | Zod for onboarding form fields; range validation on PM5 parsed values |
| V6 Cryptography | no (handled by Supabase) | Supabase manages password hashing (bcrypt) and JWT signing |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-user data read via anon key | Information Disclosure | Supabase RLS enabled at table creation; deny anon reads on all tables |
| GATT data injection (malicious BLE device) | Tampering | Range validation on all parsed PM5 values via Zod; requestDevice filter limits to PM5 service UUID |
| Session fixation / stale token | Elevation of Privilege | `@supabase/ssr` middleware refreshes token on every request |
| API key exposure on client | Information Disclosure | All Anthropic/Cartesia API calls via Next.js route handlers; anon Supabase key (publishable) is acceptable on client |
| BLE eavesdropping | Information Disclosure | Web Bluetooth is device-local; raw BLE bytes never leave the browser |

---

## Sources

### Primary (HIGH confidence)
- npm registry (`npm view` commands) — verified all package versions live
- [Chrome Web Bluetooth guide](https://developer.chrome.com/docs/capabilities/bluetooth) — requestDevice, GATT connect, gattserverdisconnected patterns
- [Chrome Screen Wake Lock guide](https://developer.chrome.com/docs/capabilities/web-apis/wake-lock) — acquire, release, visibilitychange re-acquisition
- [Chrome automatic-reconnect-async-await sample](https://googlechrome.github.io/samples/web-bluetooth/automatic-reconnect-async-await.html) — exponential backoff implementation
- [Serwist @serwist/next docs](https://serwist.pages.dev/docs/next/getting-started) — Next.js 16 PWA setup
- [Tailwind CSS v4 + Next.js install guide](https://tailwindcss.com/docs/guides/nextjs) — CSS-first config, PostCSS plugin
- [Supabase Auth Next.js quickstart](https://supabase.com/docs/guides/auth/quickstarts/nextjs) — @supabase/ssr patterns, middleware

### Secondary (MEDIUM confidence)
- [ErgometerJS TypeScript source](https://github.com/tijmenvangulik/ErgometerJS/blob/master/api/typescript/ergometer/performancemonitorBle.ts) — PM5 GATT characteristic handlers and byte parsing structure (byte offsets not confirmed from official spec)
- [pm5-emulator GitHub](https://github.com/raralabs/pm5-emulator) — confirms service UUID structure pattern
- WebSearch results for Next.js 16 PWA + Serwist (2026) — ecosystem direction confirmed across multiple sources
- [Andre Bandarra Web Bluetooth article](https://bandarra.me/2017/02/20/Fitness-Tracking-with-Web-Bluetooth/) — confirmed ce060031 as "General Info" in Rowing Service

### Tertiary (LOW confidence — requires verification before implementation)
- Concept2 PM5 characteristic UUIDs ce060031/ce060032/ce060033 inferred from ErgometerJS source and community discussion — MUST verify against official Concept2 BLE spec PDF before use
- Exact byte offsets for strokeRate, splitMs, distanceMeters — same caveat

---

## Metadata

**Confidence breakdown:**
- Standard stack (library versions): HIGH — all verified against npm registry live
- PWA approach (Serwist): MEDIUM-HIGH — confirmed via WebSearch and npm, not validated in a working Next.js 16 build
- BLE API patterns (connect, reconnect, wake lock): HIGH — verified against Chrome official docs and samples
- PM5 GATT byte parsing: MEDIUM — characteristic UUID structure inferred from ErgometerJS, exact offsets unverified
- Supabase auth pattern: HIGH — verified against official Supabase docs
- Tailwind v4 setup: HIGH — verified against official Tailwind docs

**Research date:** 2026-04-09
**Valid until:** 2026-05-09 (stable stack; verify Next.js version if significantly delayed)
