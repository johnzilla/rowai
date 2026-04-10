'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { pm5Service, setupStoreListeners } from '@/lib/ble/pm5-service';
import { wakeLockManager } from '@/lib/wake-lock/wake-lock-manager';
import { useSessionStore } from '@/lib/session/session-store';
import { useSessionLifecycle } from '@/hooks/useSessionLifecycle';
import { BleConnectButton } from '@/components/ble/BleConnectButton';
import { MetricDisplay } from '@/components/metrics/MetricDisplay';
import { SessionEndPrompt } from '@/components/session/SessionEndPrompt';

/**
 * Session page — the core Phase 1 user-facing experience.
 *
 * Assembles:
 *  - BLE connect UX (BleConnectButton — rationale → device chooser → status)
 *  - Live metric display (MetricDisplay — split/SPM/watts/distance)
 *  - Session lifecycle (useSessionLifecycle — auto-start D-08, auto-end D-09, D-10)
 *  - Wake Lock (prevents screen sleep per BLE-03)
 *  - Auth guard (belt-and-suspenders; middleware also protects /session)
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

  const { showEndPrompt, confirmEnd, dismissEnd } = useSessionLifecycle();

  // Track that bindVisibilityChange has been called at most once per mount.
  const visibilityBound = useRef(false);
  // Track that setupStoreListeners has been called once.
  const listenersSetup = useRef(false);

  // Belt-and-suspenders auth guard (T-03-04 mitigation — double protection).
  // Middleware handles this for server-rendered routes; page-level guard covers edge cases.
  useEffect(() => {
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
    };

    pm5Service.addEventListener('connected', handleConnected);

    return () => {
      pm5Service.removeEventListener('connected', handleConnected);
    };
  }, []);

  // Cleanup on unmount — disconnect BLE and release Wake Lock.
  useEffect(() => {
    return () => {
      pm5Service.disconnect();
      wakeLockManager.release();
    };
  }, []);

  const isConnected = bleStatus === 'connected';
  const isActive = bleStatus === 'connected' || bleStatus === 'reconnecting';

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
        {isActive ? (
          /* Metric display — shown once BLE is connected or reconnecting */
          <MetricDisplay reading={latestReading} sessionStartedAt={sessionStartedAt} />
        ) : (
          /* Rationale / connecting state — BleConnectButton renders the full rationale card */
          <div className="flex flex-col flex-1 items-center justify-center">
            {!isConnected && bleStatus !== 'disconnected' && null}
          </div>
        )}
      </div>

      {/* Session end confirmation overlay */}
      {showEndPrompt && (
        <SessionEndPrompt onConfirm={confirmEnd} onDismiss={dismissEnd} />
      )}
    </main>
  );
}
