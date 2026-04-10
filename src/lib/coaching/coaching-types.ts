import type { StrokeReading } from '../ble/pm5-parser';

// Suppress unused import warning — StrokeReading is referenced in JSDoc and used by consumers
// of this module for context building.
export type { StrokeReading };

export enum CuePriority {
  NORMAL = 0,
  HIGH = 1,
}

export interface CoachingTrigger {
  type: string; // template key e.g. 'split_drift_up', 'rate_too_high'
  priority: CuePriority;
  context: CueContext;
  timestamp: number;
}

export interface CueContext {
  userName: string;
  currentSplitStr: string; // formatted e.g. "2:12"
  currentRate: number;
  targetRate?: number;
  elapsedMin: number;
  distanceM: number;
}

export interface AudioCue {
  id: string;
  text: string;
  priority: CuePriority;
  triggerType: string;
}

export interface SessionWritePayload {
  userId: string;
  startedAt: number;
  endedAt: number;
  totalMeters: number;
  avgSplitMs: number | null;
  avgWatts: number | null;
  avgStrokeRate: number | null;
  energyLevel: number | null;
  sessionType: string | null;
}

export interface CoachMemoryEntry {
  key: string;
  value: string;
}

export type EnergyLevel = 1 | 2 | 3 | 4 | 5;
export type TimeAvailable = 15 | 20 | 30 | 45;

// Extend SessionPhase to include 'debriefing' for Phase 2
// Per RESEARCH.md Pitfall 5: confirmEnd() must NOT call endSession() directly;
// instead transition to 'debriefing' first, then 'idle' after debrief + write complete.
export type SessionPhaseExtended = 'idle' | 'active' | 'ending' | 'debriefing';
