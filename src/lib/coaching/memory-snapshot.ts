import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Formats split milliseconds to "M:SS" or "--:--" if null.
 */
function formatSplitFromMs(ms: number | null): string {
  if (ms === null || ms === undefined) return '--:--';
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

/**
 * Formats seconds to "MM:SS".
 */
function formatDurationFromS(s: number): string {
  const min = Math.floor(s / 60);
  const sec = s % 60;
  return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
}

interface SessionRow {
  started_at: string;
  duration_s: number;
  total_meters: number;
  avg_split_ms: number | null;
  avg_watts: number | null;
  avg_stroke_rate: number | null;
  session_type: string | null;
}

interface MemoryRow {
  key: string;
  value: string;
}

interface ProfileRow {
  display_name: string;
}

/**
 * Assembles a plain-text memory snapshot for the LLM system prompt.
 *
 * Reads:
 * - Last 5 sessions (ordered by started_at DESC)
 * - Top 20 coach memory KV entries (ordered by updated_at DESC)
 * - User display name from profiles
 *
 * Returns a bounded text block (~500 tokens for full 5 sessions + 20 KV entries).
 */
export async function buildMemorySnapshot(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  // Run all three queries in parallel
  const [sessionsResult, memoryResult, profileResult] = await Promise.all([
    supabase
      .from('sessions')
      .select('started_at, duration_s, total_meters, avg_split_ms, avg_watts, avg_stroke_rate, session_type')
      .eq('user_id', userId)
      .order('started_at', { ascending: false })
      .limit(5),
    supabase
      .from('coach_memory')
      .select('key, value')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(20),
    supabase
      .from('profiles')
      .select('display_name')
      .eq('id', userId)
      .single(),
  ]);

  // Profile section
  const profile = profileResult.data as ProfileRow | null;
  const displayName = profile?.display_name ?? 'Unknown';

  // Sessions section
  const sessions = (sessionsResult.data as SessionRow[] | null) ?? [];
  let sessionsText: string;
  if (sessions.length === 0) {
    sessionsText = 'No previous sessions';
  } else {
    sessionsText = sessions
      .map((s, i) => {
        const date = s.started_at.slice(0, 10); // YYYY-MM-DD
        const duration = formatDurationFromS(s.duration_s);
        const split = formatSplitFromMs(s.avg_split_ms);
        const watts = s.avg_watts !== null && s.avg_watts !== undefined ? `${s.avg_watts}W` : '--W';
        const rate = s.avg_stroke_rate !== null && s.avg_stroke_rate !== undefined
          ? `${s.avg_stroke_rate}spm`
          : '--spm';
        const type = s.session_type ?? 'unspecified';
        return `${i + 1}. ${date} | ${duration} | ${Math.round(s.total_meters)}m | ${split}/500m | ${watts} | ${rate} | ${type}`;
      })
      .join('\n');
  }

  // KV memory section
  const memory = (memoryResult.data as MemoryRow[] | null) ?? [];
  let memoryText: string;
  if (memory.length === 0) {
    memoryText = 'No coach notes yet';
  } else {
    memoryText = memory.map((m) => `- ${m.key}: ${m.value}`).join('\n');
  }

  return `## Athlete Profile
Name: ${displayName}

## Recent Sessions (newest first)
${sessionsText}

## Coach Notes
${memoryText}`;
}
