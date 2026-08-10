import type { Tile } from '../world/tiles';
import type { Inventory } from '../types';
import type { Owner } from '../entities/Owner';
import { AffectionSystem } from './AffectionSystem';
import { config } from '../config/gameConfig';

// Any dog (Blizzard or Bandit) — both carry an inventory. Neighbors can't tell
// whose mess it is, so Bandit's poop/pee hits the owner's affection identically.
type Actor = { inv: Inventory };

export const WorldActions = {
  // Single source of truth for "would a poop/pee here actually drop something":
  // a grass tile, waste still above the floor, and room left on that channel.
  canPoop(actor: Actor, tile: Tile): boolean {
    return tile.type === 'grass' && actor.inv.poop > 1 && tile.dirt + config.POOP_RATE <= config.POOP_MAX;
  },
  canPee(actor: Actor, tile: Tile): boolean {
    return tile.type === 'grass' && actor.inv.pee > 1 && tile.destruction + config.PEE_RATE <= config.PEE_MAX;
  },
  poop(actor: Actor, tile: Tile, owner: Owner): boolean {
    if (!this.canPoop(actor, tile)) return false;
    actor.inv.poop = Math.max(0, actor.inv.poop - config.POOP_RATE);
    tile.dirt += config.POOP_RATE;
    AffectionSystem.applyAction(owner, 'poop');
    return true;
  },
  pee(actor: Actor, tile: Tile, owner: Owner): boolean {
    if (!this.canPee(actor, tile)) return false;
    actor.inv.pee = Math.max(0, actor.inv.pee - config.PEE_RATE);
    tile.destruction += config.PEE_RATE;
    AffectionSystem.applyAction(owner, 'pee');
    return true;
  },
  // Tricks buy affection with WATER, not food. Food is the score currency and
  // Bandit never tricks, so charging food here was the whole score-relevant
  // asymmetry between the dogs — everything else (movement, heat, digestion)
  // already costs them the same. Blizzard still pays: a tick standing still per
  // trick, plus the trips to a pond that refills it.
  // Each resource is only required when its own cost is non-zero, so a zero food
  // cost doesn't quietly keep blocking the trick at low food.
  trick(actor: Actor, tile: Tile, owner: Owner): boolean {
    if (tile.type !== 'grass') return false;
    if (config.TRICK_FOOD_COST > 0 && actor.inv.food - config.TRICK_FOOD_COST <= 0) return false;
    if (config.TRICK_WATER_COST > 0 && actor.inv.water - config.TRICK_WATER_COST <= 0) return false;
    actor.inv.food -= config.TRICK_FOOD_COST;
    actor.inv.water -= config.TRICK_WATER_COST;
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
