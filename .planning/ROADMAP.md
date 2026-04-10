# Roadmap: RowAI

## Overview

Three phases that build from data foundation to coaching experience to compounding memory. Phase 1 gets a real user on a real erg with live BLE data. Phase 2 delivers the complete coaching loop — check-in, real-time cues, mid-session interaction, post-session debrief. Phase 3 makes coaching compound: persistent memory, session history, and the relational layer that differentiates RowAI from every other rowing app.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Foundation** - PWA scaffolding, Supabase auth, BLE data pipeline, and session reliability
- [ ] **Phase 2: Coaching Loop** - Pre-session check-in, real-time voice coaching, mid-session interaction, post-session debrief
- [ ] **Phase 3: Memory & History** - Persistent coach memory, session history, and the compounding relationship layer

## Phase Details

### Phase 1: Foundation
**Goal**: A logged-in user can pair their PM5 over BLE and see live rowing data in a stable PWA session
**Depends on**: Nothing (first phase)
**Requirements**: BLE-01, BLE-02, BLE-03, BLE-04, BLE-05, ONBD-01, ONBD-02, ONBD-03
**Success Criteria** (what must be TRUE):
  1. User can sign up, log in, and stay logged in across browser refreshes
  2. User completes onboarding (name only per D-04; experience level, coaching tone, injuries collected progressively) and data persists
  3. User can pair PM5 via Web Bluetooth and see live stroke rate, split, watts, and distance updating on screen
  4. Screen stays awake and BLE connection stays alive during a full rowing session
  5. App announces BLE disconnect and attempts automatic reconnect; session can continue in timer fallback mode
**Plans**: 3 plans

Plans:
- [x] 01-01-PLAN.md — Next.js 16 PWA scaffold + Supabase auth + onboarding (ONBD-01, ONBD-02, ONBD-03)
- [x] 01-02-PLAN.md — BLE service module + PM5 parser + Wake Lock + Zustand store (BLE-01 through BLE-05)
- [x] 01-03-PLAN.md — Session UI: metrics display, auto-start/end lifecycle, disconnect recovery UX

**UI hint**: yes

### Phase 2: Coaching Loop
**Goal**: The coach speaks — check-in before rowing, adaptive real-time cues during the session, interaction when the user needs adjustment, and a debrief when they finish
**Depends on**: Phase 1
**Requirements**: PRES-01, PRES-02, PRES-03, COACH-01, COACH-02, COACH-03, COACH-04, MID-01, MID-02, MID-03, POST-01, POST-02, POST-03
**Success Criteria** (what must be TRUE):
  1. Coach delivers a voice check-in before the session starts and suggests a session type the user can accept or modify
  2. Voice cues fire automatically during rowing — pace drops, interval transitions, encouragement — with pre-computed cues arriving in under 500ms
  3. High-priority correction cues interrupt lower-priority cues without audio overlap
  4. User can tap "too hard," "push me," or "I'm good" mid-session and hear an adaptive LLM response
  5. Coach delivers a voice debrief at session end and session stats are saved to Supabase
**Plans**: 4 plans

Plans:
- [ ] 02-01-PLAN.md -- Coaching types, Zustand coaching store, AudioQueue, StrokeProcessor, CueRouter, cue templates, Supabase schema
- [ ] 02-02-PLAN.md -- Claude LLM coach API route, Cartesia TTS proxy route, session writer
- [ ] 02-03-PLAN.md -- Pre-session check-in screen, mid-session tap controls, coaching indicator, pipeline wiring
- [ ] 02-04-PLAN.md -- Post-session voice debrief, session summary card, Supabase session + memory writes

**UI hint**: yes

### Phase 3: Memory & History
**Goal**: The coach remembers you — reads your history before each session, references past sessions accurately, and each workout makes future coaching smarter
**Depends on**: Phase 2
**Requirements**: MEM-01, MEM-02, MEM-03, MEM-04, HIST-01, HIST-02
**Success Criteria** (what must be TRUE):
  1. Coach reads last 5 sessions, user profile, and KV memory at session start and references them accurately in conversation
  2. Coach memory key-value pairs are updated after each session so patterns compound over time
  3. Memory schema uses a fixed-size snapshot so context size stays bounded as session count grows
  4. Session data saved to localStorage when Supabase is unavailable and syncs automatically on reconnect
  5. User can view a list of past sessions sorted by date with distance, time, and average split
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 0/3 | Planned | - |
| 2. Coaching Loop | 0/TBD | Not started | - |
| 3. Memory & History | 0/TBD | Not started | - |
