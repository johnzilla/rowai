'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { pm5Service, setupStoreListeners } from '@/lib/ble/pm5-service';
import { wakeLockManager } from '@/lib/wake-lock/wake-lock-manager';
import { useSessionStore } from '@/lib/session/session-store';
import { useCoachingStore } from '@/lib/coaching/coaching-store';
import { useSessionLifecycle } from '@/hooks/useSessionLifecycle';
import { BleConnectButton } from '@/components/ble/BleConnectButton';
import { MetricDisplay } from '@/components/metrics/MetricDisplay';
import { SessionEndPrompt } from '@/components/session/SessionEndPrompt';
import { SessionSummaryCard } from '@/components/session/SessionSummaryCard';
import { CoachingIndicator } from '@/components/coaching/CoachingIndicator';
import { MidSessionControls } from '@/components/coaching/MidSessionControls';
import { useCoachingSession } from '@/hooks/useCoachingSession';
import { audioQueue } from '@/lib/coaching/audio-queue';

/**
 * Session page — the core Phase 2 user-facing experience.
 *
 * Assembles:
 *  - BLE connect UX (BleConnectButton — rationale → device chooser → status)
 *  - Live metric display (MetricDisplay — split/SPM/watts/distance)
 *  - Session lifecycle (useSessionLifecycle — auto-start D-08, auto-end D-09, D-10)
 *  - Post-session debrief (D-13, D-14, D-15) + summary card (D-16)
 *  - Wake Lock (prevents screen sleep per BLE-03)
 *  - Auth guard (belt-and-suspenders; middleware also protects /session)
 *
 * Session flow states:
 *  - sessionPhase 'idle'      → BleConnectButton rationale shown
 *  - sessionPhase 'active'    → MetricDisplay + CoachingIndicator + MidSessionControls
 *  - sessionPhase 'ending'    → SessionEndPrompt overlay
 *  - sessionPhase 'debriefing'→ MetricDisplay + CoachingIndicator (debrief audio)
 *                               + SessionSummaryCard (when debriefComplete)
 *
 * Event wiring:
 *  - pm5Service 'connected' → wakeLockManager.acquire() + bindVisibilityChange()
 *  - pm5Service CustomEvents → Zustand store (via setupStoreListeners)
 *  - Unmount cleanup: pm5Service.disconnect() + wakeLockManager.release()
 */
export default function SessionPage() {
  const router = useRouter();
  const bleStatus = useSessionStore((s) => s.bleStatus);
  const latestReading = useSessionStore((s) => s.latestReading);
  const sessionStartedAt = useSessionStore((s) => s.sessionStartedAt);
  const sessionPhase = useSessionStore((s) => s.sessionPhase);

  const debriefComplete = useCoachingStore((s) => s.debriefComplete);

  const { showEndPrompt, confirmEnd, dismissEnd, completeSession } = useSessionLifecycle();
  useCoachingSession();

  // Track that bindVisibilityChange has been called at most once per mount.
  const visibilityBound = useRef(false);
  // Track that setupStoreListeners has been called once.
  const listenersSetup = useRef(false);

  // Belt-and-suspenders auth guard (T-03-04 mitigation — double protection).
  // Skipped in development (solo builder — no auth friction for local testing)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') return;
    const checkAuth = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        router.replace('/login');
      }
    };
    void checkAuth();
  }, [router]);

  // Wire BLE events to Zustand store — one time on mount.
  useEffect(() => {
    if (listenersSetup.current) return;
    listenersSetup.current = true;
    setupStoreListeners(pm5Service, useSessionStore.getState());
  }, []);

  // Wire Wake Lock to the pm5Service 'connected' event.
  // Acquire once on connect; re-acquire on visibility restore via bindVisibilityChange.
  useEffect(() => {
    const handleConnected = async () => {
      await wakeLockManager.acquire();
      if (!visibilityBound.current) {
        wakeLockManager.bindVisibilityChange();
        visibilityBound.current = true;
      }
      // Resume AudioContext if suspended after backgrounding (RESEARCH.md Pitfall 2)
      try {
        await audioQueue.ensureRunning();
      } catch {
        // AudioQueue may not be initialized yet if user came from /session directly
        // (bypassing check-in). initialize() will be called on first user gesture.
      }
    };

    pm5Service.addEventListener('connected', handleConnected);

    return () => {
      pm5Service.removeEventListener('connected', handleConnected);
    };
  }, []);

  // Cleanup on unmount — disconnect BLE, release Wake Lock, and remove visibility listener.
  useEffect(() => {
    return () => {
      pm5Service.disconnect();
      wakeLockManager.release();
      wakeLockManager.unbindVisibilityChange();
    };
  }, []);

  /**
   * handleDone — called when user taps "Done" on the summary card.
   * Cleans up all session state and navigates back to check-in.
   * Per D-16: "Done button on summary card returns to check-in screen."
   */
  const handleDone = () => {
    completeSession();
    router.push('/checkin');
  };

  const isConnected = bleStatus === 'connected';
  const isActive = bleStatus === 'connected' || bleStatus === 'reconnecting';

  // During debriefing, keep metrics visible (D-13: debrief speaks over existing metrics screen)
  const isDebriefPhase = sessionPhase === 'debriefing';

  return (
    <main className="min-h-screen bg-black text-white flex flex-col">
      {/* BLE status banner — always visible so user knows sensor state */}
      <header className="px-4 pt-safe-top">
        <div className="py-3 border-b border-gray-800">
          <BleConnectButton />
        </div>
      </header>

      {/* Main content area */}
      <div className="flex flex-col flex-1">
        {isActive || isDebriefPhase ? (
          /* Coaching indicator + metric display (visible during active + debriefing phases) */
          <>
            <CoachingIndicator />
            <MetricDisplay
              reading={latestReading}
              sessionStartedAt={sessionStartedAt}
              bleStatus={bleStatus === 'failed' ? 'disconnected' : bleStatus}
            />
            {/* Mid-session controls hidden during debriefing (debrief is automated) */}
            {sessionPhase === 'active' && <MidSessionControls />}
          </>
        ) : (
          /* Rationale / connecting state — BleConnectButton renders the full rationale card */
          <div className="flex flex-col flex-1 items-center justify-center">
            {!isConnected && bleStatus !== 'disconnected' && null}
          </div>
        )}
      </div>

      {/* Session end confirmation overlay (shown during 'ending' phase) */}
      {showEndPrompt && (
        <SessionEndPrompt onConfirm={confirmEnd} onDismiss={dismissEnd} />
      )}

      {/* Session summary card overlay (shown after debrief completes) */}
      {isDebriefPhase && debriefComplete && (
        <SessionSummaryCard onDone={handleDone} />
      )}

    </main>
  );
}
