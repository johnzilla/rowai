# Architecture Patterns

**Domain:** Real-time voice coaching PWA with BLE sensor ingestion
**Project:** RowAI
**Researched:** 2026-04-09
**Confidence:** MEDIUM — core patterns from training knowledge, BLE+audio specifics from Web spec behavior and known constraints

---

## Recommended Architecture

RowAI is a **single-page PWA** with five distinct processing layers. Data flows from hardware through a sensor pipeline, into a coaching decision engine, and out through an audio delivery pipeline. Persistence is a write-ahead store that captures session state and memory.

```
[ Concept2 PM5 ] ──BLE GATT─→ [ BLE Ingestion Layer ]
                                        │
                                        ▼
                               [ Stroke Processing Layer ]
                                        │
                              ┌─────────┴──────────┐
                              ▼                     ▼
                    [ Pre-computed Cue Engine ]   [ LLM Coaching Engine ]
                              │                     │
                              └─────────┬───────────┘
                                        ▼
                               [ Audio Delivery Layer ]
                                        │
                                  Cartesia TTS
                                        │
                                   AudioContext
                                        ▼
                                   [ User ]
                                        │
                              voice / tap interaction
                                        │
                                        ▼
                               [ Input Handler ]
                                        │
                              ┌─────────┴──────────┐
                              ▼                     ▼
                    [ Session State Store ]   [ Supabase Client ]
                       (in-memory)           (async write-behind)
```

---

## Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| BLE Ingestion Layer | GATT connect, characteristic subscribe, raw byte decode, disconnect/reconnect | Stroke Processing Layer (push), Session State (write) |
| Stroke Processing Layer | Sliding window aggregation, rate/trend detection, threshold crossing, stroke event emission | Pre-computed Cue Engine (push), LLM Coaching Engine (push), Session State (write) |
| Pre-computed Cue Engine | Template library lookup, slot-fill with live metrics, cue selection and de-duplication, cooldown timers | Audio Delivery Layer (push), Session State (read) |
| LLM Coaching Engine | Claude API calls (streaming), prompt assembly from session context + user profile + coach memory, response parsing | Audio Delivery Layer (push), Supabase Client (read profile/memory), Session State (read/write) |
| Audio Delivery Layer | Cartesia Sonic streaming TTS, AudioContext scheduling, queue management, interrupt on new cue | User (output), Input Handler (receive interrupt signal) |
| Input Handler | Voice-to-text (Web Speech API), tap/button events, intent classification | LLM Coaching Engine (push classified intent), Pre-computed Cue Engine (push low-latency response) |
| Session State Store | In-memory live session data (current metrics, phase, elapsed time, cue history), exported on session end | All layers (read), Supabase Client (write at session end + periodic checkpoints) |
| Supabase Client | Async read/write Postgres: user profile, session history, coach memory KV | LLM Coaching Engine (read at session start), Session State (write async), Auth |
| Screen Wake Lock Manager | Acquire/release WakeLock API, reconnect BLE after visibility change | BLE Ingestion Layer (lifecycle), App shell |
| App Shell / Router | PWA shell, onboarding flow, pre-session check-in, session UI, post-session debrief | All components (lifecycle orchestration) |

---

## Data Flow

### 1. BLE Ingestion → Stroke Processing

The PM5 broadcasts GATT notifications at ~4Hz for rowing metrics (stroke rate, split, watts, distance, stroke state). The BLE Ingestion Layer subscribes to the GATT characteristic `CE060030-43E5-11E4-916C-0800200C9A66` and decodes raw bytes into a typed `StrokeReading` object. Each decoded reading is pushed synchronously into the Stroke Processing Layer.

Stroke Processing maintains a **sliding window** (last N strokes, last T seconds) and computes derived signals: stroke rate trend, split trend, power-to-rate ratio. When a signal crosses a coaching threshold (e.g., split drifting >2s/500m over 10 strokes), it emits a `CoachingTrigger` event with severity and context payload.

### 2. CoachingTrigger → Cue Engine Selection

A `CoachingTrigger` is dispatched to the **Cue Router**, which applies cooldown rules and decides: pre-computed path or LLM path.

**Pre-computed path** (target <145ms latency):
- Trigger type maps to a template key (e.g., `split_drift`, `rate_too_high`, `pace_on_target`)
- Template has slots for live metric values and user name
- Filled template string pushed to Audio Delivery Layer immediately

**LLM path** (target <500ms for conversational, acceptable >500ms for novel):
- Triggered when: user input requires interpretation, session milestone (halfway, cooldown start), novel pattern outside template coverage, post-session debrief
- Prompt assembled: system persona + user profile + coach memory + session context window (last 5 triggers, current metrics) + user input
- Claude API streaming response; first audio chunk queued before response complete

### 3. Audio Delivery

Cartesia Sonic streaming TTS receives text (or streaming chunks). The Audio Delivery Layer:
1. Initiates a streaming TTS request
2. Receives audio chunks as ArrayBuffers
3. Decodes with `AudioContext.decodeAudioData()`
4. Schedules chunks on a `AudioBufferSourceNode` pipeline with gapless playback
5. Tracks speaking state for interrupt handling

If a higher-priority cue arrives while audio is playing, the queue manager decides: append, prepend, or interrupt (only for safety/critical cues).

### 4. User Input → Response

Voice input uses `SpeechRecognition` API (Web Speech). Tap inputs are discrete buttons ("too hard", "push me", "I'm good"). Both are routed to an Intent Classifier — simple keyword matching for known intents (low-latency pre-computed response), LLM classification for ambiguous input (conversational response).

### 5. Persistence Write Path

Session state writes happen in three modes:
- **Hot path**: In-memory only (every stroke reading, every trigger)
- **Checkpoint path**: Supabase write every ~60s for recovery (session_id, metrics aggregate, current phase)
- **Commit path**: Full session write at session end — session record, metrics time-series, coach memory KV updates

Coach memory is a simple `{key: string, value: string, updated_at}` store. LLM decides what to write post-session (e.g., `"preferred_intensity": "hard finishes"`, `"injury_note": "left wrist issue"`).

---

## Patterns to Follow

### Pattern 1: Event-Driven Coaching Pipeline

Each layer communicates by emitting typed events rather than direct method calls. The BLE layer emits `StrokeReading`, the processing layer emits `CoachingTrigger`, the audio layer emits `CueComplete`. This allows each layer to be developed and tested independently.

```typescript
// Typed event bus - each layer subscribes to relevant events
type CoachingEvent =
  | { type: 'stroke_reading'; data: StrokeReading }
  | { type: 'coaching_trigger'; data: CoachingTrigger }
  | { type: 'user_input'; data: UserInput }
  | { type: 'cue_queued'; data: AudioCue }
  | { type: 'cue_complete'; data: { cueId: string } }
  | { type: 'session_phase_change'; data: SessionPhase }
```

### Pattern 2: Dual-Path Cue Router with Cooldown Guard

The cue router is the most critical latency-sensitive component. Pre-computed templates must be resolved synchronously in the main thread. LLM calls are async and must not block pre-computed cues.

```typescript
class CueRouter {
  private cooldowns = new Map<string, number>(); // triggerType -> lastFiredAt

  route(trigger: CoachingTrigger): void {
    if (this.isOnCooldown(trigger.type)) return;
    
    const template = templateLibrary.lookup(trigger.type);
    if (template) {
      this.setCooldown(trigger.type);
      audioQueue.push(template.fill(trigger.context)); // <145ms
    } else {
      llmEngine.handle(trigger); // async, non-blocking
    }
  }
}
```

### Pattern 3: Write-Behind Session State

Session state is maintained in memory for hot-path reads. Supabase writes are fire-and-forget (non-blocking), checkpointed on interval, and committed on session end. Never await Supabase in the coaching hot path.

### Pattern 4: Graceful BLE Disconnect Recovery

BLE can drop without warning. The BLE layer must detect `gattserverdisconnected`, attempt reconnect with exponential backoff (3 attempts), and notify the coaching engine to enter "reconnecting" state. In reconnecting state, the pre-computed engine switches to time-based cues ("Keep your rhythm, reconnecting sensor...").

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Awaiting LLM in the Coaching Hot Path

**What:** Triggering a Claude API call synchronously on each stroke event and waiting for response before next action.
**Why bad:** LLM latency (440-940ms) blocks the entire coaching pipeline. A 20-stroke sequence at 24 spm generates an event every 2.5 seconds — any await exceeding that starves the pipeline.
**Instead:** LLM calls are always async. Fire-and-forget into an async queue. Audio delivery handles queueing.

### Anti-Pattern 2: AudioContext Created Outside User Gesture

**What:** Creating `AudioContext` during PWA load or BLE connect.
**Why bad:** Chrome Android requires `AudioContext` to be created (or resumed) inside a user gesture handler. Silent failure — audio plays at 0 volume or not at all with no error.
**Instead:** Create `AudioContext` lazily inside the "Start Session" button click handler. Store reference for reuse.

### Anti-Pattern 3: Raw BLE Bytes in State

**What:** Storing PM5 GATT characteristic raw bytes directly in session state or passing them up the stack.
**Why bad:** Decoding becomes scattered across layers. Byte format changes break multiple components. Testing requires raw BLE mocking.
**Instead:** Decode at the boundary — BLE Ingestion Layer decodes bytes to typed `StrokeReading` immediately on characteristic notification. All higher layers see only typed data.

### Anti-Pattern 4: Coach Memory as Session State

**What:** Treating the coach's long-term knowledge (injury notes, preferences, historical patterns) as part of in-memory session state.
**Why bad:** Memory is lost on app close/crash. Memory writes become complex conflict resolution.
**Instead:** Coach memory lives exclusively in Supabase. It is read once at session start, injected into the LLM context window, and updated only at session end via explicit memory write-back phase.

### Anti-Pattern 5: Single Audio Queue Priority

**What:** All cues (real-time corrections, conversational responses, encouragement) share one FIFO audio queue.
**Why bad:** A 15-second conversational response entered mid-session will block an urgent correction ("slow down, your rate is spiking") for 15 seconds.
**Instead:** Two-tier queue: HIGH priority (corrections, warnings) interrupts and prepends; NORMAL priority (encouragement, responses) appends.

---

## Scalability Considerations

This is a single-user PWA. Scalability concerns are primarily about session reliability and long-session performance, not multi-tenancy.

| Concern | At 1 user (MVP) | At 1K users | At 10K users |
|---------|-----------------|-------------|--------------|
| BLE connection | Direct device pairing, no server | Same — BLE is always client-device | Same |
| TTS cost | Cartesia pay-per-character | Monitor usage, budget alert | Implement caching for repeated template cues |
| LLM cost | Claude API per-call | Monitor, optimize context window size | Pre-computed path handles >80% to cap LLM calls |
| Supabase writes | One row per session | Row-level security per user, connection pooling | Supabase handles up to 500 concurrent connections |
| In-memory session state | ~50KB per session (stroke readings + context) | N/A — per-client | N/A — per-client |

---

## Build Order Implications

Components have hard dependencies. The build order must respect them:

**Layer 1 — Foundation (no dependencies)**
- Supabase schema + client wrapper (user profiles, session history, coach memory KV)
- App shell, routing, screen wake lock

**Layer 2 — Data Ingestion (requires Layer 1)**
- BLE Ingestion Layer (PM5 GATT connect + decode)
- Can be built with a PM5 simulator for testing without hardware

**Layer 3 — Processing (requires Layer 2)**
- Stroke Processing Layer (windowed aggregation + threshold detection)
- Session State Store (in-memory, checkpoint writes)

**Layer 4 — Coaching (requires Layer 3)**
- Pre-computed Cue Engine (template library + cue router)
- AudioContext + Cartesia TTS integration (audio delivery)
- These can be built in parallel and integrated via the event bus

**Layer 5 — Intelligence (requires Layer 4)**
- LLM Coaching Engine (Claude API integration, prompt assembly, streaming)
- Pre-session check-in and post-session debrief flows

**Layer 6 — Interaction (requires Layer 4)**
- Input Handler (Web Speech API + tap events + intent classification)
- Mid-session user interaction loop

**Layer 7 — Polish (requires all)**
- Error degradation paths (BLE reconnect, LLM timeout fallback, offline caching)
- Onboarding flow

**Critical path:** BLE Ingestion → Stroke Processing → Cue Engine → Audio Delivery. This is the spine of the application. Everything else (LLM, memory, interaction) is layered on top and can be stubbed during spine development.

---

## Key Architectural Decision: Where Does Session Logic Live?

All coaching logic runs **client-side** in the browser. The server (Supabase + Vercel) is purely persistence and static hosting. There is no coaching server or websocket relay. This is the correct architecture for this project because:

1. BLE is a browser-to-device direct connection — no server in the path
2. Latency requirement (<500ms) is achievable client-side but not server-relayed
3. Solo builder constraint — no server to maintain
4. Privacy — raw BLE data never leaves the device

The only server calls are: Supabase reads/writes (async, non-blocking), Claude API (async, LLM path only), Cartesia TTS (async, audio delivery).

---

## Sources

- Concept2 PM5 BLE GATT protocol: documented in PM5 CSAFE/BLE Interface Definition (training data)
- Web Bluetooth API behavior: W3C specification + Chrome implementation notes (training data)
- AudioContext gesture requirement: Chrome Android autoplay policy documentation (training data)
- Cartesia Sonic streaming API: known streaming TTS pattern, verify against current Cartesia docs before Phase 4
- Claude streaming API: Anthropic documentation, streaming response pattern (training data, HIGH confidence)

**Confidence assessment:**
- BLE Ingestion Layer patterns: HIGH (Web Bluetooth spec well-established)
- Audio delivery via AudioContext: HIGH (well-documented Chrome behavior)
- Hybrid cue routing: HIGH (pattern derived directly from PROJECT.md latency analysis)
- Cartesia-specific streaming implementation: MEDIUM (verify against current API docs)
- Coach memory KV schema: MEDIUM (design choice, not prescribed by external spec)
