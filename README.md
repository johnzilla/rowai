# RowAI

Voice-first AI rowing coach for Concept2 indoor rowers. Reads real-time PM5 data via Bluetooth, remembers your workout history and patterns, and delivers adaptive coaching through streaming voice.

**v1.0 MVP shipped** -- all core features complete.

## What It Does

1. **Check in** -- Coach greets you, asks about energy and time, suggests a session type
2. **Connect** -- Pair your Concept2 PM5 via Bluetooth
3. **Row** -- Real-time voice coaching with adaptive cues (pace, effort, encouragement)
4. **Interact** -- Tap "Too Hard" / "Push Me" / "I'm Good" for instant coach response
5. **Finish** -- Voice debrief summarizing your session, stats saved automatically
6. **Remember** -- Next session, the coach knows your history and references past workouts

## Features

- Real-time PM5 BLE data (stroke rate, split, watts, distance)
- Pre-computed cue engine (<500ms) + Claude LLM for novel coaching situations
- Cartesia Sonic streaming text-to-speech
- Two-tier priority audio queue (corrections interrupt encouragement)
- Session memory: last 5 sessions + 20 KV memory entries in every coach prompt
- Offline session caching with auto-sync on reconnect
- Session history browsing

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
    history/        # Session history (card list sorted by date)
    onboarding/     # Name-only onboarding (D-04)
    session/        # Main rowing session page + coaching controls + debrief
  components/
    ble/            # BleConnectButton (rationale + connect)
    checkin/        # CheckinScreen, TapInputRow
    coaching/       # CoachingIndicator, MidSessionControls
    history/        # SessionHistoryList (card list)
    metrics/        # MetricDisplay (split large, secondaries)
    session/        # SessionEndPrompt, SessionSummaryCard
    SyncTrigger.tsx # Offline write sync (app load + reconnect)
  hooks/
    useCoachingSession.ts  # Wires StrokeProcessor → CueRouter → AudioQueue
    useSessionLifecycle.ts # Auto-start/end + debrief state machine
  lib/
    ble/            # PM5 constants, parser (TDD), service
    coaching/       # Types, store, AudioQueue, StrokeProcessor, CueRouter, cue templates, session writer, memory snapshot, offline cache
    session/        # Zustand session store
    supabase/       # Client, server, middleware helpers
    wake-lock/      # WakeLockManager
```

## Key Design Decisions

- **Voice-first, no avatar** -- core hypothesis is the coaching relationship, not visual presence
- **PWA on Chrome Android** -- Web Bluetooth works here; iOS Safari does not support it
- **Hybrid coaching cues** -- pre-computed templates (<500ms) for common patterns, Claude LLM for novel situations
- **Tap-only interaction** -- erg noise makes speech recognition unreliable; 3 fixed buttons cover core needs
- **Fixed-size memory snapshot** -- last 5 sessions + top 20 KV entries (~500 tokens), assembled server-side
- **Supabase Postgres KV** -- structured session data + key-value coach memory; no vector DB needed at this scale
- **Offline-first writes** -- localStorage fallback when Supabase is unavailable, auto-sync on reconnect

## License

Private
