/**
 * Tests for offline-cache.ts
 *
 * Uses a manual localStorage mock since jsdom/happy-dom are not installed.
 * The module guards SSR with typeof window === 'undefined', so we simulate
 * a browser environment by providing a window global.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- localStorage mock -----------------------------------------------------------

type StorageStore = Record<string, string>;

function createLocalStorageMock() {
  let store: StorageStore = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
    get _store() {
      return store;
    },
  };
}

// Provide a window global so the SSR guard passes
const localStorageMock = createLocalStorageMock();
(globalThis as Record<string, unknown>).window = { localStorage: localStorageMock };
(globalThis as Record<string, unknown>).localStorage = localStorageMock;

// --- Supabase mock ---------------------------------------------------------------

const mockInsert = vi.fn();
const mockUpsert = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    from: (table: string) => {
      if (table === 'sessions') {
        return { insert: mockInsert };
      }
      if (table === 'coach_memory') {
        return { upsert: mockUpsert };
      }
      throw new Error(`Unknown table: ${table}`);
    },
  }),
}));

// --- Import module under test (after mocks) ------------------------------------

import {
  cachePendingMemory,
  cachePendingSession,
  flushPendingWrites,
} from './offline-cache';

import type { SessionWritePayload } from './coaching-types';

// -------------------------------------------------------------------------------

const SESSION_QUEUE_KEY = 'rowai_pending_sessions';
const MEMORY_QUEUE_KEY = 'rowai_pending_memory';

function makeSession(overrides: Partial<SessionWritePayload> = {}): SessionWritePayload {
  return {
    userId: 'user-1',
    startedAt: 1_700_000_000_000,
    endedAt: 1_700_003_600_000,
    totalMeters: 8000,
    avgSplitMs: 120_000,
    avgWatts: 180,
    avgStrokeRate: 22,
    energyLevel: 4,
    sessionType: 'steady_state',
    ...overrides,
  };
}

beforeEach(() => {
  localStorageMock.clear();
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  mockInsert.mockReset();
  mockUpsert.mockReset();
});

// -------------------------------------------------------------------------------
// cachePendingSession
// -------------------------------------------------------------------------------

describe('cachePendingSession', () => {
  it('stores a session in localStorage under the sessions queue key', () => {
    const session = makeSession();
    cachePendingSession(session);

    const raw = localStorageMock._store[SESSION_QUEUE_KEY];
    expect(raw).toBeDefined();
    const stored = JSON.parse(raw);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ userId: 'user-1', totalMeters: 8000 });
  });

  it('accumulates multiple sessions in the queue', () => {
    cachePendingSession(makeSession({ userId: 'user-1' }));
    cachePendingSession(makeSession({ userId: 'user-2' }));

    const stored = JSON.parse(localStorageMock._store[SESSION_QUEUE_KEY]);
    expect(stored).toHaveLength(2);
    expect(stored[0].userId).toBe('user-1');
    expect(stored[1].userId).toBe('user-2');
  });
});

// -------------------------------------------------------------------------------
// cachePendingMemory
// -------------------------------------------------------------------------------

describe('cachePendingMemory', () => {
  it('stores a memory write in localStorage under the memory queue key', () => {
    cachePendingMemory('user-1', [{ key: 'goal', value: 'sub-2-minute split' }]);

    const raw = localStorageMock._store[MEMORY_QUEUE_KEY];
    expect(raw).toBeDefined();
    const stored = JSON.parse(raw);
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ userId: 'user-1', entries: [{ key: 'goal' }] });
  });

  it('accumulates multiple memory writes', () => {
    cachePendingMemory('user-1', [{ key: 'a', value: '1' }]);
    cachePendingMemory('user-2', [{ key: 'b', value: '2' }]);

    const stored = JSON.parse(localStorageMock._store[MEMORY_QUEUE_KEY]);
    expect(stored).toHaveLength(2);
  });
});

// -------------------------------------------------------------------------------
// flushPendingWrites — empty queues
// -------------------------------------------------------------------------------

describe('flushPendingWrites with empty queues', () => {
  it('is a no-op when both queues are empty', async () => {
    await flushPendingWrites();
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });
});

// -------------------------------------------------------------------------------
// flushPendingWrites — successful flush
// -------------------------------------------------------------------------------

describe('flushPendingWrites success', () => {
  it('removes sessions from queue after successful Supabase write', async () => {
    cachePendingSession(makeSession());
    mockInsert.mockResolvedValue({ error: null });

    await flushPendingWrites();

    const remaining = JSON.parse(
      localStorageMock._store[SESSION_QUEUE_KEY] ?? '[]'
    );
    expect(remaining).toHaveLength(0);
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });

  it('removes memory writes from queue after successful upsert', async () => {
    cachePendingMemory('user-1', [{ key: 'goal', value: 'faster' }]);
    mockUpsert.mockResolvedValue({ error: null });

    await flushPendingWrites();

    const remaining = JSON.parse(
      localStorageMock._store[MEMORY_QUEUE_KEY] ?? '[]'
    );
    expect(remaining).toHaveLength(0);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });
});

// -------------------------------------------------------------------------------
// flushPendingWrites — failure retention
// -------------------------------------------------------------------------------

describe('flushPendingWrites failure retention', () => {
  it('keeps sessions in queue when Supabase write returns an error', async () => {
    cachePendingSession(makeSession());
    mockInsert.mockResolvedValue({ error: { message: 'network error' } });

    await flushPendingWrites();

    const remaining = JSON.parse(localStorageMock._store[SESSION_QUEUE_KEY]);
    expect(remaining).toHaveLength(1);
  });

  it('keeps memory writes in queue when upsert returns an error', async () => {
    cachePendingMemory('user-1', [{ key: 'k', value: 'v' }]);
    mockUpsert.mockResolvedValue({ error: { message: 'network error' } });

    await flushPendingWrites();

    const remaining = JSON.parse(localStorageMock._store[MEMORY_QUEUE_KEY]);
    expect(remaining).toHaveLength(1);
  });

  it('retains only failed items when some succeed and some fail', async () => {
    cachePendingSession(makeSession({ userId: 'ok-user' }));
    cachePendingSession(makeSession({ userId: 'fail-user' }));

    mockInsert
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: { message: 'boom' } });

    await flushPendingWrites();

    const remaining = JSON.parse(localStorageMock._store[SESSION_QUEUE_KEY]);
    expect(remaining).toHaveLength(1);
    expect(remaining[0].userId).toBe('fail-user');
  });
});

// -------------------------------------------------------------------------------
// Threat T-03-07: corrupted localStorage clears queue (Rule 2 - mitigate DoS)
// -------------------------------------------------------------------------------

describe('flushPendingWrites with corrupted localStorage', () => {
  it('clears the sessions queue if stored value is unparseable JSON', async () => {
    localStorageMock._store[SESSION_QUEUE_KEY] = 'NOT_VALID_JSON{{';

    await flushPendingWrites();

    // After corrupt data, queue should be cleared
    expect(mockInsert).not.toHaveBeenCalled();
  });
});
