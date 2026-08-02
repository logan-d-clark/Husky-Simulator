import type { Inventory, TileCoord, Direction } from '../types';
import { HUSKY_START_TILE } from '../config/constants';
import { config } from '../config/gameConfig';

export class Husky {
  tile: TileCoord = { ...HUSKY_START_TILE };
  facing: Direction = 'left';
  inv: Inventory = { food: config.START_FOOD, water: config.START_WATER, poop: 0, pee: 0 };
}
