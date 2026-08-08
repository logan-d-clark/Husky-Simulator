import type { Inventory } from '../types';
import type { Tile } from '../world/tiles';
import type { Owner } from '../entities/Owner';
import { config } from '../config/gameConfig';
import { ResourceSystem } from './ResourceSystem';
import { WorldActions } from './WorldActions';
import { needsRelieve, isThirsty, canFoulTile } from './AISystem';

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
  // Empty-out episode: turns on when his need crosses the go-relieve threshold,
  // and stays on until poop AND pee are both spent — so once he starts he fully
  // empties (spilling onto more tiles as they fill), even below the threshold.
  private emptying = false;

  /** True while Bandit is committed to fully emptying — GameScene reads this to
   *  keep building relieve targets and to tell the AI to keep heading to yards. */
  isEmptying(): boolean { return this.emptying; }

  // Drain both poop and pee once onto the current yard.
  private relieveOnce(input: BanditTickInput): void {
    const actor = { inv: input.inv };
    WorldActions.poop(actor, input.tile, input.owner);
    WorldActions.pee(actor, input.tile, input.owner);
  }

  // Should Bandit begin (or continue) a full refill here? He commits when he
  // arrives thirsty; the `refilling` latch then holds him until full. Keyed on
  // thirst — NOT `water < cap` — so the per-tick heat nibble can't re-trigger a
  // drink the instant he tops up (which would trap him at the water forever).
  private canStartRefill(input: BanditTickInput): boolean {
    return input.waterAdjacent && isThirsty(input.inv);
  }

  // Side-effect-free: would Bandit stay put on this tile this tick? Used to gate
  // the movement chain so he doesn't glide away from a commitment. He only holds
  // to foul when he's on the yard the AI is targeting (the highest-affection
  // reachable one) — so he travels to the most-liked yard rather than fouling
  // whatever grass is under his feet.
  shouldHold(input: BanditTickInput, onTargetYard: boolean): boolean {
    if (!this.refilling && (this.emptying || needsRelieve(input.inv)) && onTargetYard && canFoulTile(input.inv, input.tile)) return true;
    // Mirror tick: while emptying (and not already refilling) the refill branch is
    // never reached, so shouldHold must NOT hold him for a would-be refill either —
    // otherwise he'd be held at the water's edge while tick drinks/drains nothing.
    return this.refilling || (!this.emptying && this.canStartRefill(input));
  }

  tick(input: BanditTickInput, onTargetYard: boolean): { suppressMove: boolean } {
    // Empty-out episode latch: off once fully spent, on once the need is high.
    if (input.inv.poop <= 1 && input.inv.pee <= 1) this.emptying = false;
    else if (needsRelieve(input.inv)) this.emptying = true;

    // While emptying (and not mid-refill): foul the current tile only when it's
    // in the yard he's targeting and it can take it (hold + drain); otherwise
    // release so he keeps travelling to that yard's available tiles. He keeps
    // going until fully spent, spilling onto more of the yard's tiles as they fill.
    if (this.emptying && !this.refilling) {
      if (onTargetYard && canFoulTile(input.inv, input.tile)) {
        this.relieveOnce(input);
        return { suppressMove: true };
      }
      return { suppressMove: false };
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
