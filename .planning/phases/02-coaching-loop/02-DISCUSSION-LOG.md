# Phase 2: Coaching Loop - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-10
**Phase:** 02-coaching-loop
**Areas discussed:** Pre-session check-in flow, Voice delivery & audio queue, Mid-session interaction, Post-session debrief

---

## Pre-Session Check-In Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Before BLE pairing | Coach greets you first, asks about energy/time, suggests a session — then you connect the PM5 | ✓ |
| After BLE pairing | Connect PM5 first, then coach speaks | |
| During BLE pairing | Coach talks while PM5 connects in background | |

**User's choice:** Before BLE pairing
**Notes:** Feels like talking to your coach before stepping on the erg.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Tap only | Quick-tap buttons for energy level and time available. No mic needed yet. | ✓ |
| Voice + tap fallback | Coach asks verbally, user can speak or tap | |
| Voice only | Fully conversational check-in | |

**User's choice:** Tap only
**Notes:** Reliable, voice comes later during the session.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Accept / modify intensity | Coach suggests one session type. User can accept or adjust intensity/duration. | ✓ |
| Pick from 2-3 suggestions | Coach offers 2-3 session options based on check-in answers | |
| Free text override | Coach suggests, but user can type/speak a completely custom plan | |

**User's choice:** Accept / modify intensity
**Notes:** Simple, coach-led.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, with a skip button | Always show a "Just row" option. Coach uses defaults. | ✓ |
| No, check-in is required | Coaching relationship starts with check-in | |
| Skip after first session | First session requires check-in, then "same as last time" shortcut | |

**User's choice:** Yes, with a skip button
**Notes:** No friction for returning users who just want to get on the erg.

---

## Voice Delivery & Audio Queue

| Option | Description | Selected |
|--------|-------------|----------|
| Priority interrupt | HIGH priority cues cut off NORMAL cues. Stale normal cues dropped. | ✓ |
| Queue everything in order | All cues play in sequence | |
| Latest-wins | New cue always replaces current cue | |

**User's choice:** Priority interrupt
**Notes:** Matches COACH-03 requirement.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Minimum 30s cooldown | At least 30s between non-urgent cues. HIGH priority bypasses. | ✓ |
| Minimum 60s cooldown | Coach speaks roughly once a minute max | |
| Adaptive cooldown | Cooldown varies by intensity phase | |

**User's choice:** Minimum 30s cooldown
**Notes:** Prevents cue fatigue while staying responsive.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Short and punchy | "Ease up on the rate, you're at 32." Brief, direct. | ✓ |
| Conversational | Longer, more relational sentences | |
| You decide | Claude calibrates length based on context | |

**User's choice:** Short and punchy
**Notes:** Easy to process while rowing. Matches calm & supportive tone.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Subtle indicator | Small pulsing icon or thin highlight bar while audio plays | ✓ |
| Text overlay | Brief text of what the coach said (subtitles) | |
| No visual change | Voice-only, screen stays the same | |

**User's choice:** Subtle indicator
**Notes:** User knows coach is speaking without disrupting metrics layout.

---

## Mid-Session Interaction

| Option | Description | Selected |
|--------|-------------|----------|
| Bottom bar, always visible | Fixed row of 3 large tap buttons at bottom. Thumb-reachable. | ✓ |
| Swipe-up drawer | Hidden by default, swipe up to reveal | |
| Floating action button | Single FAB that expands into 3 options | |

**User's choice:** Bottom bar, always visible
**Notes:** Always accessible without scrolling while on the erg.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Tap only for MVP | Skip voice input entirely in Phase 2. 3 tap buttons cover core interactions. | ✓ |
| Push-to-talk button | Fourth button that activates mic while held | |
| Web Speech API always-on | Continuous speech recognition during session | |

**User's choice:** Tap only for MVP
**Notes:** Erg is loud (chain + fan). Voice input deferred.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Immediate voice acknowledgment | Coach responds within seconds via LLM path | ✓ |
| Pre-computed acknowledgment | Instant canned response followed by adjusted behavior | |
| Silent adjustment | No verbal response, just changes cue behavior | |

**User's choice:** Immediate voice acknowledgment
**Notes:** Feels like a real coach hearing you.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed 3 buttons | Always "too hard", "push me", "I'm good". Predictable. | ✓ |
| Context-adaptive | Buttons change based on what's happening | |

**User's choice:** Fixed 3 buttons
**Notes:** No cognitive load mid-row. Coach interprets context from metrics.

---

## Post-Session Debrief

| Option | Description | Selected |
|--------|-------------|----------|
| Immediate voice debrief | Coach starts speaking right away over metrics screen | ✓ |
| Transition to debrief screen | Fade to dedicated debrief view, then coach speaks | |
| Summary card first, voice optional | Show visual summary, coach voice plays after a beat | |

**User's choice:** Immediate voice debrief
**Notes:** No transition screen — coach talks while metrics stay up.

---

| Option | Description | Selected |
|--------|-------------|----------|
| 30-second highlight | 3-4 key stats, one standout moment. Short and punchy. | ✓ |
| Full play-by-play | Walk through whole session, 1-2 minutes | |
| You decide | Claude varies length based on session intensity/duration | |

**User's choice:** 30-second highlight
**Notes:** Matches the cue style. Short enough post-row.

---

| Option | Description | Selected |
|--------|-------------|----------|
| LLM path | Claude generates personalized commentary from session data | ✓ |
| Pre-computed templates | Template-filled summary, instant but generic | |
| Hybrid | Pre-computed stats first, then LLM closing thought | |

**User's choice:** LLM path
**Notes:** Personal and varied each time. Latency acceptable post-session.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Session summary card | Simple card with key stats + "Done" button | ✓ |
| Summary + session graph | Stats card plus split-over-time chart | |
| Return to home immediately | Auto-navigate back, no lingering summary | |

**User's choice:** Session summary card
**Notes:** Simple card, not a deep analytics view. Phase 3 adds history.

---

## Claude's Discretion

- Pre-computed cue template library content and threshold triggers
- Cue routing logic (pre-computed vs LLM path)
- LLM prompt design for mid-session responses and debrief
- Audio queue implementation (AudioContext scheduling)
- Cartesia Sonic voice preset selection
- Session data schema for Supabase writes
- Coach memory KV pair design (writes only)
- Visual design of check-in screen, tap controls, summary card
- Stroke processing sliding window parameters

## Deferred Ideas

None — discussion stayed within phase scope.
