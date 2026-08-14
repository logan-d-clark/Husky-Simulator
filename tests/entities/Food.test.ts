import { describe, it, expect } from 'vitest';
import { takeFoodAt, foodValue } from '../../src/entities/Food';
import type { Food } from '../../src/entities/Food';
import { config } from '../../src/config/gameConfig';

const food = (col: number, row: number, type: Food['type'] = 'treat', value = 10): Food => ({
  type,
  value,
  tile: { col, row },
});

describe('foodValue', () => {
  it('scales each type off TREAT_VALUE by its own multiplier', () => {
    expect(foodValue('treat')).toBe(config.TREAT_VALUE);
    expect(foodValue('bowl')).toBe(config.BOWL_MULTIPLIER * config.TREAT_VALUE);
    expect(foodValue('bag')).toBe(config.BAG_MULTIPLIER * config.TREAT_VALUE);
    expect(foodValue('pupcup')).toBe(config.PUPCUP_MULTIPLIER * config.TREAT_VALUE);
  });

  it('makes the pup cup the most valuable food by a wide margin', () => {
    expect(foodValue('pupcup')).toBeGreaterThan(foodValue('bag'));
    expect(foodValue('pupcup')).toBeGreaterThan(2 * foodValue('bag'));
  });
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
