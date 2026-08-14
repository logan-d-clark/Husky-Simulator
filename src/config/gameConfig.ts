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
  TRICK_FOOD_COST: number; // food spent per trick — 0 so building affection costs no score
  TRICK_WATER_COST: number; // water spent per trick — the real price, paid in pond trips
  WARN_FOOD_LOW: number; // warn (and redden the HUD) at or below this food
  WARN_WATER_LOW: number; // warn at or below this water
  WARN_PEE_HIGH: number; // warn at or above this pee
  MUSIC_VOLUME: number; // 0..1 gain for the background music bed
  SFX_VOLUME: number; // 0..1 gain for cues
  RAWHIDE_EAT_SECONDS: number; // how long Bandit is pinned once he reaches one
  REPELLER_RADIUS: number; // tiles Bandit will not enter around a repeller
  REPELLER_SECONDS: number;
  ZOOM_SECONDS: number; // zoomies duration
  ZOOM_SPEED_MULTIPLIER: number; // Blizzard's speed while zooming
  ITEM_DROP_PER_TICK: number; // base per-tick chance an item drops
  ITEM_DROP_FOOD_SCALE: number; // food held per doubling of that chance
  ITEM_MILESTONE_FOOD: number; // free item each time this much food is reached
  BOWL_LIKELIHOOD: number;
  BAG_LIKELIHOOD: number;
  BOWL_MULTIPLIER: number;
  BAG_MULTIPLIER: number;
  BOWL_THRESHOLD: number;
  BAG_THRESHOLD: number;
  PUPCUP_MULTIPLIER: number; // the ultimate food — a maxed-affection reward
  PUPCUP_LIKELIHOOD: number;
  PUPCUP_THRESHOLD: number; // affection needed; compared with >=, see rollDispense
  SMELL_PUPCUP: number; // Bandit smells it from further than anything else
  START_FOOD: number;
  START_WATER: number;
  HEAT_PAVEMENT: number;
  HEAT_GRASS: number;
  GAME_SECONDS: number;
  SMELL_TREAT: number; // Bandit's smell radius (tiles) per food type
  SMELL_BOWL: number;
  SMELL_BAG: number;
  PATROL_SPEED_MULTIPLIER: number; // Bandit's per-tile duration x this while patrolling (2 = half speed)
  BANDIT_DELAY_SECONDS: number; // base time Bandit stays penned; scaled per difficulty
  BANDIT_RELIEVE_THRESHOLD: number; // poop/pee level that sends Bandit to a yard to relieve (default: full)
  BANDIT_THIRST_FRACTION: number; // fraction of WATER_CAP at or below which Bandit goes for water
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
  // Affection lost per drop of waste, before the owner's sensitivity multiplier.
  // Calibrated so one full 99-drop load costs an average yard a quarter of the
  // scale: 25 affection / 99 drops / median family sensitivity 3 = 0.084. That
  // puts a forgiving (sens 1) yard at -8, an average (sens 3) at -25, and the
  // harshest (sens 5) at -42, instead of every yard being zeroed by one visit.
  POOP_COST: 0.084,
  PEE_COST: 0.084,
  POOP_MAX: 100,
  PEE_MAX: 100,
  CLEAN_RATE: 1,
  CLEAN_COST: 1,
  TRICK_RATE: 1,
  TRICK_FOOD_COST: 0,
  TRICK_WATER_COST: 1,
  WARN_FOOD_LOW: 20,
  WARN_WATER_LOW: 30,
  WARN_PEE_HIGH: 80,
  MUSIC_VOLUME: 0.18,
  SFX_VOLUME: 0.5,
  RAWHIDE_EAT_SECONDS: 60,
  REPELLER_RADIUS: 6,
  REPELLER_SECONDS: 60,
  ZOOM_SECONDS: 30,
  ZOOM_SPEED_MULTIPLIER: 2,
  // ~3 drops per 20-minute round at 50 food held, ~6 at 800, ~12 at 2400. A
  // realistic ramp lands around 6-9, plus one per 1000-food milestone.
  ITEM_DROP_PER_TICK: 0.00025,
  ITEM_DROP_FOOD_SCALE: 800,
  ITEM_MILESTONE_FOOD: 1000,
  BOWL_LIKELIHOOD: 0.3,
  BAG_LIKELIHOOD: 0.05,
  BOWL_MULTIPLIER: 2,
  BAG_MULTIPLIER: 4,
  BOWL_THRESHOLD: 50,
  BAG_THRESHOLD: 90,
  PUPCUP_MULTIPLIER: 12, // 120 food vs a bag's 40
  PUPCUP_LIKELIHOOD: 0.05, // as likely as a bag; the 100-affection gate is the scarcity
  PUPCUP_THRESHOLD: 100,
  SMELL_PUPCUP: 14,
  START_FOOD: 50,
  START_WATER: 50,
  HEAT_PAVEMENT: 0.05,
  HEAT_GRASS: 0.01,
  GAME_SECONDS: 20 * 60, // V1 TIME_MAX = 20 minutes
  SMELL_TREAT: 5,
  SMELL_BOWL: 8,
  SMELL_BAG: 12,
  PATROL_SPEED_MULTIPLIER: 2,
  BANDIT_DELAY_SECONDS: 120,
  BANDIT_RELIEVE_THRESHOLD: 100, // == POOP_MAX/PEE_MAX: he only goes when a channel is 100% full
  BANDIT_THIRST_FRACTION: 0.1,
});

// The live config every consumer reads from. Starts at defaults.
export const config: GameConfig = { ...DEFAULTS };

// Fields baked in at game start rather than read live each tick — editing them
// applies on the NEXT game start: heat is baked into tiles at map parse,
// GAME_SECONDS seeds the clock, and START_* seed the husky's inventory.
export const INIT_ONLY_KEYS: ReadonlySet<keyof GameConfig> = new Set<keyof GameConfig>([
  // BANDIT_DELAY_SECONDS is read once into the gate clock in GameScene.create,
  // exactly like GAME_SECONDS seeds the round clock — without this the dev panel
  // would advertise it as live and silently ignore a mid-round edit.
  'HEAT_GRASS',
  'HEAT_PAVEMENT',
  'GAME_SECONDS',
  'START_FOOD',
  'START_WATER',
  'BANDIT_DELAY_SECONDS',
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
  return (Object.keys(c) as (keyof GameConfig)[]).map((k) => `${k}=${c[k]}`).join('\n') + '\n';
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
