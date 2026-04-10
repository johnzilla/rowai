'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useSessionStore } from '@/lib/session/session-store';
import { useCoachingStore } from '@/lib/coaching/coaching-store';
import { strokeProcessor } from '@/lib/coaching/stroke-processor';
import { cueRouter } from '@/lib/coaching/cue-router';
import { audioQueue } from '@/lib/coaching/audio-queue';
import { writeSession, writeCoachMemory } from '@/lib/coaching/session-writer';
import type { CoachMemoryEntry } from '@/lib/coaching/session-writer';

/**
 * useSessionLifecycle — manages session auto-start, auto-end detection,
 * post-session voice debrief, and Supabase persistence.
 *
 * D-08: Session auto-starts on first stroke (strokeState transitions from 0 to non-zero).
 * D-09: After 30s of no strokes, a "Done rowing?" prompt appears.
 * D-10: No pause state — if user rows again while prompt is showing, it is dismissed automatically.
 * D-13: Debrief fires immediately when user confirms Done rowing.
 * D-14: Debrief highlights 3-4 key stats in ~30 seconds.
 * D-15: Debrief is LLM-generated and personalized.
 * POST-02: Session data saved to Supabase sessions table.
 * POST-03: Coach memory KV pairs written to coach_memory table after debrief.
 *
 * PITFALL 5 (RESEARCH.md): confirmEnd() must NOT call endSession() directly.
 * Instead, transitions to 'debriefing', then completeSession() resets to idle after done.
 */
export function useSessionLifecycle() {
  const latestReading = useSessionStore((s) => s.latestReading);
  const isSessionActive = useSessionStore((s) => s.isSessionActive);
  const sessionPhase = useSessionStore((s) => s.sessionPhase);
  const sessionStartedAt = useSessionStore((s) => s.sessionStartedAt);
  const startSession = useSessionStore((s) => s.startSession);
  const endSession = useSessionStore((s) => s.endSession);
  const setSessionPhase = useSessionStore((s) => s.setSessionPhase);

  // Track when the last stroke occurred so we can detect 30s of inactivity (D-09).
  const lastStrokeAt = useRef<number | null>(null);

  // Whether the end prompt is currently showing.
  const [showEndPrompt, setShowEndPrompt] = useState(false);

  // Process each new reading for D-08 auto-start and idle tracking.
  useEffect(() => {
    if (!latestReading) return;

    const { strokeState } = latestReading;

    if (strokeState > 0) {
      // Active stroke detected — update last stroke timestamp.
      lastStrokeAt.current = Date.now();

      // D-08: Auto-start the session on first non-idle stroke.
      if (!isSessionActive) {
        startSession();
      }

      // D-10: If the end prompt is showing and user starts rowing again, dismiss it.
      if (sessionPhase === 'ending') {
        setSessionPhase('active');
        setShowEndPrompt(false);
      }
    }
  }, [latestReading, isSessionActive, sessionPhase, startSession, setSessionPhase]);

  // D-09: Poll every 5s — if 30s have passed with no strokes, trigger the end prompt.
  // Read sessionPhase fresh from the store inside the callback to avoid stale closures;
  // the interval no longer needs sessionPhase as a dependency, so it is not torn down
  // and restarted on every phase change.
  useEffect(() => {
    if (!isSessionActive) return;

    const idleCheckInterval = setInterval(() => {
      if (lastStrokeAt.current === null) return;

      const idleMs = Date.now() - lastStrokeAt.current;
      // Read phase fresh from store rather than from stale closure
      const currentPhase = useSessionStore.getState().sessionPhase;
      // Only trigger end prompt during active rowing — not during debriefing
      if (idleMs >= 30000 && currentPhase === 'active') {
        setSessionPhase('ending');
        setShowEndPrompt(true);
      }
    }, 5000);

    return () => clearInterval(idleCheckInterval);
  }, [isSessionActive, setSessionPhase]);

  // Keep showEndPrompt in sync with sessionPhase (e.g., external state changes).
  useEffect(() => {
    if (sessionPhase !== 'ending') {
      setShowEndPrompt(false);
    }
  }, [sessionPhase]);

  /**
   * User confirms they are done rowing.
   * Per D-13/PITFALL 5: transitions to 'debriefing', triggers debrief LLM+TTS,
   * parses coach memory from response, and fires Supabase writes.
   * Does NOT call endSession() — that is deferred to completeSession().
   */
  const confirmEnd = () => {
    setShowEndPrompt(false);

    // Compute session summary from accumulated averages (true session avgs, not sliding window)
    const avgs = strokeProcessor.getAccumulatedAvgs();
    const now = Date.now();
    const startedAt = sessionStartedAt ?? now;
    const durationS = Math.round((now - startedAt) / 1000);
    const totalMeters = useSessionStore.getState().latestReading?.distanceMeters ?? 0;

    // Transition to debriefing phase (PITFALL 5: do NOT call endSession here)
    setSessionPhase('debriefing');

    // Update coaching store with debrief state + session summary
    const coachingStore = useCoachingStore.getState();
    coachingStore.startDebrief();
    coachingStore.setSessionSummary({
      durationS,
      totalMeters,
      avgSplitMs: avgs.avgSplitMs,
      avgWatts: avgs.avgWatts,
      avgStrokeRate: avgs.avgStrokeRate,
    });

    // Fire debrief flow asynchronously
    void runDebriefFlow({
      startedAt,
      endedAt: now,
      durationS,
      totalMeters,
      avgs,
    });
  };

  /**
   * Runs the full debrief: LLM streaming → TTS → coach memory parse → Supabase writes.
   * Fire-and-forget from confirmEnd(). Errors are caught silently where appropriate.
   */
  async function runDebriefFlow(params: {
    startedAt: number;
    endedAt: number;
    durationS: number;
    totalMeters: number;
    avgs: ReturnType<typeof strokeProcessor.getAccumulatedAvgs>;
  }) {
    const { startedAt, endedAt, totalMeters, avgs } = params;
    const coachingStore = useCoachingStore.getState();

    // Snapshot coaching state for Supabase write before any resets
    const energyLevel = coachingStore.energyLevel;
    const sessionType = coachingStore.suggestedSessionType;

    let fullDebriefText = '';

    try {
      // Step 1: Fetch debrief from /api/coach with intent 'debrief'
      const response = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: 'debrief',
          sessionContext: {
            sessionSummary: {
              durationS: params.durationS,
              totalMeters,
              avgSplitMs: avgs.avgSplitMs,
              avgWatts: avgs.avgWatts,
              avgStrokeRate: avgs.avgStrokeRate,
            },
          },
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Debrief API failed: ${response.status}`);
      }

      // Step 2: Stream and buffer the full SSE response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let sseBuffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        sseBuffer += decoder.decode(value, { stream: true });
        const lines = sseBuffer.split('\n');
        sseBuffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const payload = line.slice(6).trim();
          if (!payload || payload === '[DONE]') continue;

          try {
            const parsed = JSON.parse(payload) as { type?: string; text?: string };
            if (parsed.type === 'text' && parsed.text) {
              fullDebriefText += parsed.text;
            }
          } catch {
            // Malformed SSE line — skip
          }
        }
      }

      // Step 3: Split on ---COACH_MEMORY--- separator
      const SEPARATOR = '---COACH_MEMORY---';
      const separatorIdx = fullDebriefText.indexOf(SEPARATOR);
      const spokenText =
        separatorIdx >= 0
          ? fullDebriefText.slice(0, separatorIdx).trim()
          : fullDebriefText.trim();
      const memoryJson =
        separatorIdx >= 0 ? fullDebriefText.slice(separatorIdx + SEPARATOR.length).trim() : null;

      // Step 4: Send ONLY the spoken debrief text to TTS
      if (spokenText) {
        const ttsResponse = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: spokenText }),
        });

        if (ttsResponse.ok && ttsResponse.body) {
          const ttsReader = ttsResponse.body.getReader();
          const ttsDecoder = new TextDecoder();
          let ttsBuffer = '';

          while (true) {
            const { done, value } = await ttsReader.read();
            if (done) break;

            ttsBuffer += ttsDecoder.decode(value, { stream: true });
            const lines = ttsBuffer.split('\n');
            ttsBuffer = lines.pop() ?? '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const payload = line.slice(6).trim();
              if (!payload || payload === '[DONE]') continue;

              try {
                const parsed = JSON.parse(payload) as {
                  type?: string;
                  data?: string;
                  done?: boolean;
                };
                if (parsed.type === 'chunk' && parsed.data) {
                  await audioQueue.playChunk(parsed.data, 24000);
                }
              } catch {
                // Malformed TTS SSE line — skip
              }
            }
          }
        }

        // Wait for scheduled audio to finish playing
        // audioQueue.scheduledEndTime is internal; we wait via a small poll
        await waitForAudioToFinish();
      }

      // Step 5: Mark debrief complete with spoken text
      useCoachingStore.getState().completeDebrief(spokenText);

      // Step 6: Fire-and-forget Supabase writes
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Write session data
        void writeSession({
          userId: user.id,
          startedAt,
          endedAt,
          totalMeters,
          avgSplitMs: avgs.avgSplitMs,
          avgWatts: avgs.avgWatts,
          avgStrokeRate: avgs.avgStrokeRate,
          energyLevel: energyLevel ?? null,
          sessionType: sessionType ?? null,
        });

        // Parse and write coach memory (skip silently on parse failure)
        if (memoryJson) {
          try {
            const entries = JSON.parse(memoryJson) as CoachMemoryEntry[];
            if (Array.isArray(entries) && entries.length > 0) {
              void writeCoachMemory(user.id, entries);
            }
          } catch {
            // JSON parse failure — skip silently (T-02-15: acceptable)
          }
        }
      }
    } catch (err) {
      // Debrief failed — still show summary card with available stats (T-02-16 acceptance)
      console.error('[useSessionLifecycle] debrief flow error:', err);
      useCoachingStore.getState().completeDebrief('');
    }
  }

  /**
   * Poll until AudioContext has finished playing all scheduled audio.
   * Uses a small interval check — max wait 60s to prevent infinite hang.
   */
  function waitForAudioToFinish(): Promise<void> {
    return new Promise((resolve) => {
      const start = Date.now();
      const check = setInterval(() => {
        // Access AudioQueue internals via the store speaking indicator
        const isSpeaking = useCoachingStore.getState().isSpeaking;
        const elapsed = Date.now() - start;
        if (!isSpeaking || elapsed > 60000) {
          clearInterval(check);
          resolve();
        }
      }, 250);
    });
  }

  /** User dismisses the end prompt and continues their session. */
  const dismissEnd = () => {
    setShowEndPrompt(false);
    setSessionPhase('active');
    // Reset the idle clock so we don't immediately re-trigger.
    lastStrokeAt.current = Date.now();
  };

  /**
   * Complete the session after user taps "Done" on the summary card.
   * Stops audio, resets session store, coaching store, stroke processor, and cue router.
   * Called by session/page.tsx handleDone before navigating to /checkin.
   */
  const completeSession = () => {
    audioQueue.stopAll();
    endSession();
    useCoachingStore.getState().resetCoachingState();
    strokeProcessor.reset();
    cueRouter.reset();
  };

  return { showEndPrompt, confirmEnd, dismissEnd, completeSession };
}
