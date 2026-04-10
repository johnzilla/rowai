# RowAI

Voice-first AI rowing coach for Concept2 indoor rowers. Reads real-time PM5 data via Bluetooth, remembers your workout history and patterns, and delivers adaptive coaching through streaming voice.

## Status

**Phase 1: Foundation** -- Complete

- Next.js 16 PWA with Serwist service worker
- Supabase email/password auth with session persistence
- PM5 BLE data pipeline (Web Bluetooth GATT)
- Real-time metrics display (split, SPM, watts, distance)
- Session lifecycle (auto-start on first stroke, auto-end after 30s idle)
- Screen Wake Lock for session stability
- BLE disconnect recovery with timer fallback mode

**Phase 2: Coaching Loop** -- Up next

**Phase 3: Memory & History** -- Planned

## Tech Stack

- **Frontend:** Next.js 16, React 19, Tailwind CSS v4, TypeScript
- **PWA:** Serwist (service worker)
- **Auth/DB:** Supabase (Postgres + Auth)
- **BLE:** Web Bluetooth API (Chrome Android)
- **State:** Zustand
- **Testing:** Vitest

## Getting Started

### Prerequisites

- Node.js 20+
- A Supabase project (for auth and database)
- Chrome Android or Chrome desktop (for Web Bluetooth)
- Concept2 PM5 rower (for BLE data)

### Setup

```bash
# Install dependencies
npm install

# Copy env template and fill in your Supabase credentials
cp .env.local.example .env.local

# Push database schema (requires Supabase CLI + linked project)
supabase db push

# Run dev server
npm run dev
```

### Testing

```bash
# Run PM5 parser tests
npm test

# Type check
npx tsc --noEmit
```

## Architecture

```
src/
  app/
    (auth)/         # Login, signup pages
    onboarding/     # Name-only onboarding (D-04)
    session/        # Main rowing session page
  components/
    ble/            # BleConnectButton (rationale + connect)
    metrics/        # MetricDisplay (split large, secondaries)
    session/        # SessionEndPrompt
  hooks/
    useSessionLifecycle.ts  # Auto-start/end state machine
  lib/
    ble/            # PM5 constants, parser (TDD), service
    session/        # Zustand session store
    supabase/       # Client, server, middleware helpers
    wake-lock/      # WakeLockManager
```

## Key Design Decisions

- **Voice-first, no avatar** -- core hypothesis is the coaching relationship, not visual presence
- **PWA on Chrome Android** -- Web Bluetooth works here; iOS Safari does not support it
- **PM5 BLE read-only** -- stroke rate, split, watts, distance. No Logbook API write-back in v1
- **Minimal onboarding** -- name only upfront, experience/tone/injuries collected progressively
- **Hybrid coaching cues** -- pre-computed templates (<200ms) for common patterns, LLM for novel situations

## License

Private
