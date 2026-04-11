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

**Phase 2: Coaching Loop** -- Complete

- Coaching pipeline core (types, Zustand store, AudioQueue with priority interrupt, StrokeProcessor, CueRouter, cue templates)
- Server API routes: Claude streaming proxy (`/api/coach`), Cartesia TTS proxy (`/api/tts`), session writer
- Pre-session check-in screen (energy level, time available, session suggestion)
- Mid-session tap controls ("Too Hard" / "Push Me" / "I'm Good")
- Coaching indicator (pulsing bar when coach speaks)
- Post-session voice debrief with session summary card
- Session data and coach memory persistence to Supabase

**Phase 3: Memory & History** -- Complete

- Memory snapshot reader (last 5 sessions + top 20 KV entries, ~500 tokens)
- Server-side memory injection into coach system prompt
- Offline caching with localStorage fallback and auto-sync on reconnect
- Session history page (`/history`) with card list sorted by date
- Auth guard on coach API route

## Tech Stack

- **Frontend:** Next.js 16, React 19, Tailwind CSS v4, TypeScript
- **PWA:** Serwist (service worker)
- **Auth/DB:** Supabase (Postgres + Auth)
- **BLE:** Web Bluetooth API (Chrome Android)
- **Voice:** Cartesia Sonic (streaming TTS)
- **AI:** Claude API (coaching responses, debrief)
- **State:** Zustand
- **Testing:** Vitest

## Getting Started

### Prerequisites

- Node.js 20+
- A Supabase project (for auth and database)
- Chrome Android or Chrome desktop (for Web Bluetooth)
- Concept2 PM5 rower (for BLE data)
- Anthropic API key (for Claude coaching responses)
- Cartesia API key + voice ID (for streaming TTS)

### Setup

```bash
# Install dependencies
npm install

# Add env vars to .env.local
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
ANTHROPIC_API_KEY=sk-ant-...
CARTESIA_API_KEY=...
CARTESIA_VOICE_ID=...

# Link Supabase and push schema
npx supabase link --project-ref <ref>
npx supabase db push

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
    api/
      coach/        # Claude streaming proxy (SSE) — 5 coaching intents
      tts/          # Cartesia TTS streaming proxy (SSE)
    checkin/        # Pre-session check-in (energy, time, session suggestion)
    onboarding/     # Name-only onboarding (D-04)
    session/        # Main rowing session page + coaching controls
  components/
    ble/            # BleConnectButton (rationale + connect)
    checkin/        # CheckinScreen, TapInputRow
    coaching/       # CoachingIndicator, MidSessionControls
    metrics/        # MetricDisplay (split large, secondaries)
    session/        # SessionEndPrompt
  hooks/
    useCoachingSession.ts  # Wires StrokeProcessor → CueRouter → AudioQueue
    useSessionLifecycle.ts # Auto-start/end state machine
  lib/
    ble/            # PM5 constants, parser (TDD), service
    coaching/       # Types, store, AudioQueue, StrokeProcessor, CueRouter, cue templates, session writer
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
