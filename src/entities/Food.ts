import type { FoodType, TileCoord } from '../types';
import { TREAT_VALUE, BOWL_MULTIPLIER, BAG_MULTIPLIER } from '../config/constants';

export interface Food { type: FoodType; value: number; tile: TileCoord; }

export function foodValue(type: FoodType): number {
  if (type === 'bowl') return BOWL_MULTIPLIER * TREAT_VALUE;
  if (type === 'bag') return BAG_MULTIPLIER * TREAT_VALUE;
  return TREAT_VALUE;
}
