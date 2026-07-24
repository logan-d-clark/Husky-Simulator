import type { Inventory } from '../types';
import { FOOD_RATE, WATER_RATE, WATER_VALUE, WATER_CAP } from '../config/constants';

export const ResourceSystem = {
  applyMoveCost(inv: Inventory): void {
    inv.food -= FOOD_RATE; inv.poop += FOOD_RATE;
    inv.water -= WATER_RATE; inv.pee += WATER_RATE;
  },
  applyHeat(inv: Inventory, heat: number): void {
    inv.water -= heat; inv.pee += heat;
  },
  eatFood(inv: Inventory, value: number): void { inv.food += value; },
  drink(inv: Inventory): void { inv.water = Math.min(inv.water + WATER_VALUE, WATER_CAP); },
  isGameOver(inv: Inventory): 'Food' | 'Water' | null {
    if (inv.food <= 0) return 'Food';
    if (inv.water <= 0) return 'Water';
    return null;
  },
};
