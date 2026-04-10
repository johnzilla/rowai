# RowAI

## What This Is

RowAI is a voice-first AI rowing coach for Concept2 indoor rowers. It reads real-time PM5 data via Bluetooth, remembers your workout history and patterns, and delivers adaptive coaching through streaming voice — pre-session check-ins, real-time pacing cues, and post-session debriefs. Built as a PWA on Chrome Android. For adults who row at home and want a coach who actually knows them.

## Core Value

A coaching relationship that compounds across sessions — the coach remembers you, adapts to your energy, and makes solo rowing feel relational rather than solitary.

## Requirements

### Validated

- ✓ Real-time PM5 data ingestion via Web Bluetooth (stroke rate, split, watts, distance) — Phase 1
- ✓ User onboarding (name only, progressive disclosure per D-04) — Phase 1
- ✓ Screen Wake Lock API to maintain BLE + audio during sessions — Phase 1
- ✓ Error degradation: BLE disconnect with timer fallback mode — Phase 1

### Active

- [ ] Pre-session voice check-in (energy level, time available, session type preference)
- [ ] Adaptive real-time voice coaching with streaming TTS (Cartesia Sonic)
- [ ] Hybrid coaching engine: pre-computed cue templates for common patterns, LLM (Claude API) for novel situations
- [ ] Persistent session memory in Supabase (user profile, session history, coach memory key-value store)
- [ ] Mid-session voice/tap interaction ("too hard," "push me," "I'm good")
- [ ] Post-session voice debrief with summary and memory write-back
- [ ] Error degradation (LLM timeout fallback, offline session caching)

### Out of Scope

- 3D avatar with lip-sync and expressions — not core to coaching hypothesis, v2+ polish
- Reactive virtual scenery (rivers/lakes) — visual polish, not core
- Camera-based form feedback (MediaPipe Pose) — separate hypothesis, adds complexity
- Concept2 Logbook API write-back — requires API approval process, deferred to v1.1
- Voice cloning from user sample — nice-to-have, not core
- Multi-device support (phone + tablet/TV casting) — single device sufficient for MVP
- NordicTrack/iFIT integration — different hardware and BLE protocol
- Vector DB for memory — structured Postgres sufficient for v1
- Heart rate monitor integration — PM5 data sufficient for coaching
- Multiple voice options — one Cartesia voice preset for MVP
- Full multiplayer/crew mode — future expansion
- Nutrition or sleep coaching — out of domain

## Context

- Founder is the primary user and daily Concept2 rower. Building to scratch own itch.
- Current workflow is "ErgData + willpower" — no coaching, no personalization, no memory between sessions.
- Existing rowing apps split into form analysis (WodProof, Asensei) or gamification (Ergatta). Nobody does persistent relationship coaching.
- URUNN (Mo Farah) launched a similar concept for running — validates the form factor.
- AI fitness coaching market: $9.8B heading to $46B by 2034.
- Concept2 PM5 BLE GATT service UUID: `CE060030-43E5-11E4-916C-0800200C9A66`
- Web Bluetooth works on Chrome Android but NOT iOS Safari. PWA approach requires Android for testing.
- Screen Wake Lock API required — Chrome Android suspends BLE and audio on screen lock.
- Hybrid cue strategy needed: pre-computed templates (~145ms) for 80% of cues, LLM API (~440-940ms) for novel situations. Pure LLM exceeds 500ms latency target.

## Constraints

- **Platform**: PWA on Chrome Android. Native iOS deferred to v2.
- **Solo builder**: Minimize infrastructure. Use managed services (Supabase, Cartesia, Claude API, Vercel).
- **Latency**: Voice cues <500ms for pre-computed path. LLM path may exceed but acceptable for conversational responses.
- **Privacy**: No camera in MVP. No raw biometric data to third parties. Session memory in user's Supabase account.
- **BLE scope**: Read-only PM5 data. No Logbook API write-back in v1.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| PWA over native iOS | Founder has both iOS and Android; PWA ships faster, no app store. Web Bluetooth works on Chrome Android. | -- Pending |
| Voice-first, no avatar | Core hypothesis is coaching relationship, not visual presence. Avatar is v2+ polish. | -- Pending |
| Hybrid pre-computed/LLM cues | Pure LLM exceeds latency target. Pre-computed handles 80% of common patterns at ~145ms. | -- Pending |
| Supabase Postgres over Vector DB | Structured session data + KV coach memory sufficient for v1. Vector DB adds complexity without clear benefit at this scale. | -- Pending |
| BLE required for MVP | Codex challenged this (timer-based could test relationship hypothesis). Founder defended: real data makes coaching real, not a talking timer. | -- Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? -> Move to Out of Scope with reason
2. Requirements validated? -> Move to Validated with phase reference
3. New requirements emerged? -> Add to Active
4. Decisions to log? -> Add to Key Decisions
5. "What This Is" still accurate? -> Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-10 after Phase 1 completion*
