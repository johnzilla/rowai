import { CuePriority } from './coaching-types';
import type { CueContext } from './coaching-types';

export interface CueTemplate {
  key: string;
  priority: CuePriority;
  cooldownMs: number;
  text: (ctx: CueContext) => string;
}

/**
 * Pre-computed cue template library.
 * Templates are matched by trigger type in CueRouter.
 * Text functions receive CueContext and return a ready-to-speak string.
 * D-07: short and punchy — easy to process while rowing.
 */
export const templates: CueTemplate[] = [
  {
    key: 'split_drift_up',
    priority: CuePriority.HIGH,
    cooldownMs: 0,
    text: (ctx) =>
      `Ease up on the rate, you're at ${ctx.currentRate}. Split is drifting.`,
  },
  {
    key: 'rate_too_high',
    priority: CuePriority.HIGH,
    cooldownMs: 0,
    text: (ctx) => {
      const target = ctx.targetRate ?? ctx.currentRate - 2;
      return `Rate's at ${ctx.currentRate}, bring it down to ${target}.`;
    },
  },
  {
    key: 'rate_too_low',
    priority: CuePriority.NORMAL,
    cooldownMs: 30000,
    text: (ctx) => `Pick up the rate a bit, you're at ${ctx.currentRate}.`,
  },
  {
    key: 'pace_on_target',
    priority: CuePriority.NORMAL,
    cooldownMs: 60000,
    text: () => 'Nice split, hold it.',
  },
  {
    key: 'halfway',
    priority: CuePriority.NORMAL,
    cooldownMs: 0,
    text: (ctx) =>
      `Halfway. ${Math.round(ctx.distanceM)}m in, ${ctx.currentSplitStr} split.`,
  },
  {
    key: 'session_start_cue',
    priority: CuePriority.NORMAL,
    cooldownMs: 0,
    text: (ctx) => `Alright ${ctx.userName}, let's go. Nice and steady.`,
  },
  {
    key: 'encouragement_interval',
    priority: CuePriority.NORMAL,
    cooldownMs: 120000,
    text: () => 'Good rhythm. Keep it steady.',
  },
];
