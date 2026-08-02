import { describe, it, expect, afterEach } from 'vitest';
import { parseMap } from '../../src/world/MapParser';
import { Grid } from '../../src/world/Grid';
import {
  nextBanditMove, bestSmelledFood, smellRadius, isThirsty, patrolDir, type Bandit,
} from '../../src/systems/AISystem';
import { config, resetConfig } from '../../src/config/gameConfig';
import type { Food } from '../../src/entities/Food';
import type { Inventory } from '../../src/types';

afterEach(() => resetConfig());

const fullInv = (): Inventory => ({ food: 50, water: 50, poop: 0, pee: 0 });
const bandit = (col: number, over: Partial<Bandit> = {}): Bandit =>
  ({ tile: { col, row: 0 }, inv: fullInv(), facing: 'right', ...over });

// 1x13 open grass corridor.
const grid = new Grid(parseMap(Array(13).fill('G0').join(',')));

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
    const pick = bestSmelledFood({ col: 0, row: 0 }, [treat, bag]);
    expect(pick).toBe(bag);
  });
});

describe('isThirsty', () => {
  it('is true below 30% of water cap', () => {
    expect(isThirsty({ food: 50, water: config.WATER_CAP * 0.2, poop: 0, pee: 0 })).toBe(true);
    expect(isThirsty({ food: 50, water: config.WATER_CAP * 0.9, poop: 0, pee: 0 })).toBe(false);
  });
});

describe('nextBanditMove', () => {
  it('heads toward the only smelled food', () => {
    const foods: Food[] = [{ type: 'treat', value: 10, tile: { col: 4, row: 0 } }];
    expect(nextBanditMove(grid, bandit(0), foods, () => 0)).toBe('right');
  });
  it('patrols (a valid direction) when nothing is smelled and not thirsty', () => {
    const dir = nextBanditMove(grid, bandit(5), [], () => 0);
    expect(['left', 'right']).toContain(dir); // up/down blocked on a 1-row corridor
  });
});

describe('patrolDir', () => {
  it('returns an open direction', () => {
    expect(['left', 'right']).toContain(patrolDir(grid, { col: 5, row: 0 }, 'right', () => 0.9));
  });
});
