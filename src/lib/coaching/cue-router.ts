import { CuePriority } from './coaching-types';
import type { CoachingTrigger, AudioCue } from './coaching-types';
import { templates } from './cue-templates';
import { audioQueue } from './audio-queue';

/**
 * CueRouter — module-level singleton for routing coaching triggers to audio cues.
 *
 * Two paths:
 *   1. Pre-computed path: trigger.type matches a template → fill template → enqueue AudioCue
 *      Target: <500ms per COACH-02. No server round-trip.
 *   2. LLM path: no template found → store in pendingLlmTriggers for Plan 03 API route.
 *      Latency acceptable (>500ms) for novel/conversational situations.
 *
 * D-06: NORMAL cues respect a minimum 30s cooldown between firings.
 *        HIGH cues bypass the cooldown entirely.
 */
class CueRouter {
  /** Per-trigger-type cooldown tracking: triggerType → last-fired epoch ms */
  private cooldowns: Map<string, number> = new Map();

  /** Minimum ms between non-urgent cues (D-06 default: 30s) */
  private minCooldownMs = 30000;

  /** Triggers queued for the LLM path (Plan 03 will consume these) */
  private pendingLlmTriggers: CoachingTrigger[] = [];

  /**
   * Route a trigger to the pre-computed or LLM path.
   *
   * Pre-computed path:
   *   - Find template matching trigger.type
   *   - Apply cooldown check (bypassed for HIGH priority per D-06)
   *   - Fill template text with trigger.context
   *   - Create AudioCue and enqueue
   *
   * LLM path:
   *   - No template → push to pendingLlmTriggers (Plan 03 polls/consumes)
   */
  route(trigger: CoachingTrigger): void {
    const template = templates.find((t) => t.key === trigger.type);

    if (!template) {
      // LLM path — Plan 03 consumes pendingLlmTriggers
      this.pendingLlmTriggers.push(trigger);
      return;
    }

    // Cooldown check (D-06)
    // HIGH priority bypasses cooldown entirely
    if (trigger.priority !== CuePriority.HIGH && template.cooldownMs > 0) {
      const now = Date.now();
      const lastFired = this.cooldowns.get(trigger.type) ?? 0;
      const effectiveCooldown = Math.max(template.cooldownMs, this.minCooldownMs);
      if (now - lastFired < effectiveCooldown) {
        return; // Cooldown not elapsed — skip
      }
    }

    // Record fire time (both HIGH and NORMAL, so HIGH also respects inter-cue tracking)
    this.cooldowns.set(trigger.type, Date.now());

    // Fill template and create AudioCue
    const text = template.text(trigger.context);
    const cue: AudioCue = {
      id: crypto.randomUUID(),
      text,
      priority: trigger.priority,
      triggerType: trigger.type,
    };

    // Enqueue for playback — audioQueue handles interrupt logic (D-05)
    audioQueue.enqueue(cue);
  }

  /**
   * Set the minimum cooldown between non-urgent (NORMAL) cues.
   * Defaults to 30000ms (30s) per D-06.
   */
  setMinCooldownMs(ms: number): void {
    this.minCooldownMs = ms;
  }

  /**
   * Drain pending LLM triggers (consumed by Plan 03 API route).
   * Returns and clears the pending list.
   */
  drainPendingLlmTriggers(): CoachingTrigger[] {
    const pending = [...this.pendingLlmTriggers];
    this.pendingLlmTriggers = [];
    return pending;
  }

  /**
   * Reset cooldowns and pending triggers.
   * MUST be called at session start (per RESEARCH.md Pitfall 3).
   */
  reset(): void {
    this.cooldowns.clear();
    this.pendingLlmTriggers = [];
  }
}

// Module-level singleton — survives React re-renders
export const cueRouter = new CueRouter();
