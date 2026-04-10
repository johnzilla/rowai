'use client';

import { useState } from 'react';
import { useSessionStore } from '@/lib/session/session-store';
import { pm5Service } from '@/lib/ble/pm5-service';

/**
 * BleConnectButton — shows the rationale screen before requesting BLE access,
 * then displays plain-text connection status once paired.
 *
 * D-06: Rationale screen shown BEFORE calling requestDevice — reduces permission denial.
 * D-07: Status is simple text only. No animated spinners, pulsing indicators, or icons
 *       beyond the single checkmark on the connected state.
 *
 * Wake Lock wiring is handled exclusively in session/page.tsx.
 * This component does NOT call wakeLockManager.
 */
export function BleConnectButton() {
  const bleStatus = useSessionStore((s) => s.bleStatus);
  const setBleStatus = useSessionStore((s) => s.setBleStatus);
  const [connectError, setConnectError] = useState<string | null>(null);

  const handleConnect = async () => {
    setConnectError(null);
    setBleStatus('connecting');
    try {
      await pm5Service.connect();
    } catch (err) {
      // Reset status on error so the rationale screen reappears.
      setBleStatus('disconnected');

      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setConnectError(
          'Bluetooth permission denied. Enable Bluetooth in Android Settings to use RowAI.'
        );
      } else if (err instanceof DOMException && err.name === 'NotFoundError') {
        // User cancelled the device chooser — silent reset.
        setConnectError(null);
      } else {
        setConnectError('Could not connect to PM5. Make sure it is powered on and nearby.');
      }
    }
  };

  // D-06: Rationale screen — shown when disconnected (before first pair or after failed reconnect reset).
  if (bleStatus === 'disconnected') {
    return (
      <div className="flex flex-col items-center justify-center flex-1 px-8 text-center gap-6">
        <div className="max-w-sm">
          <p className="text-gray-300 text-lg leading-relaxed">
            RowAI reads your PM5 data in real time over Bluetooth — this is what makes coaching
            real.
          </p>
        </div>

        {connectError && (
          <p className="text-red-400 text-sm max-w-sm">{connectError}</p>
        )}

        <button
          onClick={handleConnect}
          className="bg-white text-black font-semibold px-8 py-3 rounded-full text-lg"
        >
          Connect PM5
        </button>
      </div>
    );
  }

  // D-07: Simple status text — no animation, no spinners.
  const statusText = (() => {
    switch (bleStatus) {
      case 'connecting':
        return <span className="text-gray-400">Connecting...</span>;
      case 'connected':
        return <span className="text-green-400">Connected to PM5 ✓</span>;
      case 'reconnecting':
        return <span className="text-yellow-400">Connection lost — reconnecting...</span>;
      case 'failed':
        return (
          <button
            onClick={handleConnect}
            className="text-red-400 underline"
          >
            Unable to reconnect. Tap to try again.
          </button>
        );
      default:
        return null;
    }
  })();

  return (
    <div className="text-sm px-4 py-2">
      {statusText}
    </div>
  );
}
