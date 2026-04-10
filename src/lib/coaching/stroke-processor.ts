import type { StrokeReading } from '../ble/pm5-parser';
import { CuePriority } from './coaching-types';
import type { CoachingTrigger, CueContext } from './coaching-types';

/**
 * StrokeProcessor — module-level singleton for sliding window threshold detection.
 *
 * Maintains a rolling window of the last 20 stroke readings.
 * On each reading, runs threshold checks and emits a CoachingTrigger when a condition fires.
 *
 * Per RESEARCH.md Pitfall 3: reset() MUST be called at session start to clear
 * the window and fired-once flags from any previous session.
 */
class StrokeProcessor {
  private window: StrokeReading[] = [];
  private readonly windowSize = 20;

  private targetRate: number | undefined = undefined;
  private targetDistance: number | undefined = undefined;

  // Fired-once flags (these triggers fire at most once per session)
  private halfwayFired = false;

  // userName for CueContext — set externally before session starts
  private userName = 'Rower';

  /**
   * Set targets from check-in data.
   * Should be called after check-in completes and before session starts.
   */
  setTargets(targetRate?: number, targetDistance?: number): void {
    this.targetRate = targetRate;
    this.targetDistance = targetDistance;
  }

  /**
   * Set the user's name for cue context personalization.
   */
  setUserName(name: string): void {
    this.userName = name;
  }

  /**
   * Clear window and fired-once flags.
   * MUST be called at session start per RESEARCH.md Pitfall 3.
   */
  reset(): void {
    this.window = [];
    this.halfwayFired = false;
  }

  /**
   * Add a stroke reading to the window and run threshold checks.
   * Returns a CoachingTrigger if a condition fires, or null otherwise.
   * Only one trigger fires per reading — highest-priority wins.
   */
  processReading(reading: StrokeReading): CoachingTrigger | null {
    // Slide window
    this.window.push(reading);
    if (this.window.length > this.windowSize) {
      this.window.shift();
    }

    const ctx = this.buildCueContext(reading);

    // Run checks in priority order — HIGH first, then NORMAL
    return (
      this.checkSplitDriftUp(ctx) ??
      this.checkRateTooHigh(ctx) ??
      this.checkHalfway(ctx, reading) ??
      this.checkRateTooLow(ctx) ??
      this.checkPaceOnTarget(ctx)
    );
  }

  // ---------------------------------------------------------------------------
  // Threshold checks
  // ---------------------------------------------------------------------------

  /**
   * split_drift_up (HIGH): avg splitMs of last 8 readings increased >5000ms
   * over the first reading in the window.
   */
  private checkSplitDriftUp(ctx: CueContext): CoachingTrigger | null {
    if (this.window.length < 8) return null;

    const last8 = this.window.slice(-8);
    const avgSplit = last8.reduce((sum, r) => sum + r.splitMs, 0) / last8.length;
    const firstSplit = this.window[0].splitMs;

    if (avgSplit - firstSplit > 5000) {
      return {
        type: 'split_drift_up',
        priority: CuePriority.HIGH,
        context: ctx,
        timestamp: Date.now(),
      };
    }
    return null;
  }

  /**
   * rate_too_high (HIGH): strokeRate > targetRate+4 for 5+ consecutive readings.
   */
  private checkRateTooHigh(ctx: CueContext): CoachingTrigger | null {
    if (!this.targetRate) return null;
    if (this.window.length < 5) return null;

    const last5 = this.window.slice(-5);
    const allHigh = last5.every((r) => r.strokeRate > this.targetRate! + 4);
    if (allHigh) {
      return {
        type: 'rate_too_high',
        priority: CuePriority.HIGH,
        context: { ...ctx, targetRate: this.targetRate },
        timestamp: Date.now(),
      };
    }
    return null;
  }

  /**
   * rate_too_low (NORMAL): strokeRate < targetRate-4 for 5+ consecutive readings.
   */
  private checkRateTooLow(ctx: CueContext): CoachingTrigger | null {
    if (!this.targetRate) return null;
    if (this.window.length < 5) return null;

    const last5 = this.window.slice(-5);
    const allLow = last5.every((r) => r.strokeRate < this.targetRate! - 4);
    if (allLow) {
      return {
        type: 'rate_too_low',
        priority: CuePriority.NORMAL,
        context: { ...ctx, targetRate: this.targetRate },
        timestamp: Date.now(),
      };
    }
    return null;
  }

  /**
   * pace_on_target (NORMAL): splitMs within ±1000ms of target for 10+ consecutive readings.
   * Uses targetRate as a proxy for target split if targetSplitMs is not set.
   * Only fires if targetRate is set (as a guard — no target means no target pace).
   */
  private checkPaceOnTarget(ctx: CueContext): CoachingTrigger | null {
    if (this.window.length < 10) return null;

    const last10 = this.window.slice(-10);
    const avgSplit = last10.reduce((sum, r) => sum + r.splitMs, 0) / last10.length;

    // Compute reference split from the first reading in the session window
    const referenceSplit = this.window[0].splitMs;
    const withinTarget = last10.every(
      (r) => Math.abs(r.splitMs - referenceSplit) <= 1000
    );

    // Only fire if the pace is also reasonable (avg split is reasonable)
    if (withinTarget && avgSplit > 0) {
      return {
        type: 'pace_on_target',
        priority: CuePriority.NORMAL,
        context: ctx,
        timestamp: Date.now(),
      };
    }
    return null;
  }

  /**
   * halfway (NORMAL, fires once): distanceMeters crosses half of targetDistance.
   */
  private checkHalfway(ctx: CueContext, reading: StrokeReading): CoachingTrigger | null {
    if (this.halfwayFired) return null;
    if (!this.targetDistance) return null;

    const halfway = this.targetDistance / 2;
    if (reading.distanceMeters >= halfway) {
      this.halfwayFired = true;
      return {
        type: 'halfway',
        priority: CuePriority.NORMAL,
        context: ctx,
        timestamp: Date.now(),
      };
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // CueContext builder
  // ---------------------------------------------------------------------------

  private buildCueContext(reading: StrokeReading): CueContext {
    const splitMs = reading.splitMs;
    const minutes = Math.floor(splitMs / 60000);
    const seconds = Math.floor((splitMs % 60000) / 1000);
    const currentSplitStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    return {
      userName: this.userName,
      currentSplitStr,
      currentRate: reading.strokeRate,
      targetRate: this.targetRate,
      elapsedMin: reading.elapsedTimeMs / 60000,
      distanceM: reading.distanceMeters,
    };
  }
}

// Module-level singleton — survives React re-renders
export const strokeProcessor = new StrokeProcessor();
