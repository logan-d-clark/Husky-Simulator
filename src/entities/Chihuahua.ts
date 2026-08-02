import type { TileCoord, Direction } from '../types';
import { config } from '../config/gameConfig';

export class Chihuahua {
  facing: Direction = 'right';
  // Current food held — the score. Grows by food value on eating, digests as
  // Bandit moves. (Water/poop/pee needs arrive in the Bandit-AI slice.)
  food = config.START_FOOD;
  constructor(public tile: TileCoord) {}
}
