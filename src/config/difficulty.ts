import { config } from './gameConfig';

// Difficulty settings registry. Extensible: a new difficulty tweak is a new
// field on DifficultySettings with a value per level — no call-site rewiring,
// consumers just read the field they need off getDifficultySettings(d).

export type Difficulty = 'puppy' | 'husky' | 'blizzlord';

export interface DifficultySettings {
  /** Shown under the level name on the menu. */
  subtitle: string;
  /** Multiplier on the chihuahua's per-tile tween duration. 2 = half husky
   *  speed, 1 = husky speed. Larger = slower rival. */
  chiSpeedMultiplier: number;
  /** Blizzlord: Blizzard only sees his line-of-sight field of view. */
  fogOfWar: boolean;
  /** Multiplier on BANDIT_DELAY_SECONDS — how long Bandit stays penned behind
   *  the Grumbles' gate at the start of a round. Larger = longer reprieve. */
  banditDelayMultiplier: number;
}

export const DIFFICULTIES: Record<Difficulty, DifficultySettings> = {
  puppy: { subtitle: 'Normal', chiSpeedMultiplier: 2, fogOfWar: false, banditDelayMultiplier: 1.5 },
  husky: { subtitle: 'Hard', chiSpeedMultiplier: 1, fogOfWar: false, banditDelayMultiplier: 1 },
  blizzlord: { subtitle: 'Very Hard', chiSpeedMultiplier: 1, fogOfWar: true, banditDelayMultiplier: 0.5 },
};

export const DEFAULT_DIFFICULTY: Difficulty = 'puppy';

/** Resolve settings for a difficulty, falling back to the default for any
 *  value not in the registry (e.g. missing/stale scene-init data). */
export function getDifficultySettings(d: Difficulty): DifficultySettings {
  return DIFFICULTIES[d] ?? DIFFICULTIES[DEFAULT_DIFFICULTY];
}

/** How long Bandit stays penned this round: the live config base scaled by the
 *  difficulty's multiplier, so one dev-panel knob tunes all three levels at
 *  once while keeping their relative order. */
export function banditDelaySeconds(d: Difficulty): number {
  return config.BANDIT_DELAY_SECONDS * getDifficultySettings(d).banditDelayMultiplier;
}
