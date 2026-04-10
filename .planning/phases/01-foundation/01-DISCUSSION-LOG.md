# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-09
**Phase:** 1-Foundation
**Areas discussed:** Metrics Display, Onboarding Flow, BLE Pairing UX, Session Lifecycle

---

## Metrics Display

| Option | Description | Selected |
|--------|-------------|----------|
| Split time | Your pace per 500m — the universal rowing metric | ✓ |
| Stroke rate (SPM) | Strokes per minute — important for pacing and technique | |
| Watts | Raw power output — more objective than split | |

**User's choice:** Split time as primary metric
**Notes:** Most rowers anchor on split time

---

| Option | Description | Selected |
|--------|-------------|----------|
| One big number + small secondaries | Split huge in center. SPM, watts, distance small below. | ✓ |
| Equal grid | 4 metrics in equal-sized quadrants | |

**User's choice:** One big number + small secondaries
**Notes:** Optimized for glancing mid-stroke from ~3 feet

---

| Option | Description | Selected |
|--------|-------------|----------|
| Elapsed time + distance | Running clock and total meters at the top | ✓ |
| Raw metrics only | Just split/SPM/watts, coach handles session awareness | |

**User's choice:** Elapsed time + distance as progress indicators

---

## Onboarding Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal (name + signup only) | Ask experience/tone/injuries after first session | ✓ |
| Full upfront | All fields before first row | |

**User's choice:** Minimal friction — progressive disclosure
**Notes:** Collect additional profile data after first session

---

| Option | Description | Selected |
|--------|-------------|----------|
| Calm & supportive (single tone) | One tone for MVP, matches PRD vision | ✓ |
| 2-3 presets | e.g., Calm mentor / Firm coach / Quiet confidence | |

**User's choice:** Single calm & supportive tone for MVP — no selection UI needed

---

## BLE Pairing UX

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, rationale first | Brief screen explaining why BLE is needed + Connect button | ✓ |
| Straight to system dialog | Trigger Chrome BLE picker immediately | |

**User's choice:** Rationale screen before Chrome BLE dialog
**Notes:** Reduces permission denial rate per pitfalls research

---

| Option | Description | Selected |
|--------|-------------|----------|
| Simple status text | "Connecting..." then "Connected to PM5" with checkmark | ✓ |
| Animated indicator | Pulsing dot or spinner during pairing | |

**User's choice:** Simple status text — minimal, not flashy

---

## Session Lifecycle

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-detect first stroke | Session begins when PM5 detects rowing motion | ✓ |
| Explicit start button | User taps "Start Session" after connecting | |

**User's choice:** Auto-detect first stroke — no start button needed

---

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-detect stop + confirm | After ~30s no strokes, prompt "Done rowing?" | ✓ |
| Manual stop only | User must tap "End Session" | |

**User's choice:** Auto-detect stop with confirmation prompt

---

| Option | Description | Selected |
|--------|-------------|----------|
| No pause state | Stop rowing = data stops. Resume = row again. | ✓ |
| Explicit pause | Pause button freezes timer for water breaks | |

**User's choice:** No pause state — simple rowing/not-rowing binary

---

## Claude's Discretion

- Color scheme, typography, overall visual design
- Layout spacing and responsive breakpoints
- Error message wording
- Onboarding field validation rules

## Deferred Ideas

None — discussion stayed within phase scope
