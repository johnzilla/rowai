# Requirements: RowAI

**Defined:** 2026-04-09
**Core Value:** A coaching relationship that compounds across sessions — the coach remembers you, adapts to your energy, and makes solo rowing feel relational.

## v1 Requirements

### BLE & Hardware

- [ ] **BLE-01**: User can pair PM5 via Web Bluetooth on Chrome Android
- [ ] **BLE-02**: App reads real-time PM5 data (stroke rate, split, watts, distance) sampled every 5s
- [ ] **BLE-03**: Screen Wake Lock keeps BLE + audio alive during sessions
- [ ] **BLE-04**: App detects BLE disconnect and announces fallback to timer mode
- [ ] **BLE-05**: App attempts BLE reconnect every 30s after disconnect

### Onboarding & Auth

- [ ] **ONBD-01**: User can sign up with email/password via Supabase Auth
- [ ] **ONBD-02**: User completes onboarding with name (experience level, coaching tone, injuries collected progressively after first session per D-04)
- [ ] **ONBD-03**: User session persists across browser refresh

### Pre-Session

- [ ] **PRES-01**: Coach delivers voice check-in asking energy level and time available
- [ ] **PRES-02**: Coach suggests session type based on check-in + session history
- [ ] **PRES-03**: User can accept or modify suggested session via voice or tap

### Real-Time Coaching

- [ ] **COACH-01**: Pre-computed cue engine fires voice cues on threshold events (pace drop, interval transitions, encouragement)
- [ ] **COACH-02**: Cues delivered via Cartesia Sonic streaming TTS with <500ms latency on pre-computed path
- [ ] **COACH-03**: Two-tier audio queue: HIGH priority cues (corrections) interrupt NORMAL priority cues
- [ ] **COACH-04**: Real-time metrics displayed on screen during session

### Mid-Session Interaction

- [ ] **MID-01**: User can interact mid-session via tap controls ("too hard," "push me," "I'm good")
- [ ] **MID-02**: Voice input via Web Speech API (Plan A) or push-to-talk fallback (Plan B)
- [ ] **MID-03**: Coach responds adaptively to user interaction via LLM path

### Post-Session

- [ ] **POST-01**: Coach delivers voice debrief summarizing session performance
- [ ] **POST-02**: Session data (duration, distance, avg split, avg watts) saved to Supabase
- [ ] **POST-03**: Coach memory key-value pairs updated based on session patterns

### Memory & Persistence

- [ ] **MEM-01**: Coach memory reads at session start (last 5 sessions + user profile + KV memory)
- [ ] **MEM-02**: Coach references previous sessions accurately in conversation
- [ ] **MEM-03**: Memory schema designed with fixed-size snapshot to prevent context accumulation at scale
- [ ] **MEM-04**: Session data cached in localStorage when Supabase is unavailable, synced on reconnect

### Session History

- [ ] **HIST-01**: User can view list of past sessions with key metrics
- [ ] **HIST-02**: Session history sorted by date with basic stats (distance, time, avg split)

## v2 Requirements

### Intelligence & Adaptation

- **INTEL-01**: Pattern recognition across sessions (personal bests, plateaus, streaks)
- **INTEL-02**: Adaptive cue calibration that compounds across sessions
- **INTEL-03**: Injury-aware coaching with full memory integration
- **INTEL-04**: Post-session debrief as full two-way dialogue

### Platform & Integration

- **PLAT-01**: Concept2 Logbook API write-back (auto-sync completed workouts)
- **PLAT-02**: iOS native app via React Native or SwiftUI
- **PLAT-03**: Heart rate monitor integration
- **PLAT-04**: Multiple voice options (Cartesia presets or voice cloning)

## Out of Scope

| Feature | Reason |
|---------|--------|
| 3D avatar with lip-sync | Not core to coaching hypothesis; visual polish, v2+ |
| Reactive virtual scenery | Visual polish, not core to voice coaching |
| Camera-based form feedback | Separate hypothesis, separate sensor, adds complexity |
| Gamification (points, leaderboards) | Ergatta owns that positioning; dilutes coaching angle |
| Nutrition / sleep coaching | Out of domain, dilutes product identity |
| Full multiplayer / crew mode | Architectural complexity for small user % |
| Training plan periodization | Sports science liability; reactive coaching sufficient |
| Vector DB for memory | Structured Postgres KV sufficient for v1 scale |
| iOS Safari / Web Bluetooth | Web Bluetooth not supported on iOS Safari |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BLE-01 | Phase 1 | Pending |
| BLE-02 | Phase 1 | Pending |
| BLE-03 | Phase 1 | Pending |
| BLE-04 | Phase 1 | Pending |
| BLE-05 | Phase 1 | Pending |
| ONBD-01 | Phase 1 | Pending |
| ONBD-02 | Phase 1 | Pending |
| ONBD-03 | Phase 1 | Pending |
| PRES-01 | Phase 2 | Pending |
| PRES-02 | Phase 2 | Pending |
| PRES-03 | Phase 2 | Pending |
| COACH-01 | Phase 2 | Pending |
| COACH-02 | Phase 2 | Pending |
| COACH-03 | Phase 2 | Pending |
| COACH-04 | Phase 2 | Pending |
| MID-01 | Phase 2 | Pending |
| MID-02 | Phase 2 | Pending |
| MID-03 | Phase 2 | Pending |
| POST-01 | Phase 2 | Pending |
| POST-02 | Phase 2 | Pending |
| POST-03 | Phase 2 | Pending |
| MEM-01 | Phase 3 | Pending |
| MEM-02 | Phase 3 | Pending |
| MEM-03 | Phase 3 | Pending |
| MEM-04 | Phase 3 | Pending |
| HIST-01 | Phase 3 | Pending |
| HIST-02 | Phase 3 | Pending |

**Coverage:**
- v1 requirements: 27 total
- Mapped to phases: 27
- Unmapped: 0

---
*Requirements defined: 2026-04-09*
*Last updated: 2026-04-09 after roadmap creation*
