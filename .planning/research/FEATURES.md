# Feature Landscape

**Domain:** Voice-first AI rowing coach with persistent memory (Concept2 / PM5)
**Researched:** 2026-04-09
**Confidence:** MEDIUM — Web research unavailable; findings synthesized from project context, competitor landscape described in PROJECT.md, and training knowledge of AI fitness coaching products (Whoop, Future, Vi, Asensei, Ergatta, URUNN, Peloton, Tempo). Mark claims about specific competitor implementations as LOW confidence; structural patterns (table stakes vs differentiators) are MEDIUM-HIGH.

---

## Table Stakes

Features users expect from *any* AI fitness coaching product. Missing or broken = product feels incomplete, users disengage immediately.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Session start / stop control | Baseline UX — user must be in control of their workout | Low | Tap or voice trigger; must be reliable |
| Real-time metric display | Users trust the coach more when they can see the underlying numbers | Low | Stroke rate, split, watts, distance from PM5 |
| Live voice cues during workout | Core coaching contract — without voice prompts the product is just a dashboard | Medium | Pre-computed path <500ms; requires Screen Wake Lock |
| Pre-session intent capture | Good coaches ask "what are we doing today?" before every session | Low | Energy, time, session type; voice or tap form |
| Post-session summary | Closure ritual; users feel the session "counted" | Low-Medium | Duration, avg split, total meters, highlights |
| Error feedback (BLE disconnect) | BLE drops; silent failure destroys trust | Low | Visual + audio degradation notice; graceful fallback |
| Onboarding (name, experience, goals) | Coach can't personalize without knowing who you are | Low | One-time; feeds initial memory profile |
| Settings / preferences | Coaching tone, volume, notification prefs | Low | Sparse MVP — tone pref is enough at v1 |
| Reliability on mobile (Android PWA) | App crashes mid-row = immediate uninstall | Medium | Screen Wake Lock + BLE stability are the hard parts |
| Basic session history log | "Did I actually improve?" is the first question after 2 weeks | Low | List view of past sessions with key metrics |

---

## Differentiators

Features that make RowAI meaningfully different from ErgData + willpower, Ergatta gamification, and form-analysis apps like Asensei. Not expected by default but produce strong retention when done well.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Persistent cross-session memory | The coach *remembers* you — last session's struggle, injury note, breakthrough moment. This is the core hypothesis. | High | Supabase KV store + memory write-back in post-session debrief; requires disciplined memory schema |
| Adaptive real-time coaching (LLM path) | Responds to novel situations: mid-row fatigue signal, unusual split variance, user asking "am I on track?" | High | LLM path acceptable >500ms for conversational; hybrid engine essential |
| Mid-session voice interaction ("too hard") | Makes coaching feel bilateral — user shapes the session in real time | Medium | Keyword detection or tap buttons; UI must be usable with wet hands |
| Pre-session energy check-in with routing | Coach routes to different session plans based on stated energy — high energy: push, low energy: technique | Medium | Decision logic over pre-computed templates; LLM for fringe cases |
| Post-session debrief as dialogue | Not just a summary card — a 2-way debrief where coach asks "what felt hard?" and writes the answer to memory | High | LLM + TTS + memory write; emotionally resonant, high retention driver |
| Cue calibration that compounds | Coach gets better at predicting *your* pace targets, rest needs, motivational style across sessions | High | Requires memory read at session start + feedback loop from mid-session signals |
| Coaching tone personality | A coach voice the user chose and recognizes — consistency across sessions builds parasocial bond | Low-Medium | Single Cartesia Sonic voice for MVP; tone pref drives prompt templating |
| Workout pattern recognition (personal bests, plateaus, streaks) | "This is your 10th consecutive week — you haven't skipped" lands differently than a generic streak badge | Medium | Aggregate queries over session history; structured Postgres sufficient |
| Injury / limitation awareness | "You mentioned knee pain last week — how's it feeling?" is the difference between a coach and an app | Medium | Stored in user profile; referenced in pre-session check-in |

---

## Anti-Features

Features to explicitly NOT build for v1, with rationale. Some are future-phase candidates; others are permanently wrong for this product.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| 3D avatar with lip-sync | Adds rendering complexity, battery drain, and visual noise with no coaching value. Distraction from the row. | Voice-only; avatar is v2+ polish after hypothesis validated |
| Camera-based form feedback (pose estimation) | Separate hypothesis requiring separate sensor, privacy surface, and ML model. Blurs product identity. | Dedicated v2 feature gate after v1 retention proven |
| Gamification (points, leaderboards, badges) | Ergatta already owns that positioning. Competing on gamification dilutes the coaching relationship angle. | Streak acknowledgment via coach voice is sufficient recognition |
| Nutrition / sleep coaching | Out of domain, dilutes the identity of "rowing coach." Users don't expect it; adds LLM prompt complexity. | Hard out-of-scope; refer users to dedicated apps if asked |
| Heart rate monitor integration for v1 | PM5 data is sufficient for coaching signals. HRM adds pairing complexity for marginal coaching value at v1. | Defer to v1.1 or v2 as an enrichment layer |
| Multiple voice options | Choice paradox; users pick once, then second-guess. One excellent voice > five adequate ones. | One Cartesia Sonic preset; revisit if users specifically request it |
| Concept2 Logbook API write-back | Requires API approval process. Adds dependency risk for non-core v1 feature. | User can manually log to Logbook; add write-back after API approval (v1.1) |
| Full multiplayer / crew mode | Architectural complexity (sync, latency, turn management) for a feature only applicable to a small % of users. | Single-user coaching is the hypothesis; multiplayer is v3+ |
| Adaptive training plan generation (periodization) | Requires sports science modeling, testing cycles, and injury liability surface that a solo builder shouldn't own v1. | Reactive session-by-session coaching; training plan is a future paid tier |
| iOS / Safari support | Web Bluetooth is not available on iOS Safari. Native iOS requires app store review, signing, and build complexity. | Android PWA only; iOS native deferred to v2 |
| Vector DB / semantic memory search | Structured Postgres KV memory is sufficient at v1 scale. Vector DB adds infra complexity with unclear v1 benefit. | Revisit if memory store exceeds ~500 entries or semantic recall becomes a pain point |

---

## Feature Dependencies

```
Onboarding (name, experience, tone pref, injuries)
  → Pre-session check-in (personalized greeting, routing)
    → Real-time coaching (session-type-aware cues)
      → Mid-session interaction ("too hard" / "push me")
        → Post-session debrief (dialogue, memory capture)
          → Persistent memory (write-back)
            → Adaptive cue calibration (reads prior sessions)
              → Pattern recognition (personal bests, streaks, plateaus)

BLE PM5 connection
  → Real-time metric display
    → Real-time voice coaching (cue triggers based on metrics)

Screen Wake Lock API
  → BLE session stability
  → Audio playback continuity

Pre-computed cue templates (145ms path)
  → Real-time coaching reliability
LLM path (440-940ms)
  → Mid-session interaction responses
  → Post-session debrief dialogue
  → Novel situation coaching
```

**Critical path for MVP:** Onboarding → BLE connection → Screen Wake Lock → Real-time cues (pre-computed) → Pre/post session voice. Everything else is layered on top.

---

## MVP Recommendation

**Build first (Day 1 usable):**
1. Onboarding — name, experience, coaching tone
2. BLE PM5 connection with metric display
3. Screen Wake Lock for session stability
4. Pre-session voice check-in (energy + session type)
5. Real-time voice cues via pre-computed templates (split changes, pacing, encouragement)
6. Post-session summary card + voice summary

**Build second (Week 2-3, makes it a coaching product not just a dashboard):**
7. Persistent memory: write from post-session debrief, read at pre-session check-in
8. Mid-session voice interaction ("too hard," "push me," "I'm good")
9. LLM path for conversational responses and novel situations
10. Post-session debrief as dialogue (not just summary)

**Defer with explicit rationale:**
- Pattern recognition / streaks — needs 2-3 weeks of session data to be meaningful; build after users have history
- Adaptive cue calibration — requires memory feedback loop; build after memory is stable
- Concept2 Logbook write-back — API approval dependency; v1.1
- Injury-aware coaching — surfaces in memory schema; full implementation v1.1 after memory write-back is solid

---

## Competitive Positioning

The feature gap this product fills is not workout tracking (ErgData does that) and not gamification (Ergatta does that). The gap is:

**A coaching relationship that compounds.** No current rowing product combines:
- Real hardware data (PM5 BLE)
- Real-time voice presence
- Memory across sessions
- Adaptive dialogue (not just pre-scripted cues)

URUNN (Mo Farah running coach, MEDIUM confidence — described in PROJECT.md) validates that the voice + memory + relationship form factor has market demand. RowAI's differentiator is that it's rowing-specific (richer PM5 data signals) and available to the mass home-rowing market, not just elite runners.

---

## Sources

- PROJECT.md: Competitor analysis (Ergatta, Asensei, WodProof, URUNN), requirements, constraints, out-of-scope decisions
- Training knowledge: Whoop Coach, Future (human coach + AI assist), Vi audio trainer, Peloton AI coaching features — MEDIUM confidence, no live verification possible (WebSearch unavailable)
- Confidence note: All feature categorizations reflect synthesis from project context + training data. Live competitor feature audits should be done in a dedicated research pass before v2 feature scoping.
