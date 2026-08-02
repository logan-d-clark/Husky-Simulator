import type { TileCoord, Direction, Inventory } from '../types';
import { config } from '../config/gameConfig';

export class Chihuahua {
  facing: Direction = 'right';
  // Bandit has the same needs as Blizzard. inv.food is also his score.
  inv: Inventory = { food: config.START_FOOD, water: config.START_WATER, poop: 0, pee: 0 };
  constructor(public tile: TileCoord) {}
}
