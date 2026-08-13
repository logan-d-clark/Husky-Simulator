import type { FoodType, TileCoord } from '../types';
import { config } from '../config/gameConfig';

export interface Food { type: FoodType; value: number; tile: TileCoord; }

export function foodValue(type: FoodType): number {
  if (type === 'pupcup') return config.PUPCUP_MULTIPLIER * config.TREAT_VALUE;
  if (type === 'bowl') return config.BOWL_MULTIPLIER * config.TREAT_VALUE;
  if (type === 'bag') return config.BAG_MULTIPLIER * config.TREAT_VALUE;
  return config.TREAT_VALUE;
}

// Finds the food at (col,row), removes it from the array, and returns it.
// Pure array mutation only — no Phaser side effects.
export function takeFoodAt(foods: Food[], col: number, row: number): Food | undefined {
  const idx = foods.findIndex((f) => f.tile.col === col && f.tile.row === row);
  if (idx === -1) return undefined;
  return foods.splice(idx, 1)[0];
}
