import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildMemorySnapshot } from './memory-snapshot';

// Helper to build a mock Supabase query chain
function buildQueryChain(result: { data: unknown; error: null | { message: string } }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
    then: undefined as unknown,
  };
  // Make it thenable so await works directly on the chain
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return chain;
}

function makeMockSupabase({
  sessions = { data: [], error: null },
  memory = { data: [], error: null },
  profile = { data: null as { display_name: string } | null, error: null as { message: string } | null },
}: {
  sessions?: { data: unknown; error: null | { message: string } };
  memory?: { data: unknown; error: null | { message: string } };
  profile?: { data: { display_name: string } | null; error: { message: string } | null };
} = {}) {
  const fromMap: Record<string, ReturnType<typeof buildQueryChain>> = {
    sessions: buildQueryChain(sessions),
    coach_memory: buildQueryChain(memory),
    profiles: buildQueryChain(profile),
  };

  return {
    from: vi.fn((table: string) => fromMap[table] ?? buildQueryChain({ data: null, error: null })),
  };
}

describe('buildMemorySnapshot', () => {
  describe('section headers', () => {
    it('always includes all three section headers', async () => {
      const supabase = makeMockSupabase();
      const result = await buildMemorySnapshot(supabase as unknown as import('@supabase/supabase-js').SupabaseClient, 'user-1');
      expect(result).toContain('## Athlete Profile');
      expect(result).toContain('## Recent Sessions');
      expect(result).toContain('## Coach Notes');
    });
  });

  describe('empty state', () => {
    it('shows "No previous sessions" when sessions array is empty', async () => {
      const supabase = makeMockSupabase({ sessions: { data: [], error: null } });
      const result = await buildMemorySnapshot(supabase as unknown as import('@supabase/supabase-js').SupabaseClient, 'user-1');
      expect(result).toContain('No previous sessions');
    });

    it('shows "No coach notes yet" when memory array is empty', async () => {
      const supabase = makeMockSupabase({ memory: { data: [], error: null } });
      const result = await buildMemorySnapshot(supabase as unknown as import('@supabase/supabase-js').SupabaseClient, 'user-1');
      expect(result).toContain('No coach notes yet');
    });

    it('shows "Unknown" when profile name is missing', async () => {
      const supabase = makeMockSupabase({ profile: { data: null, error: null } });
      const result = await buildMemorySnapshot(supabase as unknown as import('@supabase/supabase-js').SupabaseClient, 'user-1');
      expect(result).toContain('Name: Unknown');
    });
  });

  describe('with session data', () => {
    const sampleSessions = [
      {
        started_at: '2026-04-09T07:00:00Z',
        duration_s: 1320,
        total_meters: 5000,
        avg_split_ms: 132000,
        avg_watts: 210,
        avg_stroke_rate: 22.5,
        session_type: 'steady_state',
      },
      {
        started_at: '2026-04-07T07:00:00Z',
        duration_s: 900,
        total_meters: 3200,
        avg_split_ms: null,
        avg_watts: null,
        avg_stroke_rate: 20,
        session_type: null,
      },
    ];

    it('includes session date in YYYY-MM-DD format', async () => {
      const supabase = makeMockSupabase({ sessions: { data: sampleSessions, error: null } });
      const result = await buildMemorySnapshot(supabase as unknown as import('@supabase/supabase-js').SupabaseClient, 'user-1');
      expect(result).toContain('2026-04-09');
      expect(result).toContain('2026-04-07');
    });

    it('formats duration as MM:SS', async () => {
      const supabase = makeMockSupabase({ sessions: { data: sampleSessions, error: null } });
      const result = await buildMemorySnapshot(supabase as unknown as import('@supabase/supabase-js').SupabaseClient, 'user-1');
      // 1320s = 22:00
      expect(result).toContain('22:00');
      // 900s = 15:00
      expect(result).toContain('15:00');
    });

    it('formats avg_split_ms as M:SS /500m', async () => {
      const supabase = makeMockSupabase({ sessions: { data: sampleSessions, error: null } });
      const result = await buildMemorySnapshot(supabase as unknown as import('@supabase/supabase-js').SupabaseClient, 'user-1');
      // 132000ms = 132s = 2:12
      expect(result).toContain('2:12/500m');
    });

    it('shows "--:--" for null split', async () => {
      const supabase = makeMockSupabase({ sessions: { data: sampleSessions, error: null } });
      const result = await buildMemorySnapshot(supabase as unknown as import('@supabase/supabase-js').SupabaseClient, 'user-1');
      expect(result).toContain('--:--/500m');
    });

    it('includes distance and watts', async () => {
      const supabase = makeMockSupabase({ sessions: { data: sampleSessions, error: null } });
      const result = await buildMemorySnapshot(supabase as unknown as import('@supabase/supabase-js').SupabaseClient, 'user-1');
      expect(result).toContain('5000m');
      expect(result).toContain('210W');
    });

    it('shows "--" for null watts', async () => {
      const supabase = makeMockSupabase({ sessions: { data: sampleSessions, error: null } });
      const result = await buildMemorySnapshot(supabase as unknown as import('@supabase/supabase-js').SupabaseClient, 'user-1');
      expect(result).toContain('--W');
    });
  });

  describe('with memory data', () => {
    const sampleMemory = [
      { key: 'preferred_rate', value: '22 spm' },
      { key: 'endurance_trend', value: 'improving' },
    ];

    it('lists all KV memory entries', async () => {
      const supabase = makeMockSupabase({ memory: { data: sampleMemory, error: null } });
      const result = await buildMemorySnapshot(supabase as unknown as import('@supabase/supabase-js').SupabaseClient, 'user-1');
      expect(result).toContain('preferred_rate: 22 spm');
      expect(result).toContain('endurance_trend: improving');
    });
  });

  describe('with profile data', () => {
    it('includes the athlete display name', async () => {
      const supabase = makeMockSupabase({
        profile: { data: { display_name: 'John' }, error: null },
      });
      const result = await buildMemorySnapshot(supabase as unknown as import('@supabase/supabase-js').SupabaseClient, 'user-1');
      expect(result).toContain('Name: John');
    });
  });

  describe('query construction', () => {
    it('queries sessions with correct table, order, and limit', async () => {
      const supabase = makeMockSupabase();
      await buildMemorySnapshot(supabase as unknown as import('@supabase/supabase-js').SupabaseClient, 'user-1');

      // sessions chain
      const sessionChain = supabase.from.mock.calls
        .map((call: string[], i: number) => ({ table: call[0], chain: (supabase.from as ReturnType<typeof vi.fn>).mock.results[i].value }))
        .find((r: { table: string }) => r.table === 'sessions')?.chain;

      expect(sessionChain?.order).toHaveBeenCalledWith('started_at', { ascending: false });
      expect(sessionChain?.limit).toHaveBeenCalledWith(5);
    });

    it('queries coach_memory with correct order and limit', async () => {
      const supabase = makeMockSupabase();
      await buildMemorySnapshot(supabase as unknown as import('@supabase/supabase-js').SupabaseClient, 'user-1');

      const memoryChain = supabase.from.mock.calls
        .map((call: string[], i: number) => ({ table: call[0], chain: (supabase.from as ReturnType<typeof vi.fn>).mock.results[i].value }))
        .find((r: { table: string }) => r.table === 'coach_memory')?.chain;

      expect(memoryChain?.order).toHaveBeenCalledWith('updated_at', { ascending: false });
      expect(memoryChain?.limit).toHaveBeenCalledWith(20);
    });

    it('passes userId to eq filters', async () => {
      const supabase = makeMockSupabase();
      await buildMemorySnapshot(supabase as unknown as import('@supabase/supabase-js').SupabaseClient, 'user-abc');

      for (const chain of (supabase.from as ReturnType<typeof vi.fn>).mock.results.map((r: { value: unknown }) => r.value)) {
        const eqCalls = (chain as ReturnType<typeof buildQueryChain>).eq.mock.calls;
        // Each table chain should filter by user_id = 'user-abc' (or id for profiles)
        expect(eqCalls.some((c: unknown[]) => c[1] === 'user-abc')).toBe(true);
      }
    });
  });

  describe('snapshot size bound', () => {
    it('stays under 2000 characters for 5 sessions + 20 KV entries', async () => {
      const sessions = Array.from({ length: 5 }, (_, i) => ({
        started_at: `2026-04-0${i + 1}T07:00:00Z`,
        duration_s: 1200 + i * 60,
        total_meters: 4000 + i * 500,
        avg_split_ms: 120000 + i * 1000,
        avg_watts: 200 + i * 5,
        avg_stroke_rate: 22 + i * 0.5,
        session_type: 'steady_state',
      }));

      const memory = Array.from({ length: 20 }, (_, i) => ({
        key: `key_${i}`,
        value: `value for key ${i}`,
      }));

      const supabase = makeMockSupabase({
        sessions: { data: sessions, error: null },
        memory: { data: memory, error: null },
        profile: { data: { display_name: 'John' }, error: null },
      });

      const result = await buildMemorySnapshot(supabase as unknown as import('@supabase/supabase-js').SupabaseClient, 'user-1');
      expect(result.length).toBeLessThan(2000);
    });
  });

  describe('error handling', () => {
    it('returns snapshot with empty sections when Supabase returns errors', async () => {
      const supabase = makeMockSupabase({
        sessions: { data: null, error: { message: 'DB error' } },
        memory: { data: null, error: { message: 'DB error' } },
        profile: { data: null, error: { message: 'DB error' } },
      });
      const result = await buildMemorySnapshot(supabase as unknown as import('@supabase/supabase-js').SupabaseClient, 'user-1');
      expect(result).toContain('No previous sessions');
      expect(result).toContain('No coach notes yet');
    });
  });
});
