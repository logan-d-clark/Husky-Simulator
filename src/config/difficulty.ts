// Difficulty settings registry. Extensible: a new difficulty tweak is a new
// field on DifficultySettings with a value per level — no call-site rewiring,
// consumers just read the field they need off getDifficultySettings(d).

export type Difficulty = 'normal' | 'hard';

export interface DifficultySettings {
  /** Multiplier on the chihuahua's per-tile tween duration. 2 = half husky
   *  speed (Normal), 1 = husky speed (Hard). Larger = slower rival. */
  chiSpeedMultiplier: number;
}

export const DIFFICULTIES: Record<Difficulty, DifficultySettings> = {
  normal: { chiSpeedMultiplier: 2 },
  hard: { chiSpeedMultiplier: 1 },
};

export const DEFAULT_DIFFICULTY: Difficulty = 'normal';

/** Resolve settings for a difficulty, falling back to the default for any
 *  value not in the registry (e.g. missing/stale scene-init data). */
export function getDifficultySettings(d: Difficulty): DifficultySettings {
  return DIFFICULTIES[d] ?? DIFFICULTIES[DEFAULT_DIFFICULTY];
}
