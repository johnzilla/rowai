<!-- GSD:project-start source:PROJECT.md -->
## Project

**RowAI**

RowAI is a voice-first AI rowing coach for Concept2 indoor rowers. It reads real-time PM5 data via Bluetooth, remembers your workout history and patterns, and delivers adaptive coaching through streaming voice — pre-session check-ins, real-time pacing cues, and post-session debriefs. Built as a PWA on Chrome Android. For adults who row at home and want a coach who actually knows them.

**Core Value:** A coaching relationship that compounds across sessions — the coach remembers you, adapts to your energy, and makes solo rowing feel relational rather than solitary.

### Constraints

- **Platform**: PWA on Chrome Android. Native iOS deferred to v2.
- **Solo builder**: Minimize infrastructure. Use managed services (Supabase, Cartesia, Claude API, Vercel).
- **Latency**: Voice cues <500ms for pre-computed path. LLM path may exceed but acceptable for conversational responses.
- **Privacy**: No camera in MVP. No raw biometric data to third parties. Session memory in user's Supabase account.
- **BLE scope**: Read-only PM5 data. No Logbook API write-back in v1.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Core Framework
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js | 15.x | App shell, routing, API routes | App Router enables server components and route handlers needed for proxying LLM/TTS API keys server-side (never expose keys to client). PWA support via `next-pwa` or `@ducanh2912/next-pwa`. Strong Vercel deployment story. Overkill for a single-user app but the server-side API route pattern is non-negotiable for key security. |
| React | 19.x | UI rendering | Comes with Next.js 15. React 19 concurrent features (useTransition, Suspense) map well to streaming TTS state. No reason to use anything else here. |
| TypeScript | 5.x | Type safety | BLE GATT descriptors, audio buffer types, and Supabase schema types all benefit from strict typing. Catches null-safety issues at compile time that would silently break during a workout. |
### PWA Layer
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@ducanh2912/next-pwa` | latest | Service worker, offline cache, installability | The original `next-pwa` (`@shadowwalker/next-pwa`) is largely unmaintained. `@ducanh2912/next-pwa` is the active fork with Next.js App Router support. Handles precaching, background sync stubs, and the Web App Manifest wiring. |
| Web App Manifest | — | PWA installability, display mode | Must set `"display": "standalone"` and `"orientation": "portrait"` for the rowing form factor. Required for "Add to Home Screen" prompt on Chrome Android. |
| Screen Wake Lock API | Browser API | Prevent screen sleep during BLE session | Native browser API, no library needed. `navigator.wakeLock.request('screen')`. Re-acquire on `visibilitychange` because lock releases on tab hide. Critical: without this, Chrome Android will suspend BLE and cut audio mid-session. |
### Web Bluetooth
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Web Bluetooth API | Browser API | PM5 GATT data ingestion | Native browser API. No library needed; the spec is stable on Chrome Android. The PM5 GATT service UUID `CE060030-43E5-11E4-916C-0800200C9A66` is documented in Concept2's PM BLE specification. |
| `@types/web-bluetooth` | latest | TypeScript types for BLE APIs | The Web Bluetooth API types are not in the default `lib.dom.d.ts` as of TS 5.x; this package adds them. Without it, `navigator.bluetooth` is typed as `any`. |
### Streaming TTS (Cartesia)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@cartesia/cartesia-js` | latest | Cartesia Sonic streaming TTS | Official Cartesia JavaScript SDK. Supports WebSocket streaming for low-latency audio delivery. Cartesia Sonic is the specified TTS for this project. |
| Web Audio API | Browser API | Audio playback and buffer management | Native browser API. Use `AudioContext` for playing streaming PCM/Opus chunks as they arrive. Enables sub-sentence latency — start playing first audio chunk before full TTS response is received. No library needed. |
### LLM Integration (Claude API)
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@anthropic-ai/sdk` | latest | Claude API for novel coaching situations | Official Anthropic TypeScript SDK. Used server-side only (Next.js route handler). Supports streaming responses. Claude 3.5 Haiku is the recommended model for real-time coaching: ~440-940ms latency vs Sonnet/Opus which exceed 1s+. |
| Next.js Route Handlers | — | Server-side LLM proxy | All Claude API calls go through `/api/coach` route handler. The API key never reaches the client. Route handlers support `StreamingTextResponse` to stream LLM tokens back to the PWA. |
- Novel user states (injury mention, emotional distress signals)
- Post-session debrief narrative generation
- Pre-session check-in responses that don't match templates
### Database and Backend Services
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Supabase | hosted | Postgres DB, auth, real-time | Managed Postgres with row-level security. Stores session history, user profile, coach memory KV, onboarding data. The JS client (`@supabase/supabase-js`) works directly from the Next.js API routes and can be called client-side for non-sensitive reads. |
| `@supabase/supabase-js` | 2.x | Supabase JS client | v2 client is the current stable branch. Supports typed queries via generated types. |
| `@supabase/ssr` | latest | Server-side Supabase client for Next.js | Required for App Router server components and route handlers. Replaces the old `@supabase/auth-helpers-nextjs` package. |
- `sessions` — workout_date, duration_s, avg_split, avg_watts, avg_stroke_rate, total_meters, pm5_raw_json
- `user_profile` — name, experience_level, coaching_tone, injuries_text, onboarding_complete
- `coach_memory` — key (text), value (text), last_updated — used as a KV store for the coach's persistent observations
### Deployment
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vercel | hosted | App hosting and deployment | First-class Next.js support. Edge functions for low-latency API routes. Free tier sufficient for solo builder. Automatic HTTPS (required for Web Bluetooth — BLE only works on secure origins). Zero-config deployment from git push. |
### State Management
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Zustand | 4.x or 5.x | Global session state | Lightweight. The session state (BLE connection status, current split/watts/stroke rate, TTS playing state, coach mode) is read from multiple components and needs to survive re-renders without prop drilling. Redux is overkill. React context re-renders too broadly for high-frequency PM5 data (updates every ~1-2 seconds). |
### Testing
| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vitest | 2.x | Unit and integration tests | Fast, native ESM, compatible with Next.js 15. Test the coaching template engine, cue selection logic, and session state machine — these are pure logic and should have high coverage. |
| Playwright | 1.4x | E2E PWA tests | Can test the full PWA flow on a Chromium instance. Web Bluetooth can be mocked via CDP or test fixtures. Critical for regression-testing the BLE → coaching → TTS pipeline without a physical PM5. |
### Supporting Libraries
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `clsx` | latest | Conditional className | Every component with loading/active/error states |
| `tailwindcss` | 3.x or 4.x | Utility CSS | Workout UI needs fast iteration. Minimal custom CSS. |
| `zod` | 3.x | Runtime schema validation | Validate PM5 GATT data shapes, API payloads, and Supabase row shapes before use |
| `date-fns` | 3.x | Date formatting | Session timestamps, streak calculations |
## Alternatives Considered
| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Framework | Next.js 15 | Vite + React SPA | Vite SPA can't server-side proxy API keys without adding a separate backend. Next.js route handlers solve this cleanly. |
| Framework | Next.js 15 | Remix | Valid but smaller ecosystem for PWA tooling; fewer examples for the BLE + streaming audio pattern. |
| TTS | Cartesia Sonic | ElevenLabs | Higher latency on streaming path; more expensive at volume; less tuned for real-time use cases. |
| TTS | Cartesia Sonic | Browser SpeechSynthesis | Quality unacceptable; no voice control; platform-dependent. |
| LLM | Claude API (Haiku) | GPT-4o mini | Both viable; Claude is specified in project doc. Haiku's latency profile is comparable. |
| DB | Supabase Postgres | PlanetScale / Neon | Supabase provides auth + DB + realtime in one service. Avoids multi-vendor complexity for a solo builder. |
| DB | Supabase Postgres | Vector DB (pgvector, Pinecone) | Explicitly deferred in project scope. Structured KV coach memory is sufficient for v1. |
| State | Zustand | Jotai | Jotai valid, but Zustand's imperative `set()` pattern is cleaner for the session state machine. |
| CSS | Tailwind | CSS Modules | Tailwind is faster for a solo builder iterating on workout UI. |
| Deployment | Vercel | Railway / Render | Vercel has tighter Next.js integration and HTTPS out of the box. Railway is a good fallback if Vercel pricing becomes an issue at scale. |
## Installation
# Scaffold Next.js app
# Core dependencies
# PWA
# Dev dependencies
## Key Version Verification Checklist
- [ ] Next.js current version (`npm info next version`)
- [ ] `@ducanh2912/next-pwa` — confirm Next.js 15 App Router support
- [ ] `@cartesia/cartesia-js` — confirm package name, streaming API shape, supported audio formats
- [ ] `@anthropic-ai/sdk` — confirm current Claude Haiku model ID
- [ ] `@supabase/ssr` vs `@supabase/auth-helpers-nextjs` — which is current for App Router
- [ ] Zustand — confirm v4 vs v5 stable
- [ ] Tailwind — confirm v3 vs v4 (config approach differs significantly)
- [ ] `@types/web-bluetooth` — confirm still needed or if TypeScript ships BLE types now
## Sources
- Next.js: https://nextjs.org/docs
- Cartesia: https://docs.cartesia.ai
- Anthropic SDK: https://docs.anthropic.com/en/api/getting-started
- Supabase Next.js guide: https://supabase.com/docs/guides/getting-started/quickstarts/nextjs
- Web Bluetooth spec: https://developer.chrome.com/docs/capabilities/bluetooth
- Screen Wake Lock: https://developer.chrome.com/docs/capabilities/wake-lock
- `@ducanh2912/next-pwa`: https://github.com/ducanh2912/next-pwa
- Zustand: https://zustand.docs.pmnd.rs
- Tailwind v4: https://tailwindcss.com/docs/installation
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, or `.github/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
