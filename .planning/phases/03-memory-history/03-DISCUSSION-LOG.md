# Phase 3: Memory & History - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 03-memory-history
**Areas discussed:** Memory snapshot design, Session history UI, Offline caching & sync, Memory compounding

---

## Memory Snapshot Design

| Option | Description | Selected |
|--------|-------------|----------|
| Structured summary block | Fixed-format text: user profile, last 5 sessions, top 20 KV entries | ✓ |
| Raw session data dump | Send full session rows directly | |
| You decide | Claude has discretion | |

**User's choice:** Structured summary block
**Notes:** Predictable size, easy to cap.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Server-side in /api/coach | Route fetches data and injects into system prompt | ✓ |
| Client-side before API call | Client assembles snapshot and sends in request body | |
| You decide | Claude picks | |

**User's choice:** Server-side in /api/coach
**Notes:** Client just sends the intent — server owns context assembly.

---

| Option | Description | Selected |
|--------|-------------|----------|
| 20 entries max | Top 20 most recently updated KV pairs (~500 tokens) | ✓ |
| Unlimited | Send everything | |
| You decide | Claude picks a cap | |

**User's choice:** 20 entries max
**Notes:** Old patterns naturally age out.

---

## Session History UI

| Option | Description | Selected |
|--------|-------------|----------|
| Simple card list | Scrollable cards with date, duration, distance, avg split | ✓ |
| Table/grid view | Compact sortable table | |
| You decide | Claude picks layout | |

**User's choice:** Simple card list

---

| Option | Description | Selected |
|--------|-------------|----------|
| No detail view for v1 | All key stats inline on card, no tap-to-expand | ✓ |
| Expandable card | Tap to expand in-place | |
| Separate detail page | Navigate to /history/[id] | |

**User's choice:** No detail view for v1
**Notes:** Detailed analytics can come later.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Tab/link on check-in screen | History link on /checkin page | ✓ |
| Bottom navigation bar | Persistent bottom nav with tabs | |
| You decide | Claude picks | |

**User's choice:** Tab or link on check-in screen
**Notes:** Natural spot — see history before starting a new session.

---

## Offline Caching & Sync

| Option | Description | Selected |
|--------|-------------|----------|
| Write-through with localStorage fallback | Try Supabase first, localStorage on failure | ✓ |
| localStorage first, sync later | Always write local first | |
| You decide | Claude picks | |

**User's choice:** Write-through with localStorage fallback
**Notes:** Each session is a unique insert — no conflict resolution needed.

---

| Option | Description | Selected |
|--------|-------------|----------|
| On app load + on reconnect | Check localStorage on startup and on navigator.onLine | ✓ |
| Only on app load | Just check on startup | |
| You decide | Claude picks | |

**User's choice:** On app load + on reconnect

---

## Memory Compounding

| Option | Description | Selected |
|--------|-------------|----------|
| Performance trends + personal bests | Best split, best distance, streak count, trend direction | ✓ |
| Everything the LLM decides | Let debrief LLM choose what to remember | |
| You decide | Claude designs memory schema | |

**User's choice:** Performance trends + personal bests
**Notes:** Coach references these: "Your split has been improving the last 3 sessions."

---

| Option | Description | Selected |
|--------|-------------|----------|
| Naturally woven in | Coach weaves memory into conversation naturally | ✓ |
| Explicit memory callouts | Coach explicitly flags memory use | |
| You decide | Claude calibrates | |

**User's choice:** Naturally woven in
**Notes:** "Last Tuesday you held 1:55 for 20 minutes — think you can match that today?" No explicit "memory recall."

---

## Claude's Discretion

- KV memory key names and schema design
- LLM system prompt structure for memory injection
- Session summary card layout for history list
- Streak detection logic and trend calculation
- Offline sync queue implementation details

## Deferred Ideas

None — discussion stayed within phase scope.
