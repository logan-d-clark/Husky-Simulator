import { describe, it, expect } from 'vitest';
import { takeFoodAt } from '../../src/entities/Food';
import type { Food } from '../../src/entities/Food';

const food = (col: number, row: number, type: Food['type'] = 'treat', value = 10): Food => ({
  type, value, tile: { col, row },
});

describe('takeFoodAt', () => {
  it('returns and removes the matching food', () => {
    const foods = [food(1, 1)];
    const result = takeFoodAt(foods, 1, 1);
    expect(result).toEqual(food(1, 1));
    expect(foods).toHaveLength(0);
  });

  it('returns undefined when no food is at that tile', () => {
    const foods = [food(1, 1)];
    const result = takeFoodAt(foods, 2, 2);
    expect(result).toBeUndefined();
    expect(foods).toHaveLength(1);
  });

  it('removes only the matching food when multiple foods exist', () => {
    const a = food(0, 0);
    const b = food(1, 1);
    const c = food(2, 2);
    const foods = [a, b, c];
    const result = takeFoodAt(foods, 1, 1);
    expect(result).toBe(b);
    expect(foods).toEqual([a, c]);
  });
});
