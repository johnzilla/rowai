'use client';

import { useEffect, useState } from 'react';
import type { StrokeReading } from '@/lib/ble/pm5-parser';

interface MetricDisplayProps {
  reading: StrokeReading | null;
  sessionStartedAt: number | null;
  bleStatus?: 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
}

/**
 * Format milliseconds as M:SS.
 * Used for both split time and elapsed time.
 */
function formatMSS(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * MetricDisplay — renders live rowing metrics from a PM5 StrokeReading.
 *
 * Layout per D-01, D-02, D-03:
 * - Top bar (D-03): elapsed time (left), total distance (right) — progress indicators
 * - Center large (D-01, D-02): split time per 500m — very large, high-contrast, glanceable
 * - Secondary row (D-02): SPM and watts — smaller, labeled, below the primary metric
 *
 * When no reading is available, dashes are shown as placeholders.
 */
export function MetricDisplay({ reading, sessionStartedAt, bleStatus }: MetricDisplayProps) {
  // Timer fallback (BLE-04): keep elapsed time updating even when BLE is disconnected.
  // Without this, the component stops re-rendering when no new readings arrive.
  const [now, setNow] = useState(Date.now());
  const isReconnecting = bleStatus === 'reconnecting';

  useEffect(() => {
    if (sessionStartedAt === null) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [sessionStartedAt]);

  const elapsedMs = sessionStartedAt !== null ? now - sessionStartedAt : reading?.elapsedTimeMs ?? null;

  const splitDisplay = isReconnecting ? '--:--' : (reading ? formatMSS(reading.splitMs) : '--:--');
  const elapsedDisplay = elapsedMs !== null ? formatMSS(elapsedMs) : '--:--';
  const distanceDisplay = reading ? `${reading.distanceMeters}m` : '--';
  const spmDisplay = isReconnecting ? '--' : (reading ? reading.strokeRate.toString() : '--');
  const wattsDisplay = isReconnecting ? '--' : (reading ? reading.watts.toString() : '--');

  return (
    <div className="flex flex-col flex-1 px-6 py-4 gap-4">
      {/* D-03: Top progress indicators — elapsed time and total distance */}
      <div className="flex justify-between items-center text-sm text-gray-400">
        <span>
          {elapsedDisplay}
          {isReconnecting && <span className="ml-2 text-yellow-500 text-xs">(timer only)</span>}
        </span>
        <span>{distanceDisplay}</span>
      </div>

      {/* D-01, D-02: Primary metric — split time, large and centered */}
      <div className="flex flex-col items-center justify-center flex-1 gap-2">
        <div className="text-8xl font-bold text-white tracking-tight tabular-nums">
          {splitDisplay}
        </div>
        <div className="text-gray-500 text-sm tracking-widest uppercase">/500m</div>

        {/* D-02: Secondary metrics row — SPM and watts */}
        <div className="flex gap-12 mt-8">
          <div className="flex flex-col items-center gap-1">
            <span className="text-3xl font-semibold text-gray-200 tabular-nums">{spmDisplay}</span>
            <span className="text-xs text-gray-500 uppercase tracking-widest">SPM</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-3xl font-semibold text-gray-200 tabular-nums">{wattsDisplay}</span>
            <span className="text-xs text-gray-500 uppercase tracking-widest">W</span>
          </div>
        </div>
      </div>
    </div>
  );
}
