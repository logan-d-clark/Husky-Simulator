// Structural constants that cannot change mid-run. Numeric gameplay tunables
// live in gameConfig.ts (runtime-mutable for dev mode).

export const GRID = { ROWS: 26, COLS: 48, TILE: 28 } as const;

export const DESIGN_WIDTH = 1344;   // 48 cols * 28px
export const DESIGN_HEIGHT = 728;   // 26 rows * 28px

export const SIM_HZ = 10;                    // V1 FPS
export const TICKS_PER_SECOND = SIM_HZ;
export const HUSKY_START_TILE = { col: 22, row: 13 };  // from V1 start x/y
