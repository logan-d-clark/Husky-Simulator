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
}

export const DIFFICULTIES: Record<Difficulty, DifficultySettings> = {
  puppy: { subtitle: 'Normal', chiSpeedMultiplier: 2, fogOfWar: false },
  husky: { subtitle: 'Hard', chiSpeedMultiplier: 1, fogOfWar: false },
  blizzlord: { subtitle: 'Very Hard', chiSpeedMultiplier: 1, fogOfWar: true },
};

export const DEFAULT_DIFFICULTY: Difficulty = 'puppy';

/** Resolve settings for a difficulty, falling back to the default for any
 *  value not in the registry (e.g. missing/stale scene-init data). */
export function getDifficultySettings(d: Difficulty): DifficultySettings {
  return DIFFICULTIES[d] ?? DIFFICULTIES[DEFAULT_DIFFICULTY];
}
