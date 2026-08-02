import { describe, it, expect } from 'vitest';
import { ResourceSystem } from '../../src/systems/ResourceSystem';
import type { Inventory } from '../../src/types';

const inv = (): Inventory => ({ food: 50, water: 50, poop: 0, pee: 0 });

describe('ResourceSystem', () => {
  it('move cost converts food->poop and water->pee', () => {
    const i = inv();
    ResourceSystem.applyMoveCost(i);
    expect(i.food).toBeCloseTo(49.9);
    expect(i.poop).toBeCloseTo(0.1);
    expect(i.water).toBeCloseTo(49.9);
    expect(i.pee).toBeCloseTo(0.1);
  });
  it('heat drains water into pee', () => {
    const i = inv();
    ResourceSystem.applyHeat(i, 0.05);
    expect(i.water).toBeCloseTo(49.95);
    expect(i.pee).toBeCloseTo(0.05);
  });
  it('eating adds food', () => {
    const i = inv();
    ResourceSystem.eatFood(i, 20);
    expect(i.food).toBe(70);
  });
  it('drinking adds water but caps at 125', () => {
    const i = inv(); i.water = 120;
    ResourceSystem.drink(i);
    expect(i.water).toBe(125);
  });
  it('game over on food or water <= 0', () => {
    const i = inv(); i.food = 0;
    expect(ResourceSystem.isGameOver(i)).toBe('Food');
    const j = inv(); j.water = -1;
    expect(ResourceSystem.isGameOver(j)).toBe('Water');
    expect(ResourceSystem.isGameOver(inv())).toBeNull();
  });
  describe('shouldEndGame', () => {
    it('ends on time first, then food, then water', () => {
      expect(ResourceSystem.shouldEndGame(inv(), 0)).toBe('Time');
      const i = inv(); i.food = 0;
      expect(ResourceSystem.shouldEndGame(i, 100)).toBe('Food');
      const j = inv(); j.water = 0;
      expect(ResourceSystem.shouldEndGame(j, 100)).toBe('Water');
      expect(ResourceSystem.shouldEndGame(inv(), 100)).toBeNull();
    });
  });
});
