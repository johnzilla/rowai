/**
 * offline-cache.ts
 *
 * localStorage-backed queue for session and memory writes that fail due to
 * network unavailability. Pending items are flushed on app load and when
 * the device comes back online (see SyncTrigger component in layout).
 *
 * Design decisions:
 * - No circular dependency: flushPendingWrites uses internal direct helpers
 *   (writeSessionDirect / writeMemoryDirect) rather than importing from
 *   session-writer.ts, which itself imports from this module.
 * - SSR safety: all public functions guard with typeof window === 'undefined'.
 * - Threat T-03-07: corrupted localStorage entries are caught and cleared
 *   to prevent infinite retry loops.
 */

import { createClient } from '@/lib/supabase/client';
import type { CoachMemoryEntry, SessionWritePayload } from './coaching-types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SESSION_QUEUE_KEY = 'rowai_pending_sessions';
const MEMORY_QUEUE_KEY = 'rowai_pending_memory';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PendingMemoryWrite {
  userId: string;
  entries: CoachMemoryEntry[];
}

// ---------------------------------------------------------------------------
// Helpers — read / write queue safely
// ---------------------------------------------------------------------------

function readQueue<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    return JSON.parse(raw) as T[];
  } catch {
    // T-03-07: corrupted data — clear queue to prevent infinite retry
    console.warn(`[offline-cache] corrupted queue at "${key}", clearing`);
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
    return [];
  }
}

function writeQueue<T>(key: string, items: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch (err) {
    console.warn(`[offline-cache] failed to persist queue "${key}":`, err);
  }
}

// ---------------------------------------------------------------------------
// Public — cache writers
// ---------------------------------------------------------------------------

/**
 * Appends a SessionWritePayload to the localStorage pending-sessions queue.
 * No-op in SSR environments.
 */
export function cachePendingSession(data: SessionWritePayload): void {
  if (typeof window === 'undefined') return;
  const queue = readQueue<SessionWritePayload>(SESSION_QUEUE_KEY);
  queue.push(data);
  writeQueue(SESSION_QUEUE_KEY, queue);
}

/**
 * Appends a memory write to the localStorage pending-memory queue.
 * No-op in SSR environments.
 */
export function cachePendingMemory(userId: string, entries: CoachMemoryEntry[]): void {
  if (typeof window === 'undefined') return;
  const queue = readQueue<PendingMemoryWrite>(MEMORY_QUEUE_KEY);
  queue.push({ userId, entries });
  writeQueue(MEMORY_QUEUE_KEY, queue);
}

// ---------------------------------------------------------------------------
// Internal — direct Supabase writers (no offline fallback to avoid circular dep)
// ---------------------------------------------------------------------------

async function writeSessionDirect(data: SessionWritePayload): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from('sessions').insert({
    user_id: data.userId,
    started_at: new Date(data.startedAt).toISOString(),
    ended_at: new Date(data.endedAt).toISOString(),
    duration_s: Math.round((data.endedAt - data.startedAt) / 1000),
    total_meters: data.totalMeters,
    avg_split_ms: data.avgSplitMs,
    avg_watts: data.avgWatts,
    avg_stroke_rate: data.avgStrokeRate,
    energy_level: data.energyLevel,
    session_type: data.sessionType,
  });
  return !error;
}

async function writeMemoryDirect(userId: string, entries: CoachMemoryEntry[]): Promise<boolean> {
  const supabase = createClient();
  const rows = entries.map((entry) => ({
    user_id: userId,
    key: entry.key,
    value: entry.value,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase
    .from('coach_memory')
    .upsert(rows, { onConflict: 'user_id,key' });
  return !error;
}

// ---------------------------------------------------------------------------
// Public — flush
// ---------------------------------------------------------------------------

/**
 * Reads both localStorage queues and attempts to sync pending writes to
 * Supabase. Successfully written items are removed from the queue; failed
 * items remain for the next attempt.
 *
 * Safe to call when queues are empty (no-op).
 * Safe to call in SSR environments (no-op).
 */
export async function flushPendingWrites(): Promise<void> {
  if (typeof window === 'undefined') return;

  // --- sessions ----------------------------------------------------------------
  const pendingSessions = readQueue<SessionWritePayload>(SESSION_QUEUE_KEY);
  if (pendingSessions.length > 0) {
    const remaining: SessionWritePayload[] = [];
    let flushedSessions = 0;

    for (const session of pendingSessions) {
      try {
        const ok = await writeSessionDirect(session);
        if (ok) {
          flushedSessions++;
        } else {
          remaining.push(session);
        }
      } catch {
        remaining.push(session);
      }
    }

    writeQueue(SESSION_QUEUE_KEY, remaining);

    if (flushedSessions > 0) {
      console.log(`[offline-cache] flushed ${flushedSessions} sessions`);
    }
  }

  // --- memory ------------------------------------------------------------------
  const pendingMemory = readQueue<PendingMemoryWrite>(MEMORY_QUEUE_KEY);
  if (pendingMemory.length > 0) {
    const remaining: PendingMemoryWrite[] = [];
    let flushedMemory = 0;

    for (const write of pendingMemory) {
      try {
        const ok = await writeMemoryDirect(write.userId, write.entries);
        if (ok) {
          flushedMemory++;
        } else {
          remaining.push(write);
        }
      } catch {
        remaining.push(write);
      }
    }

    writeQueue(MEMORY_QUEUE_KEY, remaining);

    if (flushedMemory > 0) {
      console.log(`[offline-cache] flushed ${flushedMemory} memory writes`);
    }
  }

  // Combined log if both flushed
  const sessionsLeft = readQueue<SessionWritePayload>(SESSION_QUEUE_KEY).length;
  const memoryLeft = readQueue<PendingMemoryWrite>(MEMORY_QUEUE_KEY).length;
  if (sessionsLeft === 0 && memoryLeft === 0 && (pendingSessions.length > 0 || pendingMemory.length > 0)) {
    console.log(
      `[offline-cache] flushed ${pendingSessions.length} sessions, ${pendingMemory.length} memory writes`
    );
  }
}
