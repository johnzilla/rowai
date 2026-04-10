'use client';

import { useEffect, useRef } from 'react';
import { useSessionStore } from '@/lib/session/session-store';
import { useCoachingStore } from '@/lib/coaching/coaching-store';
import { strokeProcessor } from '@/lib/coaching/stroke-processor';
import { cueRouter } from '@/lib/coaching/cue-router';
import { audioQueue } from '@/lib/coaching/audio-queue';

/**
 * useCoachingSession — wires the coaching pipeline to the session lifecycle.
 *
 * Responsibilities:
 *   1. On each new StrokeReading: call strokeProcessor.processReading() → cueRouter.route()
 *   2. On session start (isSessionActive becomes true):
 *      - Reset processor and router (RESEARCH.md Pitfall 3)
 *      - ensureRunning() the AudioQueue
 *      - Set targets from coaching store (check-in session type)
 *      - Fire session_start_cue via cueRouter
 *   3. On session end: do NOT call endSession() — Plan 04 handles debrief transition
 *
 * Must NOT block the React render cycle — stroke processing is synchronous and fast (<1ms).
 */
export function useCoachingSession(): { isCoachingActive: boolean } {
  const latestReading = useSessionStore((s) => s.latestReading);
  const isSessionActive = useSessionStore((s) => s.isSessionActive);

  // Track previous isSessionActive to detect transition to true
  const wasSessionActive = useRef(false);

  // ---------------------------------------------------------------------------
  // Session start: reset pipeline, set targets, fire start cue
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (isSessionActive && !wasSessionActive.current) {
      wasSessionActive.current = true;

      // RESEARCH.md Pitfall 3: reset window and cooldowns from previous session
      strokeProcessor.reset();
      cueRouter.reset();

      // Resume AudioContext if suspended (e.g. after backgrounding)
      void audioQueue.ensureRunning();

      // Set targets from check-in data
      const { energyLevel, timeAvailableMin } = useCoachingStore.getState();

      // Map energy + time to rough target stroke rate and distance
      // energyLevel 1-5 maps to rates 18-26 spm (rough guide)
      const targetRate = energyLevel ? 14 + energyLevel * 2 : undefined;
      // timeAvailableMin → distance in meters (rough: 1 min ≈ 200m at moderate pace)
      const targetDistance = timeAvailableMin ? timeAvailableMin * 200 : undefined;

      strokeProcessor.setTargets(targetRate, targetDistance);

      // Fire session start cue via router (if template exists for 'session_start')
      cueRouter.route({
        type: 'session_start',
        priority: 0, // CuePriority.NORMAL
        context: {
          userName: 'Rower',
          currentSplitStr: '0:00',
          currentRate: 0,
          targetRate,
          elapsedMin: 0,
          distanceM: 0,
        },
        timestamp: Date.now(),
      });
    }

    if (!isSessionActive) {
      wasSessionActive.current = false;
    }
  }, [isSessionActive]);

  // ---------------------------------------------------------------------------
  // Per-stroke: process reading and route any trigger
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!latestReading || !isSessionActive) return;

    // Synchronous, <1ms — does not block render
    const trigger = strokeProcessor.processReading(latestReading);
    if (trigger) {
      cueRouter.route(trigger);
    }
  }, [latestReading, isSessionActive]);

  return { isCoachingActive: isSessionActive };
}
