// Note: These types are defined locally because coaching-types.ts (created by Plan 01)
// may not exist yet at execution time (both plans run in parallel, wave 1).
// Plan 03 (wave 2) will reconcile imports once both plans complete.

export interface SessionWritePayload {
  userId: string;
  startedAt: number;
  endedAt: number;
  totalMeters: number;
  avgSplitMs: number | null;
  avgWatts: number | null;
  avgStrokeRate: number | null;
  energyLevel: number | null;
  sessionType: string | null;
}

export interface CoachMemoryEntry {
  key: string;
  value: string;
}

import { createClient } from '@/lib/supabase/client';

/**
 * Inserts a row into the sessions table.
 * Returns the inserted row's id, or null on error.
 * Fire-and-forget: does not throw on failure.
 */
export async function writeSession(
  data: SessionWritePayload
): Promise<{ id: string } | null> {
  try {
    const supabase = createClient();
    const { data: row, error } = await supabase
      .from('sessions')
      .insert({
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
      })
      .select('id')
      .single();

    if (error) {
      console.error('[session-writer] writeSession error:', error.message);
      return null;
    }

    return row as { id: string };
  } catch (err) {
    console.error('[session-writer] writeSession unexpected error:', err);
    return null;
  }
}

/**
 * Upserts coach memory KV entries for a user.
 * Uses onConflict 'user_id,key' so each key is a single row per user.
 * Fire-and-forget: does not throw on failure.
 */
export async function writeCoachMemory(
  userId: string,
  entries: CoachMemoryEntry[]
): Promise<void> {
  if (entries.length === 0) return;

  try {
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

    if (error) {
      console.error('[session-writer] writeCoachMemory error:', error.message);
    }
  } catch (err) {
    console.error('[session-writer] writeCoachMemory unexpected error:', err);
  }
}
