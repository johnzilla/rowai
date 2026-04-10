'use client';

import { useCoachingStore } from '@/lib/coaching/coaching-store';

interface SessionSummaryCardProps {
  onDone: () => void;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** Format seconds into MM:SS display string. */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/** Format split in milliseconds to M:SS /500m display. Returns '--:--' if null. */
function formatSplit(splitMs: number | null): string {
  if (splitMs === null) return '--:--';
  const totalSecs = Math.round(splitMs / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** Format distance in meters with comma separator and 'm' suffix. */
function formatDistance(meters: number): string {
  return `${meters.toLocaleString()}m`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * SessionSummaryCard — shown after the voice debrief completes.
 *
 * D-16: Shows duration, distance, avg split, avg watts, avg stroke rate.
 * Props: onDone — called when user taps "Done" to return to check-in.
 *
 * Reads sessionSummary and debriefText from coaching store.
 */
export function SessionSummaryCard({ onDone }: SessionSummaryCardProps) {
  const sessionSummary = useCoachingStore((s) => s.sessionSummary);
  const debriefText = useCoachingStore((s) => s.debriefText);

  const durationDisplay = sessionSummary ? formatDuration(sessionSummary.durationS) : '--:--';
  const distanceDisplay = sessionSummary ? formatDistance(sessionSummary.totalMeters) : '--';
  const splitDisplay = sessionSummary ? formatSplit(sessionSummary.avgSplitMs) : '--:--';
  const wattsDisplay =
    sessionSummary?.avgWatts != null ? `${sessionSummary.avgWatts}w` : '--';
  const rateDisplay =
    sessionSummary?.avgStrokeRate != null ? `${sessionSummary.avgStrokeRate} spm` : '--';

  return (
    <div className="fixed inset-0 flex items-end justify-center pb-16 px-6 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" />

      {/* Summary card */}
      <div className="relative bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6 flex flex-col gap-5">
        {/* Title */}
        <p className="text-white text-xl font-semibold text-center">Session Complete</p>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatBlock label="Duration" value={durationDisplay} />
          <StatBlock label="Distance" value={distanceDisplay} />
          <StatBlock label="Avg Split" value={`${splitDisplay}/500m`} />
          <StatBlock label="Avg Watts" value={wattsDisplay} />
          <StatBlock label="Avg Rate" value={rateDisplay} fullWidth />
        </div>

        {/* Coach debrief excerpt */}
        {debriefText && (
          <p className="text-gray-400 text-sm italic text-center leading-relaxed">
            &ldquo;{debriefText}&rdquo;
          </p>
        )}

        {/* Done button */}
        <button
          onClick={onDone}
          className="w-full py-3 rounded-xl bg-white text-black font-semibold text-base"
        >
          Done
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-component
// ---------------------------------------------------------------------------

interface StatBlockProps {
  label: string;
  value: string;
  fullWidth?: boolean;
}

function StatBlock({ label, value, fullWidth }: StatBlockProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center bg-gray-800 rounded-xl py-3 px-2${fullWidth ? ' col-span-2' : ''}`}
    >
      <span className="text-gray-400 text-xs uppercase tracking-wide">{label}</span>
      <span className="text-white text-lg font-semibold mt-1">{value}</span>
    </div>
  );
}
