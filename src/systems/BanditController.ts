import type { Inventory } from '../types';
import type { Tile } from '../world/tiles';
import type { Owner } from '../entities/Owner';
import { config } from '../config/gameConfig';
import { ResourceSystem } from './ResourceSystem';
import { WorldActions } from './WorldActions';

export interface BanditTickInput {
  inv: Inventory;
  tile: Tile;            // the tile Bandit is standing on
  owner: Owner;          // that tile's owner (for affection on a foul)
  waterAdjacent: boolean; // is Bandit next to a water tile?
}

// Bandit's stay-put commitment state machine (Phaser-free so it unit-tests
// directly). Each sim tick GameScene calls `tick(...)`; while Bandit is
// committed — drinking to a full refill, or fouling a yard until his need is
// spent — it returns `suppressMove: true` and GameScene holds him in place.
// He uses Blizzard's shared ResourceSystem/WorldActions at the same rates.
export class BanditController {
  private refilling = false;
  private relieving = false;

  private needsRelieve(inv: Inventory): boolean {
    return inv.poop >= config.BANDIT_RELIEVE_THRESHOLD || inv.pee >= config.BANDIT_RELIEVE_THRESHOLD;
  }

  // Drain both poop and pee once onto the current yard. Returns whether anything
  // actually drained (false once he's spent or the tile can take no more).
  private relieveOnce(input: BanditTickInput): boolean {
    const actor = { inv: input.inv };
    const pooped = WorldActions.poop(actor, input.tile, input.owner);
    const peed = WorldActions.pee(actor, input.tile, input.owner);
    return pooped || peed;
  }

  tick(input: BanditTickInput): { suppressMove: boolean } {
    const onGrass = input.tile.type === 'grass';

    // Relieving: continue an in-progress foul, or start one on a yard when the
    // need is high. Never started while a refill is in progress.
    if (this.relieving || (!this.refilling && onGrass && this.needsRelieve(input.inv))) {
      this.relieving = true;
      if (!this.relieveOnce(input)) this.relieving = false; // spent, or tile maxed
      return { suppressMove: this.relieving };
    }

    // Refilling: continue, or start when next to water below the cap. Never
    // started while a relieve is in progress (the relieve branch returns first).
    if (this.refilling || (input.waterAdjacent && input.inv.water < config.WATER_CAP)) {
      this.refilling = true;
      ResourceSystem.drink(input.inv);
      if (input.inv.water >= config.WATER_CAP) this.refilling = false;
      return { suppressMove: this.refilling };
    }

    return { suppressMove: false };
  }
}
