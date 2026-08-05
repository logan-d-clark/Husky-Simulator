import { describe, it, expect, afterEach } from 'vitest';
import { parseMap } from '../../src/world/MapParser';
import { Grid } from '../../src/world/Grid';
import {
  nextBanditMove, bestSmelledFood, bestFoodAnywhere, smellRadius, isThirsty,
  patrolStep, banditTweenDuration, nearestFoodWithin, rankRelieveTargets,
  type Bandit, type RelieveTarget,
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

  describe('opportunistic treat grab while thirsty', () => {
    // Row0 is grass (treats), row1 is a pavement corridor ending in water at (4,1).
    // A thirsty bandit at (0,1) beelines RIGHT to water; a grabbable treat above
    // him at (0,0) pulls him UP first — so the two behaviours differ in direction.
    const wgrid = new Grid(parseMap(['G0,G0,G0,G0,G0', 'P0,P0,P0,P0,W0'].join('\n')));
    const thirsty = (): Bandit =>
      ({ tile: { col: 0, row: 1 }, inv: { food: 50, water: config.WATER_CAP * 0.1, poop: 0, pee: 0 }, facing: 'right' });

    it('diverts UP to a treat within the grab radius instead of beelining to water', () => {
      const foods: Food[] = [{ type: 'treat', value: 10, tile: { col: 0, row: 0 } }]; // dist 1 <= radius
      expect(nextBanditMove(wgrid, thirsty(), foods, rng)).toEqual({ dir: 'up', mode: 'chase' });
    });

    it('ignores a treat beyond the grab radius and heads RIGHT to water', () => {
      const foods: Food[] = [{ type: 'treat', value: 10, tile: { col: 4, row: 0 } }]; // dist 5 > radius
      expect(nextBanditMove(wgrid, thirsty(), foods, rng)).toEqual({ dir: 'right', mode: 'chase' });
    });

    it('picks the nearer of two treats within the radius', () => {
      const near: Food = { type: 'treat', value: 10, tile: { col: 1, row: 0 } };
      const far: Food = { type: 'bag', value: 40, tile: { col: config.BANDIT_GRAB_RADIUS, row: 0 } };
      expect(nearestFoodWithin({ col: 0, row: 0 }, [far, near], config.BANDIT_GRAB_RADIUS)).toBe(near);
    });

    it('nearestFoodWithin is inclusive at the radius and excludes beyond it', () => {
      const at: Food = { type: 'treat', value: 10, tile: { col: 3, row: 0 } };
      expect(nearestFoodWithin({ col: 0, row: 0 }, [at], 3)).toBe(at);
      expect(nearestFoodWithin({ col: 0, row: 0 }, [at], 2)).toBeNull();
    });
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

describe('relieve targeting', () => {
  const rng = () => 0;
  const line = new Grid(parseMap('P0,P0,P0,P0,P0')); // 5 open pavement tiles
  const highPoop = (col: number): Bandit =>
    ({ tile: { col, row: 0 }, inv: { food: 50, water: 50, poop: config.BANDIT_RELIEVE_THRESHOLD, pee: 0 }, facing: 'right' });
  const target = (col: number, affection: number): RelieveTarget => ({ tile: { col, row: 0 }, affection });

  it('heads toward a reachable yard when poop is high', () => {
    expect(nextBanditMove(line, highPoop(2), [], rng, [target(0, 50)])).toEqual({ dir: 'left', mode: 'chase' });
  });

  it('is triggered by a high pee need alone', () => {
    const b: Bandit = { tile: { col: 2, row: 0 }, inv: { food: 50, water: 50, poop: 0, pee: config.BANDIT_RELIEVE_THRESHOLD }, facing: 'right' };
    expect(nextBanditMove(line, b, [], rng, [target(4, 50)])).toEqual({ dir: 'right', mode: 'chase' });
  });

  it('picks the highest-affection yard', () => {
    expect(nextBanditMove(line, highPoop(2), [], rng, [target(0, 20), target(4, 80)])?.dir).toBe('right');
  });

  it('breaks an affection tie by nearest', () => {
    expect(nextBanditMove(line, highPoop(2), [], rng, [target(1, 50), target(4, 50)])?.dir).toBe('left');
  });

  it('skips an unreachable top yard for the next-best reachable one', () => {
    const grid = new Grid(parseMap('P0,P0,H0')); // col 2 is a house — unreachable
    // top-affection target is the house (unreachable); the reachable col-1 yard wins.
    expect(nextBanditMove(grid, highPoop(0), [], rng, [target(2, 90), target(1, 50)])).toEqual({ dir: 'right', mode: 'chase' });
  });

  it('falls through to normal behaviour when no yard is reachable', () => {
    const grid = new Grid(parseMap('P0,P0,H0'));
    expect(nextBanditMove(grid, highPoop(0), [], rng, [target(2, 90)])?.mode).toBe('patrol');
  });

  it('does not relieve when the need is low', () => {
    const lowNeed: Bandit = { tile: { col: 2, row: 0 }, inv: { food: 50, water: 50, poop: 0, pee: 0 }, facing: 'right' };
    expect(nextBanditMove(line, lowNeed, [], rng, [target(0, 80)])?.mode).toBe('patrol');
  });

  describe('rankRelieveTargets', () => {
    const from = { col: 0, row: 0 };
    it('orders by affection descending', () => {
      const ranked = rankRelieveTargets(from, [target(1, 20), target(2, 80), target(3, 50)]);
      expect(ranked.map((t) => t.affection)).toEqual([80, 50, 20]);
    });
    it('breaks affection ties by nearest', () => {
      const ranked = rankRelieveTargets(from, [target(3, 50), target(1, 50)]);
      expect(ranked.map((t) => t.tile.col)).toEqual([1, 3]);
    });
    it('resolves a full affection+distance tie by stable original order', () => {
      const a = target(1, 50); const b = { tile: { col: 1, row: 2 }, affection: 50 }; // same dist from (0,0)
      expect(rankRelieveTargets(from, [a, b])).toEqual([a, b]);
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
