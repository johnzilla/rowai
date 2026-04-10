'use client';

import { useEffect, useRef, useState } from 'react';
import { useSessionStore } from '@/lib/session/session-store';

/**
 * useSessionLifecycle — manages session auto-start and auto-end detection.
 *
 * D-08: Session auto-starts on first stroke (strokeState transitions from 0 to non-zero).
 * D-09: After 30s of no strokes, a "Done rowing?" prompt appears.
 * D-10: No pause state — if user rows again while prompt is showing, it is dismissed automatically.
 */
export function useSessionLifecycle() {
  const latestReading = useSessionStore((s) => s.latestReading);
  const isSessionActive = useSessionStore((s) => s.isSessionActive);
  const sessionPhase = useSessionStore((s) => s.sessionPhase);
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

  /** User confirms they are done rowing. */
  const confirmEnd = () => {
    setShowEndPrompt(false);
    endSession();
  };

  /** User dismisses the end prompt and continues their session. */
  const dismissEnd = () => {
    setShowEndPrompt(false);
    setSessionPhase('active');
    // Reset the idle clock so we don't immediately re-trigger.
    lastStrokeAt.current = Date.now();
  };

  return { showEndPrompt, confirmEnd, dismissEnd };
}
