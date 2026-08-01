import type { Tile } from '../world/tiles';
import type { Husky } from '../entities/Husky';
import type { Owner } from '../entities/Owner';
import { AffectionSystem } from './AffectionSystem';
import { config } from '../config/gameConfig';

export const WorldActions = {
  poop(husky: Husky, tile: Tile, owner: Owner): boolean {
    if (tile.type !== 'grass' || husky.inv.poop <= 1) return false;
    if (tile.dirt + config.POOP_RATE > config.POOP_MAX) return false;
    husky.inv.poop = Math.max(0, husky.inv.poop - config.POOP_RATE);
    tile.dirt += config.POOP_RATE;
    AffectionSystem.applyAction(owner, 'poop');
    return true;
  },
  pee(husky: Husky, tile: Tile, owner: Owner): boolean {
    if (tile.type !== 'grass' || husky.inv.pee <= 1) return false;
    if (tile.destruction + config.PEE_RATE > config.PEE_MAX) return false;
    husky.inv.pee = Math.max(0, husky.inv.pee - config.PEE_RATE);
    tile.destruction += config.PEE_RATE;
    AffectionSystem.applyAction(owner, 'pee');
    return true;
  },
  trick(husky: Husky, tile: Tile, owner: Owner): boolean {
    if (tile.type !== 'grass') return false;
    if (husky.inv.food - config.TRICK_COST <= 0 || husky.inv.water - config.TRICK_COST <= 0) return false;
    husky.inv.food -= config.TRICK_COST;
    husky.inv.water -= config.TRICK_COST;
    AffectionSystem.applyAction(owner, 'trick');
    return true;
  },
  autoDump(husky: Husky, tile: Tile, owner: Owner): void {
    if (tile.type !== 'grass') return;
    while (husky.inv.poop >= config.POOP_MAX && tile.dirt + config.POOP_RATE <= config.POOP_MAX) {
      this.poop(husky, tile, owner);
    }
    while (husky.inv.pee >= config.PEE_MAX && tile.destruction + config.PEE_RATE <= config.PEE_MAX) {
      this.pee(husky, tile, owner);
    }
  },
};
