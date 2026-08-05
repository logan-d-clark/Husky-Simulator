import { describe, it, expect, afterEach } from 'vitest';
import { parseMap } from '../../src/world/MapParser';
import { Grid } from '../../src/world/Grid';
import {
  nextBanditMove, bestSmelledFood, bestFoodAnywhere, smellRadius, isThirsty,
  patrolStep, banditTweenDuration, type Bandit,
} from '../../src/systems/AISystem';
import { config, resetConfig } from '../../src/config/gameConfig';
import { banditSettings, resetBanditSettings } from '../../src/config/banditMode';
import type { Food } from '../../src/entities/Food';
import type { Inventory } from '../../src/types';

afterEach(() => { resetConfig(); resetBanditSettings(); });

const fullInv = (): Inventory => ({ food: 50, water: 50, poop: 0, pee: 0 });
const bandit = (col: number, over: Partial<Bandit> = {}): Bandit =>
  ({ tile: { col, row: 0 }, inv: fullInv(), facing: 'right', ...over });

// 1x13 open grass corridor.
const grid = new Grid(parseMap(Array(13).fill('G0').join(',')));
// A pavement street (col 1) flanked by grass yards, 3 rows tall.
const streetGrid = new Grid(parseMap(['G0,P0,G0', 'G0,P0,G0', 'G0,P0,G0'].join('\n')));

describe('smellRadius', () => {
  it('bag > bowl > treat', () => {
    expect(smellRadius('bag')).toBe(config.SMELL_BAG);
    expect(smellRadius('bowl')).toBe(config.SMELL_BOWL);
    expect(smellRadius('treat')).toBe(config.SMELL_TREAT);
    expect(config.SMELL_BAG).toBeGreaterThan(config.SMELL_BOWL);
    expect(config.SMELL_BOWL).toBeGreaterThan(config.SMELL_TREAT);
  });
});

describe('bestSmelledFood', () => {
  it('ignores food beyond its smell radius', () => {
    const foods: Food[] = [{ type: 'treat', value: 10, tile: { col: 10, row: 0 } }]; // dist 10 > SMELL_TREAT(5)
    expect(bestSmelledFood({ col: 0, row: 0 }, foods)).toBeNull();
  });
  it('prefers a distant high-value bag over a near treat by value/distance', () => {
    const treat: Food = { type: 'treat', value: 10, tile: { col: 3, row: 0 } }; // 10/4 = 2.5
    const bag: Food = { type: 'bag', value: 40, tile: { col: 10, row: 0 } };     // 40/11 = 3.6, within SMELL_BAG(12)
    expect(bestSmelledFood({ col: 0, row: 0 }, [treat, bag])).toBe(bag);
  });
});

describe('bestFoodAnywhere', () => {
  it('finds food far beyond any smell radius', () => {
    const foods: Food[] = [{ type: 'treat', value: 10, tile: { col: 40, row: 0 } }];
    expect(bestSmelledFood({ col: 0, row: 0 }, foods)).toBeNull();
    expect(bestFoodAnywhere({ col: 0, row: 0 }, foods)).toBe(foods[0]);
  });
  it('still ranks by value/distance', () => {
    const near: Food = { type: 'treat', value: 10, tile: { col: 2, row: 0 } };   // 10/3 = 3.3
    const farBig: Food = { type: 'bag', value: 100, tile: { col: 30, row: 0 } }; // 100/31 = 3.2
    expect(bestFoodAnywhere({ col: 0, row: 0 }, [near, farBig])).toBe(near);
  });
  it('returns null only when there is no food at all', () => {
    expect(bestFoodAnywhere({ col: 0, row: 0 }, [])).toBeNull();
  });
});

describe('isThirsty', () => {
  it('is true below 30% of water cap', () => {
    expect(isThirsty({ food: 50, water: config.WATER_CAP * 0.2, poop: 0, pee: 0 })).toBe(true);
    expect(isThirsty({ food: 50, water: config.WATER_CAP * 0.9, poop: 0, pee: 0 })).toBe(false);
  });
});

describe('patrolStep (street-biased)', () => {
  const rng = (v: number) => () => v;

  it('continues straight along the street when pavement lies ahead', () => {
    const line = new Grid(parseMap('P0,P0,P0'));
    expect(patrolStep(line, { col: 1, row: 0 }, 'right', rng(0.9))).toBe('right');
  });

  it('prefers pavement over an adjacent yard (pavement-preferring rng)', () => {
    // On pavement (1,1) facing up: pavement up/down, grass left/right.
    expect(patrolStep(streetGrid, { col: 1, row: 1 }, 'up', rng(0.9))).toBe('up');
  });

  it('may dip into a yard, then biases back toward the street (yard-exploring rng)', () => {
    const intoYard = patrolStep(streetGrid, { col: 1, row: 1 }, 'up', rng(0.05));
    expect(['left', 'right']).toContain(intoYard); // stepped off the street into a yard
    // From the yard tile (0,1), the next step heads back to the pavement column.
    expect(patrolStep(streetGrid, { col: 0, row: 1 }, intoYard!, rng(0.05))).toBe('right');
  });

  it('still moves when no pavement neighbour is open', () => {
    expect(['left', 'right']).toContain(patrolStep(grid, { col: 5, row: 0 }, 'right', rng(0.9)));
  });

  it('returns null when boxed in with no open neighbour', () => {
    const cell = new Grid(parseMap('G0'));
    expect(patrolStep(cell, { col: 0, row: 0 }, 'right', rng(0.5))).toBeNull();
  });
});

describe('nextBanditMove', () => {
  const rng = () => 0;

  it('chases the only smelled food (advanced mode)', () => {
    banditSettings.omniscient = false;
    const foods: Food[] = [{ type: 'treat', value: 10, tile: { col: 4, row: 0 } }];
    expect(nextBanditMove(grid, bandit(0), foods, rng)).toEqual({ dir: 'right', mode: 'chase' });
  });

  it('patrols at half speed when nothing is smelled and not thirsty', () => {
    const move = nextBanditMove(grid, bandit(5), [], rng);
    expect(move?.mode).toBe('patrol');
    expect(['left', 'right']).toContain(move?.dir);
  });

  it('chases water at full speed when thirsty', () => {
    const waterGrid = new Grid(parseMap('P0,P0,W0'));
    const thirsty = bandit(0, { inv: { food: 50, water: config.WATER_CAP * 0.1, poop: 0, pee: 0 } });
    expect(nextBanditMove(waterGrid, thirsty, [], rng)).toEqual({ dir: 'right', mode: 'chase' });
  });

  it('detects food exactly at the smell-range boundary (advanced mode)', () => {
    banditSettings.omniscient = false;
    const foods: Food[] = [{ type: 'treat', value: 10, tile: { col: config.SMELL_TREAT, row: 0 } }];
    expect(nextBanditMove(grid, bandit(0), foods, rng)?.mode).toBe('chase');
  });

  it('ignores food one tile beyond the smell-range boundary (advanced mode)', () => {
    banditSettings.omniscient = false;
    const foods: Food[] = [{ type: 'treat', value: 10, tile: { col: config.SMELL_TREAT + 1, row: 0 } }];
    expect(nextBanditMove(grid, bandit(0), foods, rng)?.mode).toBe('patrol');
  });

  describe('omniscient mode', () => {
    it('chases the globally best food, ignoring smell range', () => {
      banditSettings.omniscient = true;
      const foods: Food[] = [{ type: 'treat', value: 10, tile: { col: 12, row: 0 } }]; // dist 12 >> SMELL_TREAT
      expect(nextBanditMove(grid, bandit(0), foods, rng)).toEqual({ dir: 'right', mode: 'chase' });
    });
    it('patrols when no food exists anywhere', () => {
      banditSettings.omniscient = true;
      expect(nextBanditMove(grid, bandit(5), [], rng)?.mode).toBe('patrol');
    });
  });
});

describe('banditTweenDuration', () => {
  it('leaves a chase step at the base duration', () => {
    expect(banditTweenDuration(100, 'chase', 2)).toBe(100);
  });
  it('slows a patrol step by the multiplier (half speed at 2x)', () => {
    expect(banditTweenDuration(100, 'patrol', 2)).toBe(200);
  });
});
