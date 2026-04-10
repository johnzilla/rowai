# Technology Stack

**Project:** RowAI — Voice-first AI rowing coach PWA
**Researched:** 2026-04-09
**Confidence note:** All web search tools disabled in this environment. Findings are based on training data (cutoff August 2025). Versions and API shapes MUST be verified against official docs before implementation. Flags are provided per section.

---

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Next.js | 15.x | App shell, routing, API routes | App Router enables server components and route handlers needed for proxying LLM/TTS API keys server-side (never expose keys to client). PWA support via `next-pwa` or `@ducanh2912/next-pwa`. Strong Vercel deployment story. Overkill for a single-user app but the server-side API route pattern is non-negotiable for key security. |
| React | 19.x | UI rendering | Comes with Next.js 15. React 19 concurrent features (useTransition, Suspense) map well to streaming TTS state. No reason to use anything else here. |
| TypeScript | 5.x | Type safety | BLE GATT descriptors, audio buffer types, and Supabase schema types all benefit from strict typing. Catches null-safety issues at compile time that would silently break during a workout. |

**Confidence:** MEDIUM — Next.js 15 / React 19 / TS 5 are correct as of Aug 2025. Verify latest patch versions before scaffolding.

---

### PWA Layer

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@ducanh2912/next-pwa` | latest | Service worker, offline cache, installability | The original `next-pwa` (`@shadowwalker/next-pwa`) is largely unmaintained. `@ducanh2912/next-pwa` is the active fork with Next.js App Router support. Handles precaching, background sync stubs, and the Web App Manifest wiring. |
| Web App Manifest | — | PWA installability, display mode | Must set `"display": "standalone"` and `"orientation": "portrait"` for the rowing form factor. Required for "Add to Home Screen" prompt on Chrome Android. |
| Screen Wake Lock API | Browser API | Prevent screen sleep during BLE session | Native browser API, no library needed. `navigator.wakeLock.request('screen')`. Re-acquire on `visibilitychange` because lock releases on tab hide. Critical: without this, Chrome Android will suspend BLE and cut audio mid-session. |

**Confidence:** MEDIUM — `@ducanh2912/next-pwa` was the recommended fork as of mid-2025. Verify it still targets Next.js 15 App Router. The Wake Lock API status is HIGH confidence (stable W3C spec, works on Chrome Android).

**NOT recommended:** `vite-plugin-pwa` with Vite — would require abandoning Next.js server-side API routes, making secure API key proxying much harder.

---

### Web Bluetooth

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Web Bluetooth API | Browser API | PM5 GATT data ingestion | Native browser API. No library needed; the spec is stable on Chrome Android. The PM5 GATT service UUID `CE060030-43E5-11E4-916C-0800200C9A66` is documented in Concept2's PM BLE specification. |
| `@types/web-bluetooth` | latest | TypeScript types for BLE APIs | The Web Bluetooth API types are not in the default `lib.dom.d.ts` as of TS 5.x; this package adds them. Without it, `navigator.bluetooth` is typed as `any`. |

**Confidence:** HIGH for the API itself (well-established). MEDIUM for `@types/web-bluetooth` package status — verify it's still the correct package or whether TypeScript now ships BLE types natively.

**Key implementation note:** Web Bluetooth requires a user gesture to call `requestDevice()`. Do NOT attempt to auto-connect on page load — it will silently fail. Trigger from a button press.

**NOT recommended:** Any React Native BLE library (react-native-ble-plx, etc.) — project is a PWA, not React Native. These are incompatible.

---

### Streaming TTS (Cartesia)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@cartesia/cartesia-js` | latest | Cartesia Sonic streaming TTS | Official Cartesia JavaScript SDK. Supports WebSocket streaming for low-latency audio delivery. Cartesia Sonic is the specified TTS for this project. |
| Web Audio API | Browser API | Audio playback and buffer management | Native browser API. Use `AudioContext` for playing streaming PCM/Opus chunks as they arrive. Enables sub-sentence latency — start playing first audio chunk before full TTS response is received. No library needed. |

**Confidence:** MEDIUM — Cartesia SDK package name and streaming approach are correct as of mid-2025. The SDK may have changed shape; verify the exact streaming method signature and supported audio formats (PCM vs Opus) before implementing the audio pipeline. Cartesia's websocket streaming was the recommended low-latency path over HTTP.

**Critical latency path:** For the <500ms pre-computed cue target:
1. Template cue text is pre-selected by local logic (no LLM call)
2. TTS request fires immediately at cue trigger
3. First audio chunk plays as soon as received (don't buffer entire response)
4. Target: ~145ms from cue trigger to first audio on Chrome Android

**NOT recommended:** Browser SpeechSynthesis API — quality is unacceptable, no streaming control, voice options are platform-dependent. ElevenLabs — higher latency than Cartesia for streaming use case and more expensive at volume.

---

### LLM Integration (Claude API)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `@anthropic-ai/sdk` | latest | Claude API for novel coaching situations | Official Anthropic TypeScript SDK. Used server-side only (Next.js route handler). Supports streaming responses. Claude 3.5 Haiku is the recommended model for real-time coaching: ~440-940ms latency vs Sonnet/Opus which exceed 1s+. |
| Next.js Route Handlers | — | Server-side LLM proxy | All Claude API calls go through `/api/coach` route handler. The API key never reaches the client. Route handlers support `StreamingTextResponse` to stream LLM tokens back to the PWA. |

**Confidence:** MEDIUM — `@anthropic-ai/sdk` is correct. Claude model names change frequently; verify current Haiku model ID at time of implementation. As of mid-2025 the pattern was `claude-3-5-haiku-20241022` or similar. The latency estimates (440-940ms) are empirical from the project doc and should be validated with actual load testing.

**Hybrid cue engine:** The project spec calls for pre-computed templates for 80% of cues. LLM is only invoked for:
- Novel user states (injury mention, emotional distress signals)
- Post-session debrief narrative generation
- Pre-session check-in responses that don't match templates

Do NOT call Claude for routine pacing cues — this is explicitly architecture, not just optimization.

**NOT recommended:** OpenAI GPT-4o — viable but Claude is the specified choice and the Anthropic SDK is well-typed. LangChain — adds abstraction complexity with no benefit for a two-path (template/LLM) coaching engine.

---

### Database and Backend Services

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Supabase | hosted | Postgres DB, auth, real-time | Managed Postgres with row-level security. Stores session history, user profile, coach memory KV, onboarding data. The JS client (`@supabase/supabase-js`) works directly from the Next.js API routes and can be called client-side for non-sensitive reads. |
| `@supabase/supabase-js` | 2.x | Supabase JS client | v2 client is the current stable branch. Supports typed queries via generated types. |
| `@supabase/ssr` | latest | Server-side Supabase client for Next.js | Required for App Router server components and route handlers. Replaces the old `@supabase/auth-helpers-nextjs` package. |

**Confidence:** MEDIUM — Supabase v2 client is correct. The `@supabase/ssr` package name should be verified; the Auth Helpers package was being migrated/renamed during mid-2025. Check official Supabase docs for Next.js App Router integration.

**Schema outline (for research context, not final):**
- `sessions` — workout_date, duration_s, avg_split, avg_watts, avg_stroke_rate, total_meters, pm5_raw_json
- `user_profile` — name, experience_level, coaching_tone, injuries_text, onboarding_complete
- `coach_memory` — key (text), value (text), last_updated — used as a KV store for the coach's persistent observations

**NOT recommended:** Prisma ORM — adds a migration layer that complicates Supabase's managed schema approach. Use Supabase's type generation (`supabase gen types typescript`) directly. Firebase/Firestore — vendor lock-in without Postgres query capabilities; session analytics queries become painful.

---

### Deployment

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vercel | hosted | App hosting and deployment | First-class Next.js support. Edge functions for low-latency API routes. Free tier sufficient for solo builder. Automatic HTTPS (required for Web Bluetooth — BLE only works on secure origins). Zero-config deployment from git push. |

**Confidence:** HIGH — Vercel + Next.js is the canonical pairing. HTTPS requirement for Web Bluetooth is a hard browser constraint, not just a recommendation.

**NOT recommended:** Netlify — works but lacks Edge Functions parity for streaming API routes. Self-hosted on a VPS — unnecessary infrastructure burden for a solo builder; Vercel's serverless/edge is the right fit.

---

### State Management

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Zustand | 4.x or 5.x | Global session state | Lightweight. The session state (BLE connection status, current split/watts/stroke rate, TTS playing state, coach mode) is read from multiple components and needs to survive re-renders without prop drilling. Redux is overkill. React context re-renders too broadly for high-frequency PM5 data (updates every ~1-2 seconds). |

**Confidence:** MEDIUM — Zustand 4.x is the correct recommendation. Zustand 5 was in development as of mid-2025; verify current stable version.

**NOT recommended:** Redux Toolkit — severe overkill for a single-user session app. Jotai — valid alternative but Zustand's devtools integration and simpler `get`/`set` pattern is preferable for the coaching session FSM.

---

### Testing

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Vitest | 2.x | Unit and integration tests | Fast, native ESM, compatible with Next.js 15. Test the coaching template engine, cue selection logic, and session state machine — these are pure logic and should have high coverage. |
| Playwright | 1.4x | E2E PWA tests | Can test the full PWA flow on a Chromium instance. Web Bluetooth can be mocked via CDP or test fixtures. Critical for regression-testing the BLE → coaching → TTS pipeline without a physical PM5. |

**Confidence:** MEDIUM — versions are approximate. Verify current Playwright version for BLE mocking support.

---

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `clsx` | latest | Conditional className | Every component with loading/active/error states |
| `tailwindcss` | 3.x or 4.x | Utility CSS | Workout UI needs fast iteration. Minimal custom CSS. |
| `zod` | 3.x | Runtime schema validation | Validate PM5 GATT data shapes, API payloads, and Supabase row shapes before use |
| `date-fns` | 3.x | Date formatting | Session timestamps, streak calculations |

**Confidence:** MEDIUM — Tailwind 4.0 was released in early 2025 with a revised config approach; verify whether to use v3 or v4 (v4 removed `tailwind.config.js` in favor of CSS-based config).

---

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

---

## Installation

```bash
# Scaffold Next.js app
npx create-next-app@latest rowai --typescript --tailwind --app --src-dir

# Core dependencies
npm install @supabase/supabase-js @supabase/ssr
npm install @anthropic-ai/sdk
npm install @cartesia/cartesia-js
npm install @types/web-bluetooth
npm install zustand
npm install zod
npm install date-fns
npm install clsx

# PWA
npm install @ducanh2912/next-pwa

# Dev dependencies
npm install -D vitest @vitest/ui
npm install -D playwright @playwright/test
```

**VERIFY BEFORE RUNNING:** All package names must be confirmed against npm registry. `@cartesia/cartesia-js` and `@ducanh2912/next-pwa` in particular — package names may have changed.

---

## Key Version Verification Checklist

Before scaffolding, verify these against official sources:

- [ ] Next.js current version (`npm info next version`)
- [ ] `@ducanh2912/next-pwa` — confirm Next.js 15 App Router support
- [ ] `@cartesia/cartesia-js` — confirm package name, streaming API shape, supported audio formats
- [ ] `@anthropic-ai/sdk` — confirm current Claude Haiku model ID
- [ ] `@supabase/ssr` vs `@supabase/auth-helpers-nextjs` — which is current for App Router
- [ ] Zustand — confirm v4 vs v5 stable
- [ ] Tailwind — confirm v3 vs v4 (config approach differs significantly)
- [ ] `@types/web-bluetooth` — confirm still needed or if TypeScript ships BLE types now

---

## Sources

All findings from training data (cutoff August 2025). No live sources available in this research session. Recommended official docs to verify:

- Next.js: https://nextjs.org/docs
- Cartesia: https://docs.cartesia.ai
- Anthropic SDK: https://docs.anthropic.com/en/api/getting-started
- Supabase Next.js guide: https://supabase.com/docs/guides/getting-started/quickstarts/nextjs
- Web Bluetooth spec: https://developer.chrome.com/docs/capabilities/bluetooth
- Screen Wake Lock: https://developer.chrome.com/docs/capabilities/wake-lock
- `@ducanh2912/next-pwa`: https://github.com/ducanh2912/next-pwa
- Zustand: https://zustand.docs.pmnd.rs
- Tailwind v4: https://tailwindcss.com/docs/installation
