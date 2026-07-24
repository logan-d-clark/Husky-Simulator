import type { Tile } from '../world/tiles';
import type { Husky } from '../entities/Husky';
import type { Owner } from '../entities/Owner';
import { AffectionSystem } from './AffectionSystem';
import { POOP_RATE, PEE_RATE, POOP_MAX, PEE_MAX, TRICK_COST } from '../config/constants';

export const WorldActions = {
  poop(husky: Husky, tile: Tile, owner: Owner): boolean {
    if (tile.type !== 'grass' || husky.inv.poop <= 1) return false;
    if (tile.dirt + POOP_RATE > POOP_MAX) return false;
    husky.inv.poop = Math.max(0, husky.inv.poop - POOP_RATE);
    tile.dirt += POOP_RATE;
    AffectionSystem.applyAction(owner, 'poop');
    return true;
  },
  pee(husky: Husky, tile: Tile, owner: Owner): boolean {
    if (tile.type !== 'grass' || husky.inv.pee <= 1) return false;
    if (tile.destruction + PEE_RATE > PEE_MAX) return false;
    husky.inv.pee = Math.max(0, husky.inv.pee - PEE_RATE);
    tile.destruction += PEE_RATE;
    AffectionSystem.applyAction(owner, 'pee');
    return true;
  },
  trick(husky: Husky, tile: Tile, owner: Owner): boolean {
    if (tile.type !== 'grass') return false;
    if (husky.inv.food - TRICK_COST <= 0 || husky.inv.water - TRICK_COST <= 0) return false;
    husky.inv.food -= TRICK_COST;
    husky.inv.water -= TRICK_COST;
    AffectionSystem.applyAction(owner, 'trick');
    return true;
  },
  autoDump(husky: Husky, tile: Tile, owner: Owner): void {
    if (tile.type !== 'grass') return;
    while (husky.inv.poop >= POOP_MAX && tile.dirt + POOP_RATE <= POOP_MAX) {
      this.poop(husky, tile, owner);
    }
    while (husky.inv.pee >= PEE_MAX && tile.destruction + PEE_RATE <= PEE_MAX) {
      this.pee(husky, tile, owner);
    }
  },
};
