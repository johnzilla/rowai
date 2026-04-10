# Domain Pitfalls: Voice-First AI Coaching PWA + Web Bluetooth

**Domain:** Voice-first AI rowing coach / Web Bluetooth PWA / Chrome Android
**Researched:** 2026-04-09
**Confidence:** MEDIUM — Web/Bluetooth tool access unavailable; based on training knowledge of Web Bluetooth API spec, Chrome platform behavior, TTS streaming patterns, and AI coaching UX. Flags items needing verification before implementation.

---

## Critical Pitfalls

Mistakes that cause rewrites, session data loss, or coaching experience collapse.

---

### Pitfall 1: BLE GATT Connection Lost on Screen Lock or Tab Background

**What goes wrong:** Chrome Android suspends or kills the BLE GATT connection when the user locks the screen, switches tabs, or the OS decides to background the PWA. The PM5 goes silent mid-workout. All real-time coaching stops.

**Why it happens:** Android's battery management aggressively kills background network/radio operations for PWAs that are not in the foreground. Chrome does not retain GATT notification subscriptions across the app going to the background without explicit Wake Lock. The Screen Wake Lock API (`navigator.wakeLock.request('screen')`) prevents screen dimming but must be actively held — it can be released by the OS (e.g., incoming call) and must be re-requested in the `visibilitychange` handler.

**Consequences:** Mid-session BLE dropout causes coaching to go silent, potentially stranding the user mid-interval. If the app fails silently (no UI feedback) the user rows the rest of the workout without coaching and doesn't understand why.

**Prevention:**
- Request Screen Wake Lock immediately on session start, before BLE connect
- Implement `document.addEventListener('visibilitychange', ...)` to re-request Wake Lock when visibility is regained
- Subscribe to `device.ongattserverdisconnected` and auto-reconnect with exponential backoff (max 3 attempts, then surface to user)
- Show a persistent "Connected / Reconnecting / Disconnected" status indicator throughout the session — never silent failure
- Test explicitly: lock screen mid-session, switch tabs, receive a phone call

**Detection / Warning Signs:**
- No `gattserverdisconnected` handler in BLE code
- Wake Lock requested once and never re-requested on visibility restore
- No UI state for "BLE connecting / reconnecting"

**Phase to address:** BLE integration phase (earliest). This is a foundational assumption — if BLE is unreliable during sessions, nothing else matters.

---

### Pitfall 2: Audio Context Suspended by Browser After User Interaction Gap

**What goes wrong:** The Web Audio API (and by extension, streaming TTS playback) requires a user gesture to create or resume an `AudioContext`. If the context is created before a user tap, or if it auto-suspends after inactivity, coaching voice goes silent mid-workout with no error thrown.

**Why it happens:** Chrome enforces an "autoplay policy" — `AudioContext` starts in `suspended` state and must be resumed via `audioContext.resume()` triggered by a user gesture. During a rowing session, the user may not touch the screen for 5-10 minutes. The OS or browser may suspend the context. Streaming audio via `fetch` + `AudioContext.decodeAudioData` or MediaSource Extensions requires the context to be in `running` state.

**Consequences:** Coach goes silent mid-interval. User has no feedback. The LLM/TTS pipeline may still be computing responses that are queued but never played.

**Prevention:**
- Create `AudioContext` inside the "Start Session" button handler — guaranteed user gesture
- Before every TTS playback, check `audioContext.state === 'running'`; if `suspended`, call `audioContext.resume()` and await it
- Add a "tap anywhere to restore audio" overlay if audio context fails to resume, rather than silent failure
- Test: leave device idle for 10 minutes mid-session, then trigger a cue

**Detection / Warning Signs:**
- `AudioContext` instantiated at module load or app init, not inside a user gesture handler
- TTS queued but never confirmed played (no playback end event tracking)
- No `audioContext.state` check before playback

**Phase to address:** TTS / audio pipeline phase. Must be verified before any coaching UX testing.

---

### Pitfall 3: Treating Hybrid Cue Latency Budget as Additive Rather Than End-to-End

**What goes wrong:** The 500ms latency target for pre-computed cues is measured from "decision to speak" to "audio starts playing." Builders commonly measure only one leg (e.g., TTS synthesis time) and miss that the full pipeline is: data event → cue decision logic → TTS API request → audio buffered → AudioContext playback starts. Each leg adds latency.

**Why it happens:** Cartesia Sonic's streaming TTS can deliver first audio chunk in ~100-150ms. But if cue decision logic runs a template match, serializes to JSON, and makes an HTTP request to a backend that then calls Cartesia, the full RTT may be 400-600ms before the user hears anything — violating the budget even with "fast" TTS.

**Consequences:** Coaching cues that arrive after the stroke they're coaching are worse than no cues. "Push harder!" arriving 800ms after the split spike is confusing. The user loses trust in the coach's real-time awareness.

**Prevention:**
- Measure end-to-end from PM5 notification event to first audio sample, not just TTS API latency
- For pre-computed path: run cue decision logic client-side (no server round trip), call Cartesia directly from the client with a pre-generated cue string
- Pre-cache the 10-15 most common cue audio files at session start (Cartesia synthesis → ArrayBuffer → IndexedDB) so common cues are instant playback
- Reserve LLM path only for conversational responses (check-ins, debriefs, mid-session "push me"), not real-time interval cues
- Add latency instrumentation from day one: timestamp every stage of the pipeline

**Detection / Warning Signs:**
- Pre-computed cues routed through a server API before reaching Cartesia
- No client-side audio caching strategy
- Latency only measured in Cartesia dashboard, not end-to-end in the app

**Phase to address:** Hybrid cue engine design phase. Lock the architecture before building — retrofitting client-side cue logic after server-centric architecture is a rewrite.

---

### Pitfall 4: Memory/Context Window Accumulation Breaks Long Sessions and Returning Users

**What goes wrong:** Naively passing full session history + coach memory + real-time PM5 data as Claude context on every LLM call causes: (a) token costs that scale with workout count, (b) latency that grows as history grows, and (c) context window limits eventually hit for power users.

**Why it happens:** The "coach who remembers you" value proposition tempts builders to stuff everything into the system prompt — last 10 sessions, all coach memory KV pairs, today's workout so far. At 50 sessions this is still manageable. At 500 sessions with detailed memory it's a problem.

**Consequences:** LLM response latency grows from 440ms to 1200ms+ for returning users. Cost per session spikes. Eventually requests fail with context length errors for the most engaged users — the exact users the product most needs to retain.

**Prevention:**
- Design a memory summarization strategy before launch: raw session rows are never passed raw to Claude. Always summarize to a fixed-size "coach memory snapshot" (e.g., 500 tokens max)
- Separate memory tiers: (1) static profile (onboarding, injuries, preferences — ~200 tokens), (2) rolling summary of last 4 weeks (~300 tokens), (3) today's session running context (~200 tokens). Total context budget: ~700 tokens for memory, rest for prompt + response
- Write a `compactMemory()` function that runs post-session to distill new session data into the rolling summary
- Use Supabase functions/triggers to enforce memory schema, not ad-hoc KV writes
- Test with a "veteran user" fixture: simulate 100+ sessions in Supabase and verify LLM latency and cost don't regress

**Detection / Warning Signs:**
- System prompt built by concatenating raw session rows
- No max-length enforcement on coach memory fields
- First-time user and 6-month user get same context construction logic

**Phase to address:** Memory architecture phase (before any LLM integration). The schema decision is load-bearing — changing it post-launch requires a data migration.

---

### Pitfall 5: PWA Install / Permissions Gate Blocks the First Coaching Session

**What goes wrong:** Web Bluetooth, Screen Wake Lock, and persistent storage all require explicit user permission prompts. On first launch, if these are requested in sequence without context, users deny them — especially Bluetooth, which triggers Android's system dialog without explanation. After denial, re-requesting requires the user to go into Android settings. Many won't.

**Why it happens:** PWA builders often call `navigator.bluetooth.requestDevice()` at app init or on a "Connect" button with no explanation of why Bluetooth is needed. The Android system dialog says only "Allow [site] to access Bluetooth?" — no coaching context. Users who don't understand the value deny by default.

**Consequences:** User can't complete onboarding. Bluetooth permission denied at OS level. App is effectively broken for that user until they manually re-enable in Android settings — most will just uninstall.

**Prevention:**
- Use a "permission rationale" screen before each system prompt: "RowAI needs Bluetooth to read your PM5 in real-time — this is what makes coaching real. Tap 'Connect' to see the Android dialog."
- Request Bluetooth only after onboarding is complete, not at app start
- Request Wake Lock only at session start, not during setup
- Request persistent storage (`navigator.storage.persist()`) silently in the background — no user-visible benefit from surfacing this
- Test the "denied Bluetooth" path explicitly: show a recovery UI with a direct link to Android Bluetooth settings (`intent://settings/bluetooth`)
- Add a "why does this need Bluetooth?" help link adjacent to the connect button

**Detection / Warning Signs:**
- `navigator.bluetooth.requestDevice()` called without a preceding explanation screen
- No error handling for `DOMException: User cancelled the requestDevice() chooser`
- No recovery path shown when Bluetooth permission is denied

**Phase to address:** Onboarding phase. The permission flow is the literal first impression for every user.

---

## Moderate Pitfalls

---

### Pitfall 6: Coaching Voice Interrupts Itself During High-Frequency PM5 Events

**What goes wrong:** PM5 sends GATT notifications every stroke (~2-4 seconds). If every notification triggers a cue evaluation and the cue cooldown logic isn't tight, the coach talks over itself — or fires a new cue while the previous one is still playing.

**Why it happens:** A naive implementation subscribes to PM5 notifications, checks cue conditions, and calls TTS on each event that meets threshold. At 20 strokes per minute (SPM), that's a notification every 3 seconds. If a cue takes 4 seconds to speak, the next cue fires while the first is still playing.

**Prevention:**
- Maintain a `coachIsSpeaking` boolean locked during TTS playback, cleared in the `onended` audio event
- Implement a minimum cue spacing (e.g., 15 seconds) separate from the speaking lock
- Queue cues, not fire-and-forget — if a higher-priority cue fires while the coach is speaking, evaluate whether to interrupt, continue, or discard
- Pre-compute cue cooldown windows per cue type (e.g., "split warning" max once per 30s, "good rhythm" max once per 60s)

**Detection / Warning Signs:**
- No `isSpeaking` guard on TTS dispatch
- Cue logic fires directly from notification handler without a scheduling layer

**Phase to address:** Real-time coaching engine phase.

---

### Pitfall 7: Supabase RLS Misconfiguration Exposes Session Data

**What goes wrong:** Supabase Row Level Security policies are either (a) too permissive (anon role can read all sessions) or (b) too restrictive (authenticated user can't read their own data). Both are silent — the app appears to work in development but fails in production.

**Why it happens:** Supabase's default for new tables is RLS disabled. Builders enabling it for the first time often copy-paste policies from docs without testing the anon + authenticated combination. The coach memory KV store (personal health/performance data) is especially sensitive.

**Prevention:**
- Enable RLS on every table at creation time, not as an afterthought
- Write RLS policies as the first migration, before any data
- Test with three personas: anon (should see nothing), authenticated as user A (sees only A's data), authenticated as user B (sees only B's data)
- The coach memory table should have no anon read policy — period

**Detection / Warning Signs:**
- RLS enabled after tables already have data
- No automated test for cross-user data isolation
- Supabase anon key used for authenticated operations

**Phase to address:** Database setup phase (earliest). RLS retrofitting is high-risk.

---

### Pitfall 8: TTS Streaming Causes Audio Glitches When Network Degrades Mid-Session

**What goes wrong:** Cartesia Sonic's streaming TTS delivers audio in chunks. On a degraded WiFi connection mid-session, chunk delivery slows, causing audible pauses, clicks, or buffer underruns mid-sentence. "Good rhythm, keep your... [500ms silence] ...split consistent" is jarring.

**Why it happens:** Streaming TTS via fetch + ReadableStream requires consistent chunk delivery. Buffer management on the client is non-trivial — too small a buffer and you get glitches, too large and you add latency.

**Prevention:**
- Pre-buffer: don't start playback until N bytes received (tune for cue length vs. latency tradeoff)
- For short cues (<3 seconds), buffer the entire audio before playback — eliminates glitch risk at cost of ~50-100ms
- For long conversational responses (debrief), use streaming playback with a larger buffer
- Implement a graceful degradation: if Cartesia request fails or times out (>800ms), fall back to pre-cached audio or Web Speech API synthesis
- Monitor: log all TTS requests with timing and network condition to catch degradation patterns early

**Detection / Warning Signs:**
- No buffering strategy documented in TTS integration
- Single playback path regardless of cue length
- No fallback if Cartesia is unreachable

**Phase to address:** TTS integration phase.

---

### Pitfall 9: PM5 GATT Characteristic Parsing Assumes a Specific Firmware Version

**What goes wrong:** The Concept2 PM5 GATT service (`CE060030-...`) has multiple characteristics (rowing status, stroke data, additional status). The byte layout of these characteristics can differ between PM5 firmware versions. A parser written against one firmware version silently produces wrong values on another.

**Why it happens:** The Concept2 BLE communications spec is publicly documented, but firmware updates occasionally change byte offsets or add new fields. Builders write a byte parser that works on their device, ship it, and then get reports of wrong split/wattage values from other users.

**Prevention:**
- Reference the official Concept2 PM5 BLE Communications Interface Definition (not just blog posts or community reverse-engineering)
- Add firmware version detection at BLE connect time — log the PM5 firmware version in session metadata
- Write a data validation layer that range-checks parsed values (e.g., split < 1:00/500m is physically impossible, split > 15:00/500m is suspicious)
- Add a "raw bytes" debug mode for the first 10 sessions to catch parsing errors before they become invisible

**Detection / Warning Signs:**
- PM5 parser written from a blog post or GitHub gist rather than official spec
- No range validation on parsed PM5 metrics
- No firmware version logged at connect time

**Phase to address:** BLE integration phase.

---

## Minor Pitfalls

---

### Pitfall 10: IndexedDB Quota Exhaustion Breaks Offline Session Cache

**What goes wrong:** If pre-cached audio files (cues) + offline session data exceed the browser's IndexedDB quota, Chrome silently fails write operations. The cache appears empty on next session.

**Prevention:**
- Check `navigator.storage.estimate()` before caching audio files. If available storage < 50MB, skip audio pre-caching and use streaming-only
- Keep the offline session queue small (last 5 sessions, not all history)
- Request `navigator.storage.persist()` to opt into persistent storage (prevents quota eviction under storage pressure)

**Phase to address:** Caching / offline strategy phase.

---

### Pitfall 11: Onboarding Data (Injuries, Limitations) Not Reflected in LLM Prompts

**What goes wrong:** User enters "bad lower back" during onboarding. Three months later the coach recommends aggressive rate pyramids that are contraindicated. The coach "forgot" because the onboarding data was stored but never reliably included in the LLM system prompt.

**Prevention:**
- Create a `static_profile` section of the system prompt that is always included — never summarized away
- Treat injury/limitation flags as invariant: they go into the prompt verbatim, not merged into rolling summaries
- Add an onboarding review step at the start of each "phase" of training (e.g., every 4 weeks) that prompts user to confirm profile is still accurate

**Phase to address:** Memory architecture phase.

---

### Pitfall 12: Claude API Rate Limits Hit During Post-Session Debrief Concurrency

**What goes wrong:** If multiple users finish sessions at the same time (morning peak), simultaneous Claude API calls for post-session debriefs hit rate limits. Debrief generation fails for some users with a 529 error and no retry logic.

**Prevention:**
- Implement exponential backoff + retry for all Claude API calls (3 retries, max 10s wait)
- Queue post-session debrief calls with a simple in-memory queue (Vercel Edge or server-side) rather than firing concurrently from all clients
- Debrief is not latency-sensitive (user just finished rowing) — a 5-10 second delay with "Preparing your debrief..." is acceptable

**Phase to address:** LLM integration phase.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| BLE integration | Connection lost on screen lock (Pitfall 1) | Wake Lock + reconnect handler from day one |
| BLE integration | PM5 parser byte layout wrong (Pitfall 9) | Use official Concept2 BLE spec, validate ranges |
| Audio/TTS pipeline | AudioContext suspended (Pitfall 2) | Create context on user gesture, check state before play |
| Audio/TTS pipeline | Network glitch mid-cue (Pitfall 8) | Buffer strategy per cue length |
| Hybrid cue engine | Latency measured wrong (Pitfall 3) | End-to-end instrumentation from first build |
| Hybrid cue engine | Cue overlap / coach talks over itself (Pitfall 6) | Speaking lock + cue scheduler before first demo |
| Memory architecture | Context window grows unbounded (Pitfall 4) | Fixed-size memory snapshot design before schema |
| Memory architecture | Injury data lost in summarization (Pitfall 11) | Static profile section never summarized |
| Onboarding | Bluetooth permission denied (Pitfall 5) | Rationale screen before system dialog |
| Database setup | RLS misconfigured (Pitfall 7) | RLS at table creation, three-persona test |
| LLM integration | Rate limits on debrief (Pitfall 12) | Retry + queue from integration start |
| Caching | IndexedDB quota exhaustion (Pitfall 10) | Storage estimate check before audio cache |

---

## Confidence Notes

| Pitfall | Confidence | Basis |
|---------|------------|-------|
| BLE screen lock (1) | HIGH | Web Bluetooth spec + Screen Wake Lock spec well-documented in training; Chrome Android behavior well-reported in developer community |
| AudioContext suspension (2) | HIGH | Chrome autoplay policy is well-documented; consistent behavior across training data sources |
| End-to-end latency budget (3) | HIGH | Basic distributed systems measurement — not platform-specific |
| Memory context accumulation (4) | HIGH | LLM context management is a well-documented scaling problem |
| Permission gate UX (5) | HIGH | Android permission UX patterns well-documented |
| Cue overlap (6) | MEDIUM | Implementation pattern — specific to this app's design |
| Supabase RLS (7) | MEDIUM | Supabase docs well-covered; RLS pitfalls frequently cited in community |
| TTS streaming glitch (8) | MEDIUM | Cartesia-specific streaming behavior not verified against current docs |
| PM5 firmware parsing (9) | MEDIUM | Concept2 BLE spec is public but firmware version variation unverified |
| IndexedDB quota (10) | MEDIUM | Storage quota behavior documented but Chrome Android specifics unverified |
| Onboarding data in prompts (11) | HIGH | Prompt engineering pattern — implementation discipline issue |
| Claude rate limits (12) | MEDIUM | Anthropic rate limits change; specific tiers not verified against current pricing |

---

## Sources

- Concept2 PM5 BLE Communications Interface Definition (official) — verify at developers.concept2.com before BLE implementation
- Chrome Web Bluetooth spec and known issues: chromestatus.com/feature/5264933985976320
- Screen Wake Lock API: w3c.github.io/screen-wake-lock/
- Web Audio API autoplay policy: developer.chrome.com/blog/autoplay/
- Cartesia Sonic streaming TTS documentation — verify current buffering behavior at docs.cartesia.ai
- Anthropic Claude API rate limits — verify current tier limits at docs.anthropic.com/rate-limits
- Supabase RLS documentation: supabase.com/docs/guides/auth/row-level-security

*Note: Web search and WebFetch tools were unavailable during this research session. All findings are from training knowledge (cutoff August 2025). Items marked MEDIUM confidence should be spot-checked against current official docs during the relevant implementation phase.*
