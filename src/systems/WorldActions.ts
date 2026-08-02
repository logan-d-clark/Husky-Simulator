import type { Tile } from '../world/tiles';
import type { Inventory } from '../types';
import type { Owner } from '../entities/Owner';
import { AffectionSystem } from './AffectionSystem';
import { config } from '../config/gameConfig';

// Any dog (Blizzard or Bandit) — both carry an inventory. Neighbors can't tell
// whose mess it is, so Bandit's poop/pee hits the owner's affection identically.
type Actor = { inv: Inventory };

export const WorldActions = {
  poop(actor: Actor, tile: Tile, owner: Owner): boolean {
    if (tile.type !== 'grass' || actor.inv.poop <= 1) return false;
    if (tile.dirt + config.POOP_RATE > config.POOP_MAX) return false;
    actor.inv.poop = Math.max(0, actor.inv.poop - config.POOP_RATE);
    tile.dirt += config.POOP_RATE;
    AffectionSystem.applyAction(owner, 'poop');
    return true;
  },
  pee(actor: Actor, tile: Tile, owner: Owner): boolean {
    if (tile.type !== 'grass' || actor.inv.pee <= 1) return false;
    if (tile.destruction + config.PEE_RATE > config.PEE_MAX) return false;
    actor.inv.pee = Math.max(0, actor.inv.pee - config.PEE_RATE);
    tile.destruction += config.PEE_RATE;
    AffectionSystem.applyAction(owner, 'pee');
    return true;
  },
  trick(actor: Actor, tile: Tile, owner: Owner): boolean {
    if (tile.type !== 'grass') return false;
    if (actor.inv.food - config.TRICK_COST <= 0 || actor.inv.water - config.TRICK_COST <= 0) return false;
    actor.inv.food -= config.TRICK_COST;
    actor.inv.water -= config.TRICK_COST;
    AffectionSystem.applyAction(owner, 'trick');
    return true;
  },
  autoDump(actor: Actor, tile: Tile, owner: Owner): void {
    if (tile.type !== 'grass') return;
    while (actor.inv.poop >= config.POOP_MAX && tile.dirt + config.POOP_RATE <= config.POOP_MAX) {
      this.poop(actor, tile, owner);
    }
    while (actor.inv.pee >= config.PEE_MAX && tile.destruction + config.PEE_RATE <= config.PEE_MAX) {
      this.pee(actor, tile, owner);
    }
  },
};
