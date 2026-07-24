import type { TileCoord, Direction } from '../types';

export class Chihuahua {
  facing: Direction = 'right';
  treatsEaten = 0;
  constructor(public tile: TileCoord) {}
}
