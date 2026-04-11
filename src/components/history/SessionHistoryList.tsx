'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SessionRow {
  id: string;
  started_at: string;
  duration_s: number;
  total_meters: number;
  avg_split_ms: number | null;
  avg_watts: number | null;
  avg_stroke_rate: number | null;
  session_type: string | null;
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/** Format seconds into MM:SS display string. */
function formatDuration(s: number): string {
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/** Format split in milliseconds to M:SS. Returns '--:--' if null. */
function formatSplit(ms: number | null): string {
  if (ms === null) return '--:--';
  const totalSecs = Math.round(ms / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/** Format date from ISO string to "Mon DD" (e.g. "Apr 08"). */
function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Skeleton card
// ---------------------------------------------------------------------------

function SkeletonCard() {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 animate-pulse">
      <div className="h-4 bg-gray-800 rounded w-16 mb-3" />
      <div className="flex gap-4">
        <div className="h-3 bg-gray-800 rounded w-14" />
        <div className="h-3 bg-gray-800 rounded w-14" />
        <div className="h-3 bg-gray-800 rounded w-14" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Session card
// ---------------------------------------------------------------------------

interface SessionCardProps {
  session: SessionRow;
}

function SessionCard({ session }: SessionCardProps) {
  const dateLabel = formatDate(session.started_at);
  const duration = formatDuration(session.duration_s);
  const distance = `${session.total_meters.toLocaleString()}m`;
  const split = `${formatSplit(session.avg_split_ms)}/500m`;
  const watts = session.avg_watts != null ? `${session.avg_watts}w` : '--';
  const rate = session.avg_stroke_rate != null ? `${session.avg_stroke_rate} spm` : '--';

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4">
      {/* Header row */}
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-white text-base font-semibold">{dateLabel}</span>
        {session.session_type && (
          <span className="text-gray-500 text-xs uppercase tracking-wide">
            {session.session_type}
          </span>
        )}
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <StatItem label="Duration" value={duration} />
        <StatItem label="Distance" value={distance} />
        <StatItem label="Split" value={split} />
        <StatItem label="Watts" value={watts} />
        <StatItem label="Rate" value={rate} />
      </div>
    </div>
  );
}

interface StatItemProps {
  label: string;
  value: string;
}

function StatItem({ label, value }: StatItemProps) {
  return (
    <div className="flex flex-col items-start">
      <span className="text-gray-500 text-xs">{label}</span>
      <span className="text-gray-300 text-sm font-medium">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/**
 * SessionHistoryList — fetches and displays all past sessions sorted by date desc.
 *
 * RLS on the sessions table ensures users only see their own sessions.
 * D-04, D-05: Shows date, duration, distance, avg split, avg watts, avg stroke rate.
 */
export function SessionHistoryList() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSessions = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const { data, error: dbError } = await supabase
          .from('sessions')
          .select(
            'id, started_at, duration_s, total_meters, avg_split_ms, avg_watts, avg_stroke_rate, session_type',
          )
          .order('started_at', { ascending: false });

        if (dbError) {
          setError('Could not load sessions. Please try again.');
          setIsLoading(false);
          return;
        }

        setSessions((data as SessionRow[]) ?? []);
        setIsLoading(false);
      } catch {
        setError('Could not load sessions. Please try again.');
        setIsLoading(false);
      }
    };

    void fetchSessions();
  }, []);

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-gray-400 text-sm text-center">{error}</p>
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-gray-400 text-sm text-center">
          No sessions yet. Complete your first row to see it here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {sessions.map((session) => (
        <SessionCard key={session.id} session={session} />
      ))}
    </div>
  );
}
