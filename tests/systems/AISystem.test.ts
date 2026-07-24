import { describe, it, expect } from 'vitest';
import { parseMap } from '../../src/world/MapParser';
import { Grid } from '../../src/world/Grid';
import { AISystem } from '../../src/systems/AISystem';
import type { Food } from '../../src/entities/Food';

// 1x5 open grass corridor
const grid = new Grid(parseMap('G0,G0,G0,G0,G0'));

describe('AISystem.nextStep', () => {
  it('steps toward the only food to the right', () => {
    const foods: Food[] = [{ type: 'treat', value: 10, tile: { col: 4, row: 0 } }];
    expect(AISystem.nextStep(grid, { col: 0, row: 0 }, foods)).toBe('right');
  });
  it('steps toward the nearer of two foods', () => {
    const foods: Food[] = [
      { type: 'treat', value: 10, tile: { col: 0, row: 0 } },
      { type: 'treat', value: 10, tile: { col: 4, row: 0 } },
    ];
    // starting at col 1, nearest is col 0 -> left
    expect(AISystem.nextStep(grid, { col: 1, row: 0 }, foods)).toBe('left');
  });
  it('returns null when no food', () => {
    expect(AISystem.nextStep(grid, { col: 0, row: 0 }, [])).toBeNull();
  });
});
