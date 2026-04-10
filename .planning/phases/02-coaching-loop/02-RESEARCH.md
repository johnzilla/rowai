# Phase 2: Coaching Loop - Research

**Researched:** 2026-04-10
**Domain:** Voice coaching pipeline — Cartesia Sonic-3 streaming TTS, Claude API, Web Audio API AudioContext scheduling, Zustand FSM extension, Supabase session writes
**Confidence:** MEDIUM-HIGH (stack verified against current versions; audio scheduling pattern is well-established; Cartesia WebSocket shape verified against live docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Pre-Session Check-In**
- D-01: Check-in happens BEFORE BLE pairing — coach greets you first, asks about energy/time, suggests a session type, then you connect the PM5.
- D-02: User responds via TAP ONLY during check-in — quick-tap buttons for energy level (1-5) and time available (15/20/30/45 min). No mic needed yet.
- D-03: Coach suggests ONE session type (e.g., "steady state, 20 min"). User can accept or adjust intensity/duration with tap controls. Simple, coach-led.
- D-04: "Just row" skip button always visible — coach uses defaults (medium energy, open-ended session). No friction for returning users.

**Voice Delivery & Audio Queue**
- D-05: Two-tier priority interrupt system — HIGH priority cues (corrections) cut off NORMAL cues (encouragement). Stale normal cues dropped from queue. Matches COACH-03 requirement.
- D-06: Minimum 30-second cooldown between non-urgent cues. HIGH priority corrections bypass cooldown. Prevents cue fatigue.
- D-07: Short and punchy cue style — "Ease up on the rate, you're at 32." "Nice split, hold it." Brief, direct, easy to process while rowing.
- D-08: Subtle visual indicator when coach speaks — small pulsing icon or thin highlight bar while audio plays. Doesn't disrupt metrics layout.

**Mid-Session Interaction**
- D-09: Bottom bar with 3 fixed tap buttons always visible — "too hard", "push me", "I'm good". Large, thumb-reachable from erg position.
- D-10: TAP ONLY for MVP — no voice input in Phase 2. Three tap buttons cover core interactions.
- D-11: Immediate voice acknowledgment via LLM path — coach responds within seconds.
- D-12: Fixed buttons, not context-adaptive — always the same 3 options. Coach interprets context from metrics.

**Post-Session Debrief**
- D-13: Immediate voice debrief when user confirms "Done rowing?" — coach starts speaking right away over the existing metrics screen.
- D-14: 30-second highlight — coach calls out 3-4 key stats.
- D-15: LLM-generated debrief — Claude generates personalized commentary from session data.
- D-16: Session summary card after debrief — simple card with duration, distance, avg split, avg watts, avg stroke rate. "Done" button returns to check-in screen.

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

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PRES-01 | Coach delivers voice check-in asking energy level and time available | Cartesia Sonic-3 SSE TTS on check-in screen load; LLM generates check-in text |
| PRES-02 | Coach suggests session type based on check-in + session history | LLM path; session history not yet in Supabase (Phase 3), so Phase 2 uses check-in tap values only |
| PRES-03 | User can accept or modify suggested session via tap | Tap UI on check-in screen; store session config in Zustand before BLE pairing |
| COACH-01 | Pre-computed cue engine fires voice cues on threshold events | StrokeProcessor sliding window → CueRouter → template fill → Cartesia TTS |
| COACH-02 | Cues delivered via Cartesia Sonic streaming TTS with <500ms latency on pre-computed path | Verified: Cartesia Sonic-3 time-to-first-audio ~90ms; full client-side path avoids server round trip |
| COACH-03 | Two-tier audio queue: HIGH priority cues interrupt NORMAL priority cues | AudioQueue class with priority enum; stop() + reschedule pattern on AudioBufferSourceNode |
| COACH-04 | Real-time metrics displayed on screen during session | Already implemented in Phase 1 MetricDisplay; Phase 2 adds coaching indicator overlay |
| MID-01 | User can interact via tap controls ("too hard," "push me," "I'm good") | Bottom bar component; dispatches intent to LLM engine |
| MID-02 | Voice input (Plan A) or push-to-talk fallback (Plan B) | D-10 locks this to tap-only for Phase 2; MID-02 voice input deferred |
| MID-03 | Coach responds adaptively to user interaction via LLM path | Claude API route handler; streaming response piped to Cartesia TTS |
| POST-01 | Coach delivers voice debrief summarizing session performance | LLM path triggered by confirmEnd(); streaming TTS over metrics screen |
| POST-02 | Session data saved to Supabase | New `sessions` table; written at session end via Supabase client |
| POST-03 | Coach memory KV pairs updated based on session patterns | New `coach_memory` table; LLM decides what to write post-debrief |
</phase_requirements>

---

## Summary

Phase 2 builds a complete voice coaching loop on top of the Phase 1 BLE data pipeline. The core technical challenge is a five-component pipeline: stroke readings from the PM5 flow into a `StrokeProcessor` that detects coaching triggers, a `CueRouter` dispatches to either a pre-computed template engine (target <500ms) or the Claude API (acceptable >500ms for conversational responses), and an `AudioQueue` serializes playback through Cartesia Sonic-3 streaming TTS into the browser's `AudioContext`.

The pre-session check-in is a new screen that lives before BLE pairing in the navigation flow. It uses the LLM path to generate a personalized greeting, collects energy/time/session-type via tap buttons, then hands off to the existing BLE pairing flow. Post-session, the debrief fires immediately after the existing `confirmEnd()` call, using the LLM path to generate commentary from accumulated session metrics, then saves a `sessions` row and `coach_memory` KV entries to Supabase.

The two biggest Phase 2 integration risks are: (1) the `AudioContext` must be created inside a user gesture and kept alive throughout the session, requiring careful state threading into the existing `SessionPage`; and (2) the `AudioQueue` interrupt logic must stop an in-progress `AudioBufferSourceNode` cleanly when a HIGH-priority cue arrives, which requires tracking the currently playing source node explicitly.

**Primary recommendation:** Build the `AudioQueue` and `StrokeProcessor` as standalone service classes in `src/lib/coaching/`, then wire them into the existing Zustand store and session page. Do not co-locate coaching logic with React components — it runs during active rowing and must survive re-renders without reinitializing.

---

## Standard Stack

### Core (already installed — verify before adding)

| Library | Version (installed) | Purpose | Why Standard |
|---------|---------------------|---------|--------------|
| `zustand` | `^5.0.12` | Coaching state extension | Already in use; extend `useSessionStore` with coaching slice |
| `@supabase/supabase-js` | `^2.103.0` | Sessions + coach memory writes | Already in use; add `sessions` and `coach_memory` tables |
| `@supabase/ssr` | `^0.10.2` | Server-side Supabase client for API routes | Already in use |

[VERIFIED: package.json in codebase]

### New Dependencies Required

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| `@cartesia/cartesia-js` | `3.0.0` | Cartesia Sonic-3 streaming TTS | Official SDK; v3 is current stable. WebSocket streaming API verified against docs.cartesia.ai |
| `@anthropic-ai/sdk` | `0.87.0` | Claude API for LLM cues, debrief, check-in | Official SDK; 0.87.0 is current latest |

[VERIFIED: npm registry — @cartesia/cartesia-js@3.0.0, @anthropic-ai/sdk@0.87.0]

### Cartesia Voice Model

| Property | Value | Source |
|----------|-------|--------|
| Model ID | `"sonic-3"` | Routes to latest stable Sonic-3 snapshot [CITED: docs.cartesia.ai/build-with-cartesia/tts-models/latest] |
| Pinned snapshot | `"sonic-3-2026-01-12"` | Use if stability required during development [CITED: same] |
| Time-to-first-audio | ~90ms | [CITED: docs.cartesia.ai/build-with-cartesia/tts-models/latest] |
| Recommended output encoding | `pcm_s16le` or `pcm_f32le` at 16000 or 24000 Hz | PCM formats decode directly to Float32Array for AudioContext |

### Claude Model

| Property | Value | Source |
|----------|-------|--------|
| Model for real-time / mid-session responses | `claude-haiku-4-5` | Fastest Haiku; ~440-940ms latency for short prompts [CITED: appscribed.com, metacto.com via search] |
| Model for debrief (latency tolerant) | `claude-haiku-4-5` | Same model; acceptable post-session |
| Context window | 200k tokens | Sufficient for session + profile context |

[MEDIUM confidence on exact model ID string — verify against docs.anthropic.com/models before first LLM call]

### Installation

```bash
npm install @cartesia/cartesia-js @anthropic-ai/sdk
```

---

## Architecture Patterns

### Recommended Project Structure (new files for Phase 2)

```
src/
├── app/
│   ├── checkin/
│   │   └── page.tsx              # Pre-session check-in screen (new route)
│   └── api/
│       ├── coach/
│       │   └── route.ts          # LLM proxy: mid-session + debrief (new)
│       └── tts/
│           └── route.ts          # Cartesia TTS proxy (new, key never on client)
├── lib/
│   └── coaching/
│       ├── stroke-processor.ts   # Sliding window + threshold detection (new)
│       ├── cue-router.ts         # Template vs LLM routing + cooldown (new)
│       ├── audio-queue.ts        # Two-tier priority queue + AudioContext (new)
│       ├── cue-templates.ts      # Pre-computed cue template library (new)
│       └── coaching-types.ts     # Shared types: CoachingTrigger, AudioCue, etc. (new)
├── hooks/
│   └── useCoachingSession.ts     # Wires coaching pipeline to session lifecycle (new)
└── components/
    ├── checkin/
    │   ├── CheckinScreen.tsx     # Full check-in UI (new)
    │   └── TapInputRow.tsx       # Reusable tap button row (new)
    ├── coaching/
    │   ├── CoachingIndicator.tsx # Pulsing speaker icon while audio plays (new)
    │   └── MidSessionControls.tsx # "too hard / push me / I'm good" bottom bar (new)
    └── session/
        └── SessionSummaryCard.tsx # Post-debrief stats card (new)
```

### Pattern 1: AudioContext Lifecycle — Create Once on User Gesture

**What:** `AudioContext` must be created inside a user gesture handler and reused for the entire session. Never create at module level or on app load.

**When to use:** Any component that initiates audio playback.

**Example:**
```typescript
// src/lib/coaching/audio-queue.ts
// Source: PITFALLS.md (Anti-Pattern 2) + Chrome autoplay policy
export class AudioQueue {
  private ctx: AudioContext | null = null;
  private currentSource: AudioBufferSourceNode | null = null;
  private scheduledEndTime = 0;

  // Call this INSIDE a button click handler (user gesture)
  initialize(): AudioContext {
    if (!this.ctx) {
      this.ctx = new AudioContext({ sampleRate: 24000 });
    }
    return this.ctx;
  }

  async ensureRunning(): Promise<void> {
    if (!this.ctx) throw new Error('AudioQueue not initialized');
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }
}
```

### Pattern 2: Gapless PCM Chunk Playback via Scheduled AudioBufferSourceNodes

**What:** Decode each Base64 PCM chunk from Cartesia WebSocket into a typed array, wrap in an `AudioBuffer`, and schedule on `AudioContext` timeline so chunks play back-to-back without gaps.

**When to use:** All Cartesia streaming TTS playback.

**Example:**
```typescript
// Source: MDN AudioBufferSourceNode.start() + Web Audio API spec
// VERIFIED pattern: schedule each buffer at nextStartTime

async playChunk(base64Audio: string, sampleRate: number): Promise<void> {
  await this.ensureRunning();
  const ctx = this.ctx!;

  // Decode base64 → Int16Array → Float32Array
  const binaryStr = atob(base64Audio);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  const int16 = new Int16Array(bytes.buffer);
  const float32 = new Float32Array(int16.length);
  for (let i = 0; i < int16.length; i++) float32[i] = int16[i] / 32768.0;

  const buffer = ctx.createBuffer(1, float32.length, sampleRate);
  buffer.copyToChannel(float32, 0);

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);

  const startAt = Math.max(ctx.currentTime, this.scheduledEndTime);
  source.start(startAt);
  this.scheduledEndTime = startAt + buffer.duration;
  this.currentSource = source;
}
```

**Key insight:** `scheduledEndTime` chains chunks seamlessly. `Math.max(currentTime, scheduledEndTime)` handles the first chunk and gaps gracefully. [ASSUMED: this pattern is correct for pcm_s16le; verify Int16→Float32 normalization against Cartesia's actual encoding at integration time]

### Pattern 3: Two-Tier Priority Audio Queue Interrupt

**What:** HIGH priority cues (corrections) stop the currently playing source and flush the NORMAL queue before playing. NORMAL cues append to queue and play when current audio finishes.

**When to use:** `CueRouter` dispatching to `AudioQueue`.

**Example:**
```typescript
// Source: ARCHITECTURE.md Anti-Pattern 5
enum CuePriority { NORMAL = 0, HIGH = 1 }

interface AudioCue {
  id: string;
  text: string;
  priority: CuePriority;
}

class AudioQueue {
  private normalQueue: AudioCue[] = [];
  private isSpeaking = false;

  enqueue(cue: AudioCue): void {
    if (cue.priority === CuePriority.HIGH) {
      // Interrupt: stop current audio, flush normal queue
      this.currentSource?.stop();
      this.scheduledEndTime = this.ctx!.currentTime;
      this.normalQueue = [];
      this.isSpeaking = false;
      void this.playCueNow(cue); // fire immediately
    } else {
      if (this.isSpeaking) {
        this.normalQueue.push(cue);
      } else {
        void this.playCueNow(cue);
      }
    }
  }
}
```

### Pattern 4: Cartesia WebSocket Streaming via SSE Route Handler

**What:** Cartesia API key stays server-side. Client calls `/api/tts` with cue text; route handler calls Cartesia WebSocket/SSE and streams audio chunks back as base64 in an SSE response.

**When to use:** All TTS requests from the client.

**Important:** For the pre-computed path to meet the <500ms latency target, the `/api/tts` route handler must be a Vercel Edge Function (not serverless) to minimize cold-start overhead. Consider direct client-side Cartesia calls for the pre-computed path (acceptable since API key exposure is lower risk than latency miss), with server proxy only for LLM-generated text.

**Cartesia WebSocket connection URL:**
```
wss://api.cartesia.ai/tts/websocket?api_key=<KEY>&cartesia_version=2026-03-01
```
[CITED: docs.cartesia.ai/api-reference/tts/tts]

**Cartesia WebSocket request body:**
```json
{
  "model_id": "sonic-3",
  "transcript": "Ease up on the rate, you're at 32.",
  "voice": { "mode": "id", "id": "<voice-uuid>" },
  "context_id": "<uuid>",
  "output_format": {
    "container": "raw",
    "encoding": "pcm_s16le",
    "sample_rate": 24000
  }
}
```
[CITED: docs.cartesia.ai/api-reference/tts/tts]

**Response chunks:**
```json
{ "type": "chunk", "data": "<base64-pcm>", "done": false, "context_id": "..." }
{ "type": "done", "context_id": "..." }
```
[CITED: docs.cartesia.ai/api-reference/tts/tts]

### Pattern 5: StrokeProcessor Sliding Window

**What:** Maintain a rolling buffer of the last N stroke readings. Compute trends over the window. Emit `CoachingTrigger` when a metric crosses a threshold.

**When to use:** Every `setLatestReading()` call in the session pipeline.

**Claude's discretion for threshold values:** The specific thresholds (e.g., "split drifted >3s over 10 strokes") are explicitly left to Claude's judgment. Research suggests these starting points:

| Trigger | Condition | Priority | Cooldown |
|---------|-----------|----------|----------|
| `split_drift_up` | splitMs increased >5000ms over last 8 strokes | HIGH | bypass |
| `rate_too_high` | strokeRate > target+4 for 5+ strokes | HIGH | bypass |
| `rate_too_low` | strokeRate < target-4 for 5+ strokes | NORMAL | 30s |
| `pace_on_target` | within ±1s/500m for 10+ strokes | NORMAL | 60s |
| `halfway` | distanceMeters crosses half of targetDistance | NORMAL | none (fires once) |

[ASSUMED — these are reasonable starting values; founder should tune after first real session]

### Pattern 6: LLM Route Handler with Streaming (Next.js 16)

**What:** Server-side Route Handler proxies Claude API streaming to client via SSE. Returns text tokens as they arrive.

**When to use:** `/api/coach/route.ts` for mid-session tap responses and debrief.

**Example:**
```typescript
// src/app/api/coach/route.ts
// Source: Anthropic streaming docs + Next.js route handler docs
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'edge'; // Edge for lower latency

export async function POST(request: Request) {
  const { intent, sessionContext } = await request.json() as {
    intent: 'too_hard' | 'push_me' | 'im_good' | 'debrief';
    sessionContext: SessionContext;
  };

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const stream = await client.messages.stream({
    model: 'claude-haiku-4-5',
    max_tokens: 150, // Short for mid-session; 400 for debrief
    messages: [{ role: 'user', content: buildPrompt(intent, sessionContext) }],
    system: COACH_SYSTEM_PROMPT,
  });

  // Stream tokens back to client as SSE
  const readable = new ReadableStream({
    async start(controller) {
      for await (const event of stream) {
        if (event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta') {
          controller.enqueue(
            new TextEncoder().encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
          );
        }
      }
      controller.close();
    }
  });

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  });
}
```
[CITED: platform.claude.com/docs/en/api/streaming, Next.js route.md]

### Pattern 7: Zustand Store Extension for Coaching State

**What:** Extend the existing `useSessionStore` (or create a separate `useCoachingStore`) with coaching-specific state. Separate stores are cleaner for testability.

**Recommendation:** Create `src/lib/coaching/coaching-store.ts` as a separate Zustand store to avoid inflating the session store with ephemeral coaching state.

**New state to add:**
```typescript
interface CoachingState {
  // Check-in state
  checkinComplete: boolean;
  energyLevel: 1 | 2 | 3 | 4 | 5 | null;
  timeAvailableMin: 15 | 20 | 30 | 45 | null;
  suggestedSessionType: string | null;

  // Audio state
  isSpeaking: boolean;
  currentCueText: string | null; // for visual indicator D-08

  // Debrief state
  debriefComplete: boolean;
  debriefText: string | null;

  // Actions
  setCheckinData: (energy: number, time: number) => void;
  setIsSpeaking: (speaking: boolean, cueText?: string) => void;
  completeDebrief: () => void;
}
```

### Anti-Patterns to Avoid

- **AudioContext at module level:** Silent failure on Chrome Android. Always create inside the "Start Session" or "Begin Check-in" button handler.
- **LLM in the stroke hot path:** `setLatestReading()` fires every ~2s; never await Claude in this callback. CueRouter dispatches LLM calls fire-and-forget.
- **Server round trip for pre-computed cues:** Adds ~50-200ms per cue on top of Cartesia's 90ms. For COACH-02's <500ms target, the pre-computed path should call Cartesia directly from the client (use NEXT_PUBLIC env var for API key with rate limiting awareness, OR maintain a persistent WebSocket connection to the Cartesia API opened at session start).
- **Single FIFO audio queue:** Covered in ARCHITECTURE.md Anti-Pattern 5. Use the two-tier pattern.
- **Accumulating session readings in LLM context:** Pass only a summary (last 5 triggers, current metrics snapshot, session stats) to Claude — not the full stroke-by-stroke history.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Text-to-speech synthesis | Custom TTS pipeline | `@cartesia/cartesia-js` + WebSocket | Sub-100ms first-chunk latency; voice quality; handles WebSocket lifecycle |
| LLM streaming | Raw fetch + SSE parser | `@anthropic-ai/sdk` `.stream()` method | Type-safe event handling; retry logic; automatic token counting |
| Supabase session writes | Raw PostgreSQL or REST calls | `@supabase/supabase-js` client | RLS enforcement; typed queries; handles auth tokens automatically |
| Audio scheduling/timing | setInterval-based audio | Web Audio API `AudioContext` scheduled playback | Hardware-accurate timing; no drift; gapless chunk chaining |
| Base64 decode for audio | Custom decoder | Built-in `atob()` + typed arrays | Standard, zero-dependency |

**Key insight:** The Cartesia WebSocket connection is long-lived and maintains prosody context across a session. Reopening it per cue adds overhead and loses prosodic continuity. Open once at session start, reuse throughout.

---

## Cue Template Library Design (Claude's Discretion)

The specific templates are left to Claude's judgment, but the research supports this structural approach:

### Template Format
```typescript
interface CueTemplate {
  key: string;                     // e.g., 'split_drift_up'
  priority: CuePriority;
  cooldownMs: number;              // 0 = bypasses cooldown
  text: (ctx: CueContext) => string; // slot-fill function
}

interface CueContext {
  userName: string;
  currentSplitStr: string;  // e.g., "2:12"
  currentRate: number;
  targetRate?: number;
  elapsedMin: number;
  distanceM: number;
}
```

### Recommended Starting Templates (Claude's judgment)
```typescript
const templates: CueTemplate[] = [
  {
    key: 'split_drift_up',
    priority: CuePriority.HIGH,
    cooldownMs: 0,
    text: (c) => `Ease up on the rate, you're at ${c.currentRate}. Split is drifting.`
  },
  {
    key: 'rate_too_high',
    priority: CuePriority.HIGH,
    cooldownMs: 0,
    text: (c) => `Rate's at ${c.currentRate}, bring it down to ${c.targetRate ?? c.currentRate - 2}.`
  },
  {
    key: 'pace_on_target',
    priority: CuePriority.NORMAL,
    cooldownMs: 60000,
    text: (c) => `Nice split, hold it.`
  },
  {
    key: 'halfway',
    priority: CuePriority.NORMAL,
    cooldownMs: 0,
    text: (c) => `Halfway. ${c.distanceM}m in, ${c.currentSplitStr} split.`
  },
  {
    key: 'session_start_cue',
    priority: CuePriority.NORMAL,
    cooldownMs: 0,
    text: (c) => `Alright ${c.userName}, let's go. Nice and steady.`
  },
];
```

---

## Supabase Schema Extensions (POST-02 and POST-03)

### `sessions` table (new)
```sql
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_s integer not null,
  total_meters numeric(8,1) not null,
  avg_split_ms integer,        -- null if no strokes
  avg_watts integer,
  avg_stroke_rate numeric(4,1),
  energy_level integer,        -- from check-in (1-5), null if skipped
  session_type text,           -- from check-in, null if skipped
  created_at timestamptz not null default now()
);

alter table public.sessions enable row level security;
create policy "Users can read own sessions"
  on public.sessions for select using (auth.uid() = user_id);
create policy "Users can insert own sessions"
  on public.sessions for insert with check (auth.uid() = user_id);
```

### `coach_memory` table (new, Phase 2 writes only — Phase 3 reads)
```sql
create table public.coach_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value text not null,
  updated_at timestamptz not null default now(),
  unique (user_id, key)
);

alter table public.coach_memory enable row level security;
create policy "Users can read own memory"
  on public.coach_memory for select using (auth.uid() = user_id);
create policy "Users can upsert own memory"
  on public.coach_memory for insert with check (auth.uid() = user_id);
create policy "Users can update own memory"
  on public.coach_memory for update using (auth.uid() = user_id);
```

**Write pattern for coach memory:** Use `upsert` with `onConflict: 'user_id,key'` so each key is a single row per user, updated rather than appended. [ASSUMED: correct Supabase upsert syntax for this constraint — verify against @supabase/supabase-js v2 docs]

### Session write timing
Write the `sessions` row after debrief completes (not at `endSession()`), so `energy_level` and `session_type` from check-in are available. Use fire-and-forget (do not await in the coaching path).

---

## LLM Prompt Design (Claude's Discretion — Starting Point)

### System Prompt (shared across all intents)
```
You are a calm, direct rowing coach. Keep responses under 2 sentences. 
Reference the athlete's current metrics when relevant. No filler phrases.
Tone: supportive but honest. Never use "Great job!" as a standalone response.
```

### Check-in Prompt
- Input: `{ energyLevel: 3, timeAvailableMin: 20 }`
- Output: coach greeting + one suggested session type
- Max tokens: 80

### Mid-session intent prompts
- Input: `{ intent: 'too_hard', metrics: { rate: 28, splitMs: 132000, elapsedMin: 8 } }`
- Output: acknowledgment + one actionable instruction
- Max tokens: 60

### Debrief prompt
- Input: full session summary (duration, distance, avg split, avg watts, avg rate, energy level, session type, top 3 cues fired)
- Output: 3-4 sentence recap, one standout moment called out
- Max tokens: 200

---

## Navigation Flow Change (Pre-Session Check-In)

Phase 1's flow: `/` → `/session`

Phase 2's flow: `/` → `/checkin` → `/session` (after check-in completes or "Just row" tapped)

The check-in page must:
1. Trigger the check-in voice greeting via Cartesia on mount (requires creating `AudioContext` inside a user gesture — the route navigation itself counts if triggered by a button tap on the home page)
2. Collect energy/time/session-type via tap buttons
3. Store check-in data in coaching store
4. Navigate to `/session` (which already handles BLE pairing)

**Note on AudioContext and navigation:** Chrome Android's autoplay policy requires `AudioContext` to be created or resumed in response to a user gesture. Navigation from the home page via a button tap qualifies. The `AudioContext` created on the check-in page must be passed to the coaching pipeline that continues into the session. Store the `AudioContext` reference in the coaching service singleton, not in React state (React state does not survive unmount/remount across navigation).

---

## Common Pitfalls

### Pitfall 1: AudioContext Not Surviving Navigation
**What goes wrong:** `AudioContext` created on the check-in page is garbage collected when the check-in component unmounts during navigation to `/session`.
**Why it happens:** If `AudioContext` is held in React `useState` or a hook, it is destroyed on unmount.
**How to avoid:** Hold `AudioContext` in a module-level singleton (`audioQueue.ts` exports a singleton instance). Initialize once, reference forever.
**Warning signs:** Audio works on check-in screen, then goes silent on session screen.

### Pitfall 2: Cartesia WebSocket Closed Before Session Ends
**What goes wrong:** Cartesia WebSocket has an idle timeout. If no messages are sent for >30s (e.g., user is rowing steadily with no cues), the connection may close.
**How to avoid:** Send a keepalive ping or reconnect on demand. Opening a fresh WebSocket per cue is also acceptable (adds ~50ms per cue for connection setup) and simpler.
**Warning signs:** First cue after a long quiet stretch fails with a WebSocket closed error.
[MEDIUM confidence — Cartesia idle timeout behavior not verified in official docs]

### Pitfall 3: StrokeProcessor State Persisting Across Sessions
**What goes wrong:** `StrokeProcessor` is a singleton. If a user does two sessions back-to-back, the sliding window from session 1 bleeds into session 2.
**How to avoid:** Call `strokeProcessor.reset()` in `startSession()`. This is also why `endSession()` in the session store is the right hook for cleanup.
**Warning signs:** First cues in session 2 reference metrics from session 1.

### Pitfall 4: LLM Response Text Piped to TTS While Still Streaming
**What goes wrong:** If you forward each text delta token from Claude directly to Cartesia TTS, you get one Cartesia request per word ("Ease", "up", "on"...), each generating a separate audio chunk that plays separately.
**How to avoid:** Buffer Claude's text stream until a sentence boundary (`.`, `?`, `!`) or the stream ends, then send the complete sentence to Cartesia. For short max_tokens (60-150), buffering the entire response before TTS is simpler and adds only 100-200ms.
**Warning signs:** Choppy, word-by-word audio delivery.

### Pitfall 5: `endSession()` Called Before Debrief Completes
**What goes wrong:** `confirmEnd()` in `useSessionLifecycle` currently calls `endSession()` immediately, resetting session state. But Phase 2 needs the session metrics to still be available for the debrief generation and Supabase write.
**How to avoid:** Introduce a new `SessionPhase`: `'debriefing'`. `confirmEnd()` transitions to `'debriefing'` (not directly to `'idle'`). Only call `endSession()` (→ `'idle'`) after debrief and Supabase write complete.
**Warning signs:** Debrief LLM call receives empty/null session metrics.

### Pitfall 6: Coach Memory Unbounded Growth
**What goes wrong:** Each session adds new KV pairs to `coach_memory` without pruning. After 50 sessions the table has hundreds of rows.
**How to avoid:** Phase 2 is writes-only (Phase 3 reads). But limit to ~10-15 KV pairs per user by upsert (which replaces rather than appends). Keep keys stable (e.g., `"preferred_intensity"`, `"weak_spot"`, `"best_split_ever"`). Do not add session-indexed keys like `"session_42_note"`.
**Warning signs:** Unbounded row count in `coach_memory` per user.

---

## Code Examples

### Check-in Audio: Trigger TTS on Page Load (User-Gesture Safe)

```typescript
// src/app/checkin/page.tsx — button that both navigates AND initializes audio
// Source: PITFALLS.md Pitfall 2 + Chrome autoplay policy [ASSUMED: this pattern works]

// On home page, the "Start Session" button navigates AND initializes AudioContext:
const handleStartSession = () => {
  // User gesture: AudioContext creation is allowed here
  audioQueue.initialize(); // module singleton
  router.push('/checkin');
};
```

### Cartesia WebSocket Direct-From-Client (Pre-Computed Path)

```typescript
// src/lib/coaching/audio-queue.ts
// Source: docs.cartesia.ai/api-reference/tts/tts [CITED]
import Cartesia from '@cartesia/cartesia-js';

const cartesia = new Cartesia({ apiKey: process.env.NEXT_PUBLIC_CARTESIA_API_KEY! });

export async function streamCueToAudio(text: string): Promise<void> {
  const ws = cartesia.tts.websocket({ sampleRate: 24000 });
  await ws.connect();

  const response = await ws.send({
    modelId: 'sonic-3',
    transcript: text,
    voice: { mode: 'id', id: COACH_VOICE_ID },
    outputFormat: { container: 'raw', encoding: 'pcm_s16le', sampleRate: 24000 },
    contextId: crypto.randomUUID(),
  });

  for await (const chunk of response) {
    if (chunk.type === 'chunk') {
      await audioQueue.playChunk(chunk.data, 24000);
    }
  }
  await ws.close();
}
```
[MEDIUM confidence on exact SDK v3 method names — verify against `@cartesia/cartesia-js` v3 README before implementation]

### Session Summary Write to Supabase

```typescript
// src/lib/coaching/session-writer.ts
import { createClient } from '@/lib/supabase/client';

export async function writeSession(data: SessionWritePayload): Promise<void> {
  const supabase = createClient();
  await supabase.from('sessions').insert({
    user_id: data.userId,
    started_at: new Date(data.startedAt).toISOString(),
    ended_at: new Date(data.endedAt).toISOString(),
    duration_s: Math.round((data.endedAt - data.startedAt) / 1000),
    total_meters: data.totalMeters,
    avg_split_ms: data.avgSplitMs,
    avg_watts: data.avgWatts,
    avg_stroke_rate: data.avgStrokeRate,
    energy_level: data.energyLevel ?? null,
    session_type: data.sessionType ?? null,
  });
  // Fire-and-forget — do not await in calling code
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `next-pwa` / `@shadowwalker` | `@serwist/next` | 2023-2024 | Already adopted in Phase 1 (`@serwist/next@9.5.7` installed) |
| `@supabase/auth-helpers-nextjs` | `@supabase/ssr` | 2023 | Already adopted in Phase 1 |
| Cartesia SDK v2 (`sonic-2`) | Cartesia SDK v3 (`sonic-3`) | Late 2025 | New install required; v3 API shape differs from v2 |
| Claude 3.5 Haiku (`20241022`) | Claude Haiku 4.5 | Oct 2025 | New model ID; STACK.md recommendation is now outdated |
| Zustand v4 | Zustand v5 (`^5.0.12`) | 2025 | Already at v5 in this project — some API surface changed (devtools setup differs) |
| Tailwind v3 (`tailwind.config.js`) | Tailwind v4 (CSS-based config) | Early 2025 | Already at v4 in this project — no `tailwind.config.js` exists |
| Next.js 15 | Next.js 16.2.3 | 2026 | Already installed — AGENTS.md warns of breaking changes; read `node_modules/next/dist/docs/` |

**Deprecated / outdated in previous research:**
- `claude-3-5-haiku-20241022`: Use `claude-haiku-4-5` instead [CITED: web search results]
- `@ducanh2912/next-pwa`: Not used — project uses `@serwist/next` [VERIFIED: package.json]

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `@cartesia/cartesia-js` | COACH-02, all TTS | Not installed | Need 3.0.0 | None — core requirement |
| `@anthropic-ai/sdk` | MID-03, POST-01, PRES-01 | Not installed | Need 0.87.0 | None — core requirement |
| Supabase (hosted) | POST-02, POST-03 | Available (Phase 1 active) | Managed | None needed |
| Cartesia API key | TTS delivery | Unknown (env var) | N/A | Degrade to silence + text-only |
| Anthropic API key | LLM responses | Unknown (env var) | N/A | Pre-computed-only mode (no check-in voice, no debrief) |

**Missing dependencies with no fallback:**
- `@cartesia/cartesia-js` — must install before any coaching audio work begins
- `@anthropic-ai/sdk` — must install before check-in, mid-session response, or debrief work

**Missing dependencies with fallback:**
- Cartesia API key missing at runtime → audio fails silently; implement a `ttsEnabled` flag in coaching store so UI degrades gracefully
- Anthropic API key missing at runtime → fall back to pre-computed check-in (static text) and skip debrief

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Session auth already handled in Phase 1 |
| V3 Session Management | No | Handled by Supabase auth (Phase 1) |
| V4 Access Control | Yes | Supabase RLS on `sessions` and `coach_memory` tables |
| V5 Input Validation | Yes | Validate tap inputs (energy 1-5, time in allowed set); sanitize any text passed to LLM prompts |
| V6 Cryptography | No | No new cryptographic operations |

### New Tables Require RLS at Creation

Both `sessions` and `coach_memory` must have RLS enabled and policies written in the same migration that creates the table. Schema above includes correct policies. Never create tables without RLS in this project.

### API Key Security

| Key | Exposure Level | Mitigation |
|-----|---------------|------------|
| `ANTHROPIC_API_KEY` | Server-only (`/api/coach` route handler) | Never `NEXT_PUBLIC_` prefix |
| `CARTESIA_API_KEY` | Client-side acceptable for pre-computed path (low-sensitivity TTS); server-side for LLM-generated text | Consider `NEXT_PUBLIC_CARTESIA_API_KEY` for pre-computed path to avoid server round trip; acceptable given Cartesia's per-character pricing model |

### LLM Prompt Injection Risk

Mid-session tap inputs are fixed buttons — no user-provided text reaches LLM prompts in Phase 2. This eliminates prompt injection risk for the MID path. Debrief and check-in prompts are entirely constructed from numeric metrics and coach-generated text.

---

## Open Questions (RESOLVED)

1. **Cartesia WebSocket vs SSE endpoint for client-side calls**
   - What we know: WebSocket API supports multiplexing (multiple concurrent cues); SSE endpoint is simpler
   - What's unclear: Whether SDK v3 `cartesia.tts.websocket()` method signature is correct (README only showed REST API)
   - RESOLVED: SSE endpoint chosen for initial implementation (Plan 02 Task 2). Simpler integration, avoids unverified WebSocket SDK method signatures. Can migrate to WebSocket later if prosodic continuity matters.

2. **Cartesia voice ID for coaching tone**
   - What we know: Katie (`f786b574-...`) and Kiefer (`228fca29-...`) are documented as "stable, realistic, suitable for voice agents"
   - What's unclear: Which voice best matches the "calm and supportive" tone in D-05
   - RESOLVED: Deferred to Claude's discretion and founder A/B testing (per CONTEXT.md). Voice ID configured via `CARTESIA_VOICE_ID` env var so it can be swapped without code changes.

3. **`AudioContext` survival across Next.js client-side navigation**
   - What we know: Module-level singletons survive client-side navigation in Next.js (no full page reload)
   - What's unclear: Whether Next.js 16's App Router does anything to unmount/remount that breaks singleton state
   - RESOLVED: Module-level singleton pattern adopted (Plan 01 Task 2, AudioQueue). Manual device verification required during execution checkpoint.

4. **Direct Cartesia client calls vs server proxy for pre-computed cues**
   - What we know: Server proxy adds ~50-200ms round trip; direct client call risks API key exposure
   - What's unclear: Cartesia's acceptable use policy for client-side API key usage
   - RESOLVED: `NEXT_PUBLIC_CARTESIA_API_KEY` used for pre-computed path (client-side, avoids server round-trip to hit <500ms target). Server proxy (`/api/tts`) used for LLM-generated text which contains session data. Per-character billing model makes key exposure low-risk.

5. **`debriefing` SessionPhase and endSession() timing**
   - What we know: Current `endSession()` resets to `idle` immediately
   - What's unclear: Whether to add `'debriefing'` to the `SessionPhase` union type or handle debrief purely in coaching store
   - RESOLVED: `'debriefing'` added to `SessionPhase` union type in session store (Plan 04 Task 1). Makes lifecycle explicit and prevents accidental state loss during debrief LLM calls and Supabase writes.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | PCM pcm_s16le chunks decode to Int16Array that normalizes to Float32 by dividing by 32768 | Code Examples | Audio plays at wrong volume or with clipping; fix by adjusting normalization |
| A2 | Cartesia SDK v3 `cartesia.tts.websocket({ sampleRate })` is the correct method signature | Code Examples | Build error; look up actual SDK v3 method names in installed package |
| A3 | Stroke threshold values (split_drift_up: >5000ms over 8 strokes, etc.) are appropriate starting points | Cue Template Library | Cues fire too often or too rarely; tune after first real session |
| A4 | Claude `claude-haiku-4-5` is the correct model ID string | Standard Stack | API error on first LLM call; check docs.anthropic.com/models |
| A5 | Supabase upsert with `onConflict: 'user_id,key'` is correct syntax for `@supabase/supabase-js` v2 | Supabase Schema | Coach memory write fails; check Supabase upsert docs |
| A6 | Cartesia has a WebSocket idle timeout that closes the connection after >30s of silence | Common Pitfalls | Pitfall 2 may not be real; omit keepalive logic if verified non-issue |
| A7 | Next.js 16 Edge Functions have lower cold-start than serverless for the `/api/coach` route | Architecture Patterns | LLM path latency may be acceptable without edge runtime |

---

## Sources

### Primary (HIGH confidence)
- `package.json` in codebase — verified installed versions for zustand, supabase, next, react
- `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` — Route Handler API, streaming pattern
- `node_modules/next/dist/docs/01-app/02-guides/streaming.md` — Next.js streaming guide
- `src/lib/session/session-store.ts` — existing Zustand store shape to extend
- `src/hooks/useSessionLifecycle.ts` — existing lifecycle hook to extend
- `supabase/migrations/001_initial_schema.sql` — existing schema to extend

### Secondary (MEDIUM confidence)
- [docs.cartesia.ai/api-reference/tts/tts](https://docs.cartesia.ai/api-reference/tts/tts) — WebSocket request/response format, audio encoding options, VERIFIED via WebFetch
- [docs.cartesia.ai/build-with-cartesia/tts-models/latest](https://docs.cartesia.ai/build-with-cartesia/tts-models/latest) — Sonic-3 model ID, voice IDs, latency spec, VERIFIED via WebFetch
- [platform.claude.com/docs/en/api/streaming](https://platform.claude.com/docs/en/api/streaming) — Claude streaming TypeScript example, VERIFIED via WebFetch
- npm registry (`npm view @cartesia/cartesia-js version`, `npm view @anthropic-ai/sdk version`) — VERIFIED current versions

### Tertiary (LOW confidence — flag for validation)
- Web search results for Claude Haiku 4.5 model ID — cross-referenced from multiple sources but model ID string not verified in official docs
- Cartesia idle timeout behavior — inferred from general WebSocket behavior, not confirmed in Cartesia docs
- AudioContext singleton persistence across Next.js App Router navigation — based on general JS module behavior, not tested

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified via npm registry and package.json
- Cartesia WebSocket API shape: MEDIUM — verified via WebFetch against live docs; SDK method names assumed
- Architecture patterns: HIGH — builds directly on established ARCHITECTURE.md patterns with verified Phase 1 codebase
- LLM model ID: MEDIUM — haiku-4-5 verified via web search but not official docs page
- Supabase schema: HIGH — simple extension of existing pattern; RLS policies follow established project convention
- Cue thresholds/templates: LOW — reasonable starting values, no empirical validation

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (Cartesia and Anthropic APIs evolve; verify model IDs and SDK method names before implementing)
