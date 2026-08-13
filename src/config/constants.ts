// Structural constants that cannot change mid-run. Numeric gameplay tunables
// live in gameConfig.ts (runtime-mutable for dev mode).

export const GRID = { ROWS: 26, COLS: 48, TILE: 28 } as const;

export const DESIGN_WIDTH = 1344;   // 48 cols * 28px
export const DESIGN_HEIGHT = 728;   // 26 rows * 28px

export const SIM_HZ = 10;                    // V1 FPS
export const TICKS_PER_SECOND = SIM_HZ;
export const HUSKY_START_TILE = { col: 22, row: 13 };  // from V1 start x/y

// The Grumbles' driveway. Their property is fenced on every other side, so
// closing the right edge of these two tiles seals it completely: with them shut
// Bandit reaches 190 tiles and Blizzard 852, with zero overlap, and 190 + 852 is
// exactly the map's 1042 walkable tiles. `tests/world/gate.test.ts` re-derives
// that from the real map, so an edit to map.csv that moved the driveway fails
// loudly instead of silently leaving the gate ajar.
export const GATE_TILES = [{ col: 19, row: 4 }, { col: 19, row: 5 }] as const;

export const CHI_START_TILE = { col: 2, row: 2 };      // Bandit starts at home
