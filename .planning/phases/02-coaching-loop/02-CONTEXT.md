# Phase 2: Coaching Loop - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the complete coaching loop: a voice check-in before rowing, adaptive real-time voice cues during the session, mid-session tap interaction, and a voice debrief when the user finishes. It connects to the BLE data pipeline and session lifecycle from Phase 1. No persistent memory, no session history UI — those are Phase 3.

</domain>

<decisions>
## Implementation Decisions

### Pre-Session Check-In
- **D-01:** Check-in happens BEFORE BLE pairing — coach greets you first, asks about energy/time, suggests a session type, then you connect the PM5. Feels like talking to your coach before stepping on the erg.
- **D-02:** User responds via TAP ONLY during check-in — quick-tap buttons for energy level (1-5) and time available (15/20/30/45 min). No mic needed yet.
- **D-03:** Coach suggests ONE session type (e.g., "steady state, 20 min"). User can accept or adjust intensity/duration with tap controls. Simple, coach-led.
- **D-04:** "Just row" skip button always visible — coach uses defaults (medium energy, open-ended session). No friction for returning users.

### Voice Delivery & Audio Queue
- **D-05:** Two-tier priority interrupt system — HIGH priority cues (corrections) cut off NORMAL cues (encouragement). Stale normal cues dropped from queue. Matches COACH-03 requirement.
- **D-06:** Minimum 30-second cooldown between non-urgent cues. HIGH priority corrections bypass cooldown. Prevents cue fatigue.
- **D-07:** Short and punchy cue style — "Ease up on the rate, you're at 32." "Nice split, hold it." Brief, direct, easy to process while rowing. Consistent with calm & supportive tone (Phase 1 D-05).
- **D-08:** Subtle visual indicator when coach speaks — small pulsing icon or thin highlight bar while audio plays. Doesn't disrupt metrics layout.

### Mid-Session Interaction
- **D-09:** Bottom bar with 3 fixed tap buttons always visible — "too hard", "push me", "I'm good". Large, thumb-reachable from erg position.
- **D-10:** TAP ONLY for MVP — no voice input in Phase 2. Erg noise (chain + fan) makes speech recognition unreliable. Three tap buttons cover core interactions.
- **D-11:** Immediate voice acknowledgment via LLM path — coach responds within seconds: "Got it, let's ease up. Drop your rate to 24." Feels like a real coach hearing you.
- **D-12:** Fixed buttons, not context-adaptive — always the same 3 options. Predictable, no cognitive load mid-row. Coach interprets context from metrics.

### Post-Session Debrief
- **D-13:** Immediate voice debrief when user confirms "Done rowing?" — coach starts speaking right away over the existing metrics screen. No transition screen.
- **D-14:** 30-second highlight — coach calls out 3-4 key stats (time, distance, avg split, one standout moment). Short, punchy, matches cue style.
- **D-15:** LLM-generated debrief — Claude generates personalized commentary from session data. Personal and varied each time. Latency acceptable post-session.
- **D-16:** Session summary card after debrief — simple card with duration, distance, avg split, avg watts, avg stroke rate. "Done" button returns to check-in screen.

### Claude's Discretion
- Pre-computed cue template library content and threshold triggers
- Exact cue routing logic (which situations go pre-computed vs LLM)
- LLM prompt design for mid-session responses and debrief generation
- Audio queue implementation details (AudioContext scheduling)
- Cartesia Sonic voice preset selection
- Session data schema for Supabase writes (POST-02)
- Coach memory KV pair design (POST-03 — writes only, Phase 3 reads)
- Visual design of check-in screen, tap controls, summary card
- Stroke processing sliding window parameters

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & Design
- `.planning/research/ARCHITECTURE.md` — 5-layer pipeline architecture, cue routing, audio delivery layer, component boundaries
- `.planning/research/PITFALLS.md` — AudioContext suspension on screen lock, BLE GATT disconnect, Chrome autoplay policy
- `.planning/research/STACK.md` — Cartesia Sonic API, Claude API, Web Speech API references

### Project Context
- `.planning/PROJECT.md` — Core value, constraints, hybrid cue strategy (pre-computed ~145ms, LLM ~440-940ms)
- `.planning/REQUIREMENTS.md` — PRES-01 through PRES-03, COACH-01 through COACH-04, MID-01 through MID-03, POST-01 through POST-03
- `rowai-prd.md` — Original PRD with PM5 GATT details, coaching vision

### Phase 1 Foundation
- `.planning/phases/01-foundation/01-CONTEXT.md` — D-05 calm & supportive tone, D-08/D-09/D-10 session lifecycle decisions

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/session/session-store.ts` — Zustand store with BLE status, session phase, latest reading. Will need extension for coaching state (current cue, check-in data, debrief state).
- `src/hooks/useSessionLifecycle.ts` — Auto-start/end lifecycle hook. Debrief trigger connects to the `endSession()` action.
- `src/components/session/SessionEndPrompt.tsx` — "Done rowing?" confirmation. Debrief starts after user confirms here.
- `src/components/metrics/MetricDisplay.tsx` — Live metrics component. Coaching indicator and tap controls integrate alongside this.
- `src/lib/ble/pm5-parser.ts` — StrokeReading type with strokeRate, splitTime, watts, distance, strokeState. Cue engine consumes these.

### Established Patterns
- Zustand for state management (single store pattern)
- Component-per-concern (`components/ble/`, `components/metrics/`, `components/session/`)
- `src/lib/` for service modules (BLE, session, supabase, wake-lock)
- Black background, white text, mobile-first layout

### Integration Points
- Session page (`src/app/session/page.tsx`) — tap controls and coaching indicator integrate here
- New pre-session check-in screen — sits before the session page in the user flow
- New post-session debrief view — replaces/overlays session page after end confirmation
- Supabase client (`src/lib/supabase/client.ts`) — session data writes (POST-02)
- PM5 service events → stroke processing → cue engine (new pipeline connecting to existing BLE layer)

</code_context>

<specifics>
## Specific Ideas

- Pre-session flow: check-in screen → BLE pairing → session screen. "Just row" skips check-in and goes to BLE pairing directly.
- Cue latency target: pre-computed path <500ms (COACH-02), LLM path acceptable for mid-session responses and debrief where user isn't mid-stroke.
- Tap controls should be large enough to hit while sweaty on an erg — think 48px+ touch targets.
- The "subtle indicator" for active coach audio could be a thin colored bar at the top of the metrics area or a small speaker/waveform icon.
- Session summary card is a stopping point, not a deep analytics view — Phase 3 adds history browsing.

</specifics>

<deferred>
## Deferred Ideas

- **MID-02 voice input**: Per D-10, voice input (Web Speech API / push-to-talk) is deferred from Phase 2. Erg noise makes speech recognition unreliable. Phase 2 delivers tap-only input (3 fixed buttons) as the fallback input mechanism. Voice input may be revisited in a future phase if noise-cancellation or push-to-talk proves viable.

</deferred>

---

*Phase: 02-coaching-loop*
*Context gathered: 2026-04-10*
