# Phase 3: Memory & History - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase makes coaching compound across sessions. The coach reads session history and KV memory before each session, references past sessions naturally in conversation, and each workout makes future coaching smarter. It also adds session history browsing, offline session caching, and a fixed-size memory snapshot to keep LLM context bounded. No new coaching features — just making existing coaching remember.

</domain>

<decisions>
## Implementation Decisions

### Memory Snapshot Design
- **D-01:** Structured summary block injected into the LLM system prompt — user profile (name, experience), last 5 session summaries (date, distance, split, standout moment), and top 20 most recently updated KV memory entries.
- **D-02:** Snapshot assembled SERVER-SIDE in `/api/coach` route — the route fetches last 5 sessions + KV memory from Supabase and injects into the system prompt. Client just sends the intent.
- **D-03:** KV memory capped at 20 entries (most recently updated). Old patterns naturally age out as new ones are written. Keeps snapshot at ~500 tokens.

### Session History UI
- **D-04:** Simple card list — scrollable list of cards, each showing date, duration, distance, avg split. One card per session. Consistent with dark theme, mobile-first.
- **D-05:** No detail view for v1 — all key stats shown inline on the card (date, duration, distance, avg split, avg watts, avg rate). No tap-to-expand or separate detail page.
- **D-06:** History accessible via tab or link on the `/checkin` screen — natural spot before starting a new session. No new navigation bar.

### Offline Caching & Sync
- **D-07:** Write-through with localStorage fallback — always try Supabase first. If write fails (network error), save to localStorage. Pending writes are unique inserts, no conflict resolution needed.
- **D-08:** Sync triggers on app load AND on reconnect (`navigator.onLine` event). Flush all pending writes silently.

### Memory Compounding
- **D-09:** Track performance trends + personal bests — best split, best distance, avg session duration, streak count, recent trend direction (improving/plateauing). Coach references these naturally.
- **D-10:** Coach references past sessions naturally woven into conversation — "Last Tuesday you held 1:55 for 20 minutes — think you can match that today?" No explicit "memory recall" callouts.

### Claude's Discretion
- Exact KV memory key names and schema design
- LLM system prompt structure for memory injection
- Session summary card layout and styling for history list
- Streak detection logic and trend calculation
- Offline sync queue implementation details
- How much of the debrief excerpt to store vs regenerate

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & Existing Code
- `.planning/research/ARCHITECTURE.md` — 5-layer pipeline architecture, Supabase Client component boundary
- `src/lib/coaching/session-writer.ts` — existing `writeSession()` and `writeCoachMemory()` functions
- `src/lib/coaching/coaching-types.ts` — `SessionWritePayload`, `CoachMemoryEntry` types
- `src/app/api/coach/route.ts` — existing Claude streaming proxy, system prompt assembly point
- `supabase/migrations/002_sessions_and_memory.sql` — existing sessions + coach_memory tables with RLS

### Project Context
- `.planning/PROJECT.md` — Core value ("coaching relationship that compounds"), Supabase Postgres KV decision
- `.planning/REQUIREMENTS.md` — MEM-01 through MEM-04, HIST-01, HIST-02
- `.planning/phases/02-coaching-loop/02-CONTEXT.md` — Phase 2 decisions (coach tone, cue style, debrief flow)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/lib/coaching/session-writer.ts` — `writeSession()` and `writeCoachMemory()` already write to Supabase. Phase 3 adds the READ side.
- `src/app/api/coach/route.ts` — Claude proxy with system prompt. Memory snapshot injection point is here.
- `src/lib/supabase/client.ts` + `server.ts` — Supabase clients for client-side and server-side reads.
- `src/components/session/SessionSummaryCard.tsx` — Card styling pattern reusable for history list cards.
- `src/components/checkin/CheckinScreen.tsx` — Check-in screen where history link/tab will be added.

### Established Patterns
- Zustand for state management
- `src/lib/` for service modules
- `src/components/` organized by feature area
- Dark theme, mobile-first, Tailwind CSS
- Fire-and-forget Supabase writes with console.error on failure

### Integration Points
- `/api/coach` route — inject memory snapshot into system prompt for all intents
- `/checkin` page — add history navigation link/tab
- New `/history` page — session list view
- `session-writer.ts` — wrap with localStorage fallback for offline support
- `navigator.onLine` — trigger pending write sync

</code_context>

<specifics>
## Specific Ideas

- The memory snapshot is the key differentiator — it's what makes "Hello [name], last time you rowed 5K in 22 minutes" possible without the user telling the coach anything.
- Performance trends computed from the sessions table (last N sessions) — not stored as separate KV entries. KV memory is for qualitative patterns the LLM extracts ("prefers steady state", "tends to start too fast").
- The history UI is intentionally simple — it's a stopping point, not a Strava clone. Session detail pages and charts are future work.
- Offline caching should be invisible — the user should never know their session was cached locally. It just syncs next time.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 03-memory-history*
*Context gathered: 2026-04-11*
