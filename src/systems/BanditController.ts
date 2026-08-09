import type { Inventory } from '../types';
import type { Tile } from '../world/tiles';
import type { Owner } from '../entities/Owner';
import { config } from '../config/gameConfig';
import { ResourceSystem } from './ResourceSystem';
import { WorldActions } from './WorldActions';
import { needsRelieve, isThirsty, canFoulTile, type BanditGoal } from './AISystem';

export interface BanditTickInput {
  inv: Inventory;
  tile: Tile;            // the tile Bandit is standing on
  owner: Owner;          // that tile's owner (for affection on a foul)
  waterAdjacent: boolean; // is Bandit next to a water tile?
}

// Bandit's three-mode brain (Phaser-free so it unit-tests directly). He is in
// exactly one of `treat` / `relief` / `water` at a time and stays there until
// that mode's exit condition fires — one field, so the modes can't overlap and
// there is no "which latch wins" logic to get wrong.
//
//   treat  → default; the AI's food/patrol chain.
//   relief → entered at a 100%-full channel; drains every full channel to empty
//            on ONE committed yard, then back to treat.
//   water  → entered at/below BANDIT_THIRST_FRACTION of WATER_CAP; drinks to
//            WATER_CAP, then back to treat.
//
// GameScene calls `tick(...)` once per sim tick to run the actual drink/foul
// (side effects) and get `suppressMove`; the movement chain consults the
// side-effect-free `shouldHold(...)` so a committed Bandit holds his tile (and
// doesn't glide off a yard mid-foul). He uses Blizzard's shared
// ResourceSystem/WorldActions at the same rates.
export class BanditController {
  private goal: BanditGoal = 'treat';
  // The yard (owner id) this relief episode is committed to. Fouling drops that
  // owner's affection, so without a commitment he'd re-rank to a neighbour's
  // yard after a single drop and dribble across the block instead of emptying.
  private yardOwnerId: number | null = null;

  /** Bandit's current behaviour mode — GameScene reads this to route his
   *  movement and to label his HUD block. */
  currentGoal(): BanditGoal { return this.goal; }

  /** The yard this relief episode is committed to, or null when not in relief
   *  (or not yet arrived at one). */
  committedYard(): number | null { return this.yardOwnerId; }

  /** Record the yard the AI settled on for this episode. Ignored outside relief
   *  so a stale commitment can't leak into the next one. */
  commitYard(ownerId: number): void {
    if (this.goal === 'relief') this.yardOwnerId = ownerId;
  }

  // Both channels drained past WorldActions' `> 1` floor: the episode is done.
  private isEmpty(inv: Inventory): boolean {
    return inv.poop <= 1 && inv.pee <= 1;
  }

  // Drain poop and pee once onto the current yard. A channel that is already
  // empty (or a tile with no room on it) is a no-op via WorldActions' guards, so
  // this correctly empties one channel or both.
  private relieveOnce(input: BanditTickInput): void {
    const actor = { inv: input.inv };
    WorldActions.poop(actor, input.tile, input.owner);
    WorldActions.pee(actor, input.tile, input.owner);
  }

  // Mode transitions. Only `treat` picks a new mode, so nothing preempts an
  // episode in progress; relief outranks water when both trigger at once.
  private updateGoal(inv: Inventory): void {
    if (this.goal === 'treat') {
      if (needsRelieve(inv)) this.goal = 'relief';
      else if (isThirsty(inv)) this.goal = 'water';
      return;
    }
    if (this.goal === 'relief' && this.isEmpty(inv)) {
      this.goal = 'treat';
      this.yardOwnerId = null;
    }
    // Water mode's exit is owned by `tick`, which leaves the instant he hits the
    // cap rather than a tick later — see the comment there.
  }

  // Side-effect-free mirror of `tick`'s hold decision, used to gate the movement
  // chain so he doesn't glide away from a commitment. Relief only holds him on
  // the yard the AI is targeting, so he travels to the most-liked yard rather
  // than fouling whatever grass is under his feet.
  shouldHold(input: BanditTickInput, onTargetYard: boolean): boolean {
    if (this.goal === 'relief') return onTargetYard && canFoulTile(input.inv, input.tile);
    if (this.goal === 'water') return input.waterAdjacent && input.inv.water < config.WATER_CAP;
    return false;
  }

  // `onTargetYard` is a thunk, not a boolean, because the caller can only answer
  // it once the mode for THIS tick is known: it depends on the committed yard,
  // which `updateGoal` may set below. Passing a value computed before the call
  // would be stale on the tick he enters relief — costing a drain tick and
  // painting a walk frame on a dog that then holds still. Only relief evaluates
  // it, so the other two modes skip the caller's map scan entirely.
  tick(input: BanditTickInput, onTargetYard: () => boolean): { suppressMove: boolean } {
    this.updateGoal(input.inv);

    // Relief: foul the current tile only when it's in the committed yard and it
    // can take it (hold + drain); otherwise release so he keeps travelling to
    // that yard's remaining tiles — or, once it saturates, to the next-best one.
    if (this.goal === 'relief') {
      if (onTargetYard() && canFoulTile(input.inv, input.tile)) {
        this.relieveOnce(input);
        return { suppressMove: true };
      }
      return { suppressMove: false };
    }

    // Water: drink every tick he's beside water until he's back to the cap, then
    // leave water mode in the SAME tick. Exiting a tick later would let the
    // per-tick heat nibble drop him a hair under the cap while still in water
    // mode, and he'd drink again forever — only `isThirsty` may re-enter.
    if (this.goal === 'water') {
      const canDrink = input.waterAdjacent && input.inv.water < config.WATER_CAP;
      if (canDrink) ResourceSystem.drink(input.inv);
      if (input.inv.water >= config.WATER_CAP) {
        this.goal = 'treat';
        return { suppressMove: false };
      }
      return { suppressMove: canDrink };
    }

    return { suppressMove: false };
  }
}
