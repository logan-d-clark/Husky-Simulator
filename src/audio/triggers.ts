import type { Inventory } from '../types';
import { config } from '../config/gameConfig';

// Deciding WHEN a cue fires, kept separate from what it sounds like. Both rules
// here exist to stop the 10Hz sim tick turning a cue into a buzzsaw.

export type WarningName = 'warnFood' | 'warnWater' | 'warnPee';

// How far a stat must recover past its threshold before the warning can fire
// again. Without this, a stat hovering on the boundary re-triggers every tick.
const REARM_MARGIN = 0.1;

/**
 * Edge-triggered threshold warnings: each fires once when the stat crosses into
 * danger and stays silent until the stat recovers clear of the threshold.
 * Thresholds are read live so a dev-panel edit takes effect immediately.
 */
export class WarningTracker {
  private armed: Record<WarningName, boolean> = { warnFood: true, warnWater: true, warnPee: true };

  private evaluate(name: WarningName, inDanger: boolean, recovered: boolean, out: WarningName[]): void {
    if (inDanger && this.armed[name]) {
      this.armed[name] = false;
      out.push(name);
    } else if (recovered) {
      this.armed[name] = true;
    }
  }

  /** The warnings that fire on this tick — usually none. */
  check(inv: Inventory): WarningName[] {
    const out: WarningName[] = [];
    const food = config.WARN_FOOD_LOW, water = config.WARN_WATER_LOW, pee = config.WARN_PEE_HIGH;
    this.evaluate('warnFood', inv.food <= food, inv.food > food * (1 + REARM_MARGIN), out);
    this.evaluate('warnWater', inv.water <= water, inv.water > water * (1 + REARM_MARGIN), out);
    this.evaluate('warnPee', inv.pee >= pee, inv.pee < pee * (1 - REARM_MARGIN), out);
    return out;
  }
}

/**
 * Which keys went false -> true between two snapshots. Turns the per-tick
 * "is this action applying" booleans into action-START cues: one sound when he
 * begins, silence while he holds, re-armed once he stops. Keying on whether the
 * action *applied* (not on the keypress) means a key held while running — which
 * no longer does anything — correctly makes no sound.
 */
export function risingEdges<T extends string>(
  prev: Readonly<Record<T, boolean>>, now: Readonly<Record<T, boolean>>,
): T[] {
  return (Object.keys(now) as T[]).filter((k) => now[k] && !prev[k]);
}
