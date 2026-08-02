import type { Inventory } from '../types';
import { config } from '../config/gameConfig';

export const ResourceSystem = {
  applyMoveCost(inv: Inventory): void {
    inv.food -= config.FOOD_RATE; inv.poop += config.FOOD_RATE;
    inv.water -= config.WATER_RATE; inv.pee += config.WATER_RATE;
  },
  applyHeat(inv: Inventory, heat: number): void {
    inv.water -= heat; inv.pee += heat;
  },
  eatFood(inv: Inventory, value: number): void { inv.food += value; },
  drink(inv: Inventory): void { inv.water = Math.min(inv.water + config.WATER_VALUE, config.WATER_CAP); },
  isGameOver(inv: Inventory): 'Food' | 'Water' | null {
    if (inv.food <= 0) return 'Food';
    if (inv.water <= 0) return 'Water';
    return null;
  },
  // Full end-of-game gate including the round timer. (Dev mode's invincibility
  // is applied at the call site, which simply skips this check.)
  shouldEndGame(inv: Inventory, secondsLeft: number): 'Time' | 'Food' | 'Water' | null {
    if (secondsLeft <= 0) return 'Time';
    return this.isGameOver(inv);
  },
};
