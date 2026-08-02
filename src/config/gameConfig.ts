// Mutable runtime game config. All numeric gameplay tunables live here so dev
// mode can adjust them; consumers must read `config.X` at call-time (never
// destructure at import). Most fields are read live each tick and take effect
// immediately; the fields in INIT_ONLY_KEYS are captured once at game start
// (map parse / entity spawn / clock init) and only take effect on the next
// game start. Structural values that can't change mid-run (grid size, sim
// rate, canvas dims, start tile) stay in constants.ts.

export interface GameConfig {
  FOOD_RATE: number;
  WATER_RATE: number;
  TREAT_VALUE: number;
  WATER_VALUE: number;
  WATER_MAX: number;
  WATER_CAP: number;
  POOP_RATE: number;
  PEE_RATE: number;
  POOP_COST: number;
  PEE_COST: number;
  POOP_MAX: number;
  PEE_MAX: number;
  CLEAN_RATE: number;
  CLEAN_COST: number;
  TRICK_RATE: number;
  TRICK_COST: number;
  BOWL_LIKELIHOOD: number;
  BAG_LIKELIHOOD: number;
  BOWL_MULTIPLIER: number;
  BAG_MULTIPLIER: number;
  BOWL_THRESHOLD: number;
  BAG_THRESHOLD: number;
  START_FOOD: number;
  START_WATER: number;
  HEAT_PAVEMENT: number;
  HEAT_GRASS: number;
  GAME_SECONDS: number;
  SMELL_TREAT: number; // Bandit's smell radius (tiles) per food type
  SMELL_BOWL: number;
  SMELL_BAG: number;
}

// Frozen baseline — every value verbatim from the original constants.
export const DEFAULTS: Readonly<GameConfig> = Object.freeze({
  FOOD_RATE: 0.1,
  WATER_RATE: 0.1,
  TREAT_VALUE: 10,
  WATER_VALUE: 10,
  WATER_MAX: 1000,
  WATER_CAP: 125, // WATER_MAX / 8 — matches V1 STATUS_BAR_SCALE cap
  POOP_RATE: 1,
  PEE_RATE: 1,
  POOP_COST: 1,
  PEE_COST: 1,
  POOP_MAX: 100,
  PEE_MAX: 100,
  CLEAN_RATE: 1,
  CLEAN_COST: 1,
  TRICK_RATE: 1,
  TRICK_COST: 1,
  BOWL_LIKELIHOOD: 0.3,
  BAG_LIKELIHOOD: 0.05,
  BOWL_MULTIPLIER: 2,
  BAG_MULTIPLIER: 4,
  BOWL_THRESHOLD: 50,
  BAG_THRESHOLD: 90,
  START_FOOD: 50,
  START_WATER: 50,
  HEAT_PAVEMENT: 0.05,
  HEAT_GRASS: 0.01,
  GAME_SECONDS: 20 * 60, // V1 TIME_MAX = 20 minutes
  SMELL_TREAT: 5,
  SMELL_BOWL: 8,
  SMELL_BAG: 12,
});

// The live config every consumer reads from. Starts at defaults.
export const config: GameConfig = { ...DEFAULTS };

// Fields baked in at game start rather than read live each tick — editing them
// applies on the NEXT game start: heat is baked into tiles at map parse,
// GAME_SECONDS seeds the clock, and START_* seed the husky's inventory.
export const INIT_ONLY_KEYS: ReadonlySet<keyof GameConfig> = new Set<keyof GameConfig>([
  'HEAT_GRASS', 'HEAT_PAVEMENT', 'GAME_SECONDS', 'START_FOOD', 'START_WATER',
]);

/** Restore every field to its DEFAULTS value (mutates in place). */
export function resetConfig(): void {
  Object.assign(config, DEFAULTS);
}

/** Apply a partial patch of overrides onto the live config (mutates in place). */
export function applyConfig(patch: Partial<GameConfig>): void {
  Object.assign(config, patch);
}

/** Serialize a config to plain `KEY=value` text — the format the dev panel
 *  downloads for snapshotting a tuned config. */
export function serializeConfig(c: GameConfig = config): string {
  return (Object.keys(c) as (keyof GameConfig)[])
    .map((k) => `${k}=${c[k]}`)
    .join('\n') + '\n';
}

/** Parse `KEY=value` text (as produced by serializeConfig) into a partial patch,
 *  keeping only known numeric config keys — the inverse used when importing a
 *  saved config file. */
export function parseConfig(text: string): Partial<GameConfig> {
  const known = new Set(Object.keys(DEFAULTS));
  const out: Partial<GameConfig> = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Za-z_]+)\s*=\s*(-?\d+(?:\.\d+)?)\s*$/);
    if (m && known.has(m[1])) out[m[1] as keyof GameConfig] = parseFloat(m[2]);
  }
  return out;
}
