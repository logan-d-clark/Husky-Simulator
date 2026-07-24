import type { Inventory, TileCoord, Direction } from '../types';
import { START_FOOD, START_WATER, HUSKY_START_TILE } from '../config/constants';

export class Husky {
  tile: TileCoord = { ...HUSKY_START_TILE };
  facing: Direction = 'left';
  inv: Inventory = { food: START_FOOD, water: START_WATER, poop: 0, pee: 0 };
  treatsEaten = 0;
}
