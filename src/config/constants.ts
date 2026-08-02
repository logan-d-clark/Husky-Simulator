export const GRID = { ROWS: 26, COLS: 48, TILE: 28 } as const;

export const DESIGN_WIDTH = 1344;   // 48 cols * 28px
export const DESIGN_HEIGHT = 728;   // 26 rows * 28px

export const FOOD_RATE = 0.1;
export const WATER_RATE = 0.1;
export const TREAT_VALUE = 10;
export const WATER_VALUE = 10;
export const WATER_MAX = 1000;
export const WATER_CAP = WATER_MAX / 8; // matches V1 STATUS_BAR_SCALE cap (125)

export const POOP_RATE = 1;
export const PEE_RATE = 1;
export const POOP_COST = 1;
export const PEE_COST = 1;
export const POOP_MAX = 100;
export const PEE_MAX = 100;

export const CLEAN_RATE = 1;   // ported for completeness; no clean action in V1
export const CLEAN_COST = 1;

export const TRICK_RATE = 1;
export const TRICK_COST = 1;

export const BOWL_LIKELIHOOD = 0.3;
export const BAG_LIKELIHOOD = 0.05;
export const BOWL_MULTIPLIER = 2;
export const BAG_MULTIPLIER = 4;
export const BOWL_THRESHOLD = 50;
export const BAG_THRESHOLD = 90;

export const START_FOOD = 50;
export const START_WATER = 50;

export const HEAT_PAVEMENT = 0.05;
export const HEAT_GRASS = 0.01;

export const SIM_HZ = 10;                    // V1 FPS
export const TICKS_PER_SECOND = SIM_HZ;
export const GAME_SECONDS = 20 * 60;         // V1 TIME_MAX = 20 minutes
export const HUSKY_START_TILE = { col: 22, row: 13 };  // from V1 start x/y
