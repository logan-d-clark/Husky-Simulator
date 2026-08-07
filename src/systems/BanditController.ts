import type { Inventory } from '../types';
import type { Tile } from '../world/tiles';
import type { Owner } from '../entities/Owner';
import { config } from '../config/gameConfig';
import { ResourceSystem } from './ResourceSystem';
import { WorldActions } from './WorldActions';
import { needsRelieve, isThirsty } from './AISystem';

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

  // Whether a foul on this tile would actually accomplish anything — mirrors
  // relieveOnce's guards (WorldActions.poop/pee): he must still be holding
  // waste and the tile must have room. Prevents a stuck hold on a maxed yard.
  private canMakeProgress(input: BanditTickInput): boolean {
    const { tile, inv } = input;
    const canPoop = inv.poop > 1 && tile.dirt + config.POOP_RATE <= config.POOP_MAX;
    const canPee = inv.pee > 1 && tile.destruction + config.PEE_RATE <= config.PEE_MAX;
    return canPoop || canPee;
  }

  // Should Bandit begin a foul here? On a yard, need high, not mid-refill, and the
  // foul can actually make progress. Shared by shouldHold and tick so they agree.
  private canStartRelieve(input: BanditTickInput): boolean {
    return !this.refilling && input.tile.type === 'grass'
      && needsRelieve(input.inv) && this.canMakeProgress(input);
  }

  // Should Bandit begin (or continue) a full refill here? He commits when he
  // arrives thirsty; the `refilling` latch then holds him until full. Keyed on
  // thirst — NOT `water < cap` — so the per-tick heat nibble can't re-trigger a
  // drink the instant he tops up (which would trap him at the water forever).
  private canStartRefill(input: BanditTickInput): boolean {
    return input.waterAdjacent && isThirsty(input.inv);
  }

  // Side-effect-free: would Bandit stay put on this tile this tick? Used to gate
  // the movement chain so he doesn't glide away from a commitment.
  shouldHold(input: BanditTickInput): boolean {
    if (this.relieving || this.canStartRelieve(input)) return true;
    return this.refilling || this.canStartRefill(input);
  }

  tick(input: BanditTickInput): { suppressMove: boolean } {
    // Relieving: continue an in-progress foul, or start one on a yard when the
    // need is high and the tile can take it. Never started while refilling.
    if (this.relieving || this.canStartRelieve(input)) {
      this.relieving = true;
      if (!this.relieveOnce(input)) this.relieving = false; // spent, or tile maxed
      return { suppressMove: this.relieving };
    }

    // Refilling: start when he arrives thirsty, then drink each tick until full.
    if (this.refilling || this.canStartRefill(input)) {
      const canDrink = input.waterAdjacent && input.inv.water < config.WATER_CAP;
      if (canDrink) { this.refilling = true; ResourceSystem.drink(input.inv); }
      if (!canDrink || input.inv.water >= config.WATER_CAP) this.refilling = false;
      return { suppressMove: this.refilling };
    }

    return { suppressMove: false };
  }
}
