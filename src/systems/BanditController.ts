import type { Inventory } from '../types';
import type { Tile } from '../world/tiles';
import type { Owner } from '../entities/Owner';
import { config } from '../config/gameConfig';
import { ResourceSystem } from './ResourceSystem';
import { WorldActions } from './WorldActions';
import { needsRelieve } from './AISystem';

export interface BanditTickInput {
  inv: Inventory;
  tile: Tile;            // the tile Bandit is standing on
  owner: Owner;          // that tile's owner (for affection on a foul)
  waterAdjacent: boolean; // is Bandit next to a water tile?
}

// Bandit's stay-put commitment state machine (Phaser-free so it unit-tests
// directly). GameScene calls `tick(...)` once per sim tick to run the actual
// drink/foul (side effects) and get `suppressMove`; the movement chain consults
// the side-effect-free `shouldHold(...)` so a committed Bandit holds his tile
// (and doesn't glide off a yard mid-foul). He uses Blizzard's shared
// ResourceSystem/WorldActions at the same rates.
export class BanditController {
  private refilling = false;
  private relieving = false;

  // Drain both poop and pee once onto the current yard. Returns whether anything
  // actually drained (false once he's spent or the tile can take no more).
  private relieveOnce(input: BanditTickInput): boolean {
    const actor = { inv: input.inv };
    const pooped = WorldActions.poop(actor, input.tile, input.owner);
    const peed = WorldActions.pee(actor, input.tile, input.owner);
    return pooped || peed;
  }

  // Side-effect-free: would Bandit stay put on this tile this tick? Used to gate
  // the movement chain so he doesn't glide away from a commitment.
  shouldHold(input: BanditTickInput): boolean {
    if (this.relieving) return true;
    if (input.waterAdjacent && input.inv.water < config.WATER_CAP) return true;
    if (!this.refilling && input.tile.type === 'grass' && needsRelieve(input.inv)) return true;
    return false;
  }

  tick(input: BanditTickInput): { suppressMove: boolean } {
    const onGrass = input.tile.type === 'grass';

    // Relieving: continue an in-progress foul, or start one on a yard when the
    // need is high. Never started while a refill is in progress.
    if (this.relieving || (!this.refilling && onGrass && needsRelieve(input.inv))) {
      this.relieving = true;
      if (!this.relieveOnce(input)) this.relieving = false; // spent, or tile maxed
      return { suppressMove: this.relieving };
    }

    // Refilling: continue while still next to water and below the cap. The
    // waterAdjacent re-check aborts the commitment if he ever leaves the edge.
    if (this.refilling || (input.waterAdjacent && input.inv.water < config.WATER_CAP)) {
      const canDrink = input.waterAdjacent && input.inv.water < config.WATER_CAP;
      if (canDrink) { this.refilling = true; ResourceSystem.drink(input.inv); }
      if (!canDrink || input.inv.water >= config.WATER_CAP) this.refilling = false;
      return { suppressMove: this.refilling };
    }

    return { suppressMove: false };
  }
}
