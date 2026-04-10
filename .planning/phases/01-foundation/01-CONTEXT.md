# Phase 1: Foundation - Context

**Gathered:** 2026-04-09
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers a working PWA where a logged-in user can pair their Concept2 PM5 via Web Bluetooth and see live rowing metrics on screen in a stable session. It covers auth, onboarding, BLE data pipeline, Screen Wake Lock, and BLE disconnect recovery. No coaching voice, no AI, no memory — just the reliable data foundation.

</domain>

<decisions>
## Implementation Decisions

### Metrics Display
- **D-01:** Split time is the primary metric — displayed large and central, glanceable from ~3 feet during rowing
- **D-02:** Layout is "one big number + small secondaries" — split time huge in center, SPM/watts/distance smaller below
- **D-03:** Elapsed time and total distance shown as session progress indicators (top of screen)

### Onboarding Flow
- **D-04:** Minimal friction before first row — name + email signup only. Experience level, coaching tone, and injuries collected progressively after first session or via profile settings.
- **D-05:** Single coaching tone for MVP: "calm & supportive" — no tone selection UI needed. Matches PRD vision of calm supportive mentor.

### BLE Pairing UX
- **D-06:** Show rationale screen before Chrome BLE dialog — brief explanation ("RowAI needs Bluetooth to read your PM5 data in real time") with a Connect button. Reduces permission denial rate.
- **D-07:** Connection status is simple text — "Connecting..." then "Connected to PM5" with checkmark. No animated indicators.

### Session Lifecycle
- **D-08:** Session starts automatically on first stroke detection — no explicit "Start Session" button. PM5 data begins streaming, session timer begins.
- **D-09:** Session ends via auto-detection — after ~30s of no strokes, prompt "Done rowing?" with option to continue or end.
- **D-10:** No pause state — if you stop rowing, data stops. Resume by rowing again. Simple rowing/not-rowing binary.

### Claude's Discretion
- Color scheme, typography, and overall visual design
- Exact layout spacing and responsive breakpoints
- Error message wording for edge cases
- Onboarding form field validation rules

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### BLE Integration
- `.planning/research/ARCHITECTURE.md` — 5-layer pipeline architecture, BLE Ingestion Layer details
- `.planning/research/PITFALLS.md` — Critical pitfalls: BLE GATT disconnect on screen lock, AudioContext suspension, Bluetooth permission denial
- `.planning/research/STACK.md` — Web Bluetooth API, Screen Wake Lock API, `@types/web-bluetooth`

### Project Context
- `.planning/PROJECT.md` — Core value, constraints, key decisions
- `.planning/REQUIREMENTS.md` — BLE-01 through BLE-05, ONBD-01 through ONBD-03
- `rowai-prd.md` — Original PRD with PM5 GATT details

### Research Summary
- `.planning/research/SUMMARY.md` — Executive summary, roadmap implications, research flags

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None — patterns will be established in this phase

### Integration Points
- Supabase project (to be created) — auth + database
- PM5 hardware — BLE GATT service UUID `CE060030-43E5-11E4-916C-0800200C9A66`
- Vercel deployment (to be configured)

</code_context>

<specifics>
## Specific Ideas

- PM5 GATT service UUID: `CE060030-43E5-11E4-916C-0800200C9A66` — must verify byte layout against official Concept2 BLE spec
- Screen Wake Lock API must be activated during session and re-acquired on `visibilitychange` events
- BLE disconnect recovery: announce fallback, attempt reconnect every 30s
- Session auto-start on first stroke detection means monitoring PM5 data for non-zero stroke rate
- Session auto-end after ~30s of zero strokes triggers confirmation prompt

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-04-09*
