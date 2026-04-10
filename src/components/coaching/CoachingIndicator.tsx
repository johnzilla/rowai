'use client';

import { useCoachingStore } from '@/lib/coaching/coaching-store';

/**
 * CoachingIndicator — subtle visual indicator when coach is speaking (D-08).
 *
 * Renders a thin pulsing colored bar at the top of the metrics area.
 * Returns null when isSpeaking is false — does not disrupt metrics layout.
 * Height is fixed so layout does not shift on show/hide.
 */
export function CoachingIndicator() {
  const isSpeaking = useCoachingStore((s) => s.isSpeaking);

  if (!isSpeaking) {
    return <div className="h-[3px] w-full" aria-hidden="true" />;
  }

  return (
    <div
      className="h-[3px] w-full bg-blue-500 animate-pulse rounded-full"
      role="status"
      aria-label="Coach is speaking"
    />
  );
}
