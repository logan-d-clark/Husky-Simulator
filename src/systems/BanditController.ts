import type { Inventory } from '../types';
import type { Tile } from '../world/tiles';
import type { Owner } from '../entities/Owner';
import { config } from '../config/gameConfig';
import { ResourceSystem } from './ResourceSystem';
import { WorldActions } from './WorldActions';
import { needsRelieve, isThirsty, canFoulTile, type BanditGoal, type WasteChannel } from './AISystem';

export interface BanditTickInput {
  inv: Inventory;
  tile: Tile; // the tile Bandit is standing on
  owner: Owner; // that tile's owner (for affection on a foul)
  waterAdjacent: boolean; // is Bandit next to a water tile?
  /** A deployed rawhide, when one exists. `reachable` is decided by the same
   *  BFS that moves him, so targeting and movement can't disagree. */
  rawhide?: { reachable: boolean; onIt: boolean } | null;
}

// What a rawhide interrupts, so it can be handed back intact.
interface SuspendedGoal {
  goal: BanditGoal;
  drainQueue: WasteChannel[];
  yardOwnerId: number | null;
}

// Bandit's three-mode brain (Phaser-free so it unit-tests directly). He is in
// exactly one of `treat` / `relief` / `water` at a time and stays there until
// that mode's exit condition fires — one field, so the modes can't overlap and
// there is no "which latch wins" logic to get wrong.
//
//   treat  → default; the AI's food/patrol chain.
//   relief → entered at a 100%-full channel; drains the full channels to empty
//            on ONE committed yard, ONE channel at a time, then back to treat.
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
  // Channels still to drain this episode, in order. He works the head of the
  // queue to empty before starting the next — one channel at a time, like
  // Blizzard. Empty queue outside relief.
  private drainQueue: WasteChannel[] = [];
  // Set only while a rawhide has pulled him off something.
  private suspended: SuspendedGoal | null = null;

  /** Bandit's current behaviour mode — GameScene reads this to route his
   *  movement and to label his HUD block. */
  currentGoal(): BanditGoal {
    return this.goal;
  }

  /** The waste channel he is draining right now, or null when not relieving.
   *  Drives both his tile targeting and his HUD label. */
  activeChannel(): WasteChannel | null {
    return this.drainQueue[0] ?? null;
  }

  /** The yard this relief episode is committed to, or null when not in relief
   *  (or not yet arrived at one). */
  committedYard(): number | null {
    return this.yardOwnerId;
  }

  /** Record the yard the AI settled on for this episode. Ignored outside relief
   *  so a stale commitment can't leak into the next one. */
  commitYard(ownerId: number): void {
    if (this.goal === 'relief') this.yardOwnerId = ownerId;
  }

  // Channels currently at 100%, poop before pee. Only a FULL channel earns a
  // trip: arriving with pee full and poop half-loaded drains the pee and leaves
  // the poop for its own trip later.
  private fullChannels(inv: Inventory): WasteChannel[] {
    const full: WasteChannel[] = [];
    if (inv.poop >= config.BANDIT_RELIEVE_THRESHOLD) full.push('poop');
    if (inv.pee >= config.BANDIT_RELIEVE_THRESHOLD) full.push('pee');
    return full;
  }

  // Drained past WorldActions' `> 1` floor — nothing left on this channel.
  private isDrained(inv: Inventory, channel: WasteChannel): boolean {
    return inv[channel] <= 1;
  }

  // Drain ONE channel onto the current yard. Blizzard's `action` holds a single
  // verb, so he can only poop or pee on a given tick; Bandit dropping both at
  // once cleared two bars in the time Blizzard clears one. Same rate, same
  // opportunity cost — while either dog stands here relieving, the other is out
  // collecting food.
  private drainActiveChannel(input: BanditTickInput): void {
    const actor = { inv: input.inv };
    if (this.drainQueue[0] === 'poop') WorldActions.poop(actor, input.tile, input.owner);
    else if (this.drainQueue[0] === 'pee') WorldActions.pee(actor, input.tile, input.owner);
  }

  // Retire a spent head channel and end the episode when nothing is left.
  //
  // Called both from `updateGoal` and immediately after a drain, so
  // `activeChannel()` never names a channel that is already empty. That window
  // matters: `buildRelieveTargets` filters tiles by the active channel, so a
  // spent one matches NOTHING — every tile fails `canPoop`'s `> 1` — and any
  // `shouldHold` in the rest of the frame would release him off the yard he is
  // mid-episode on. Same reasoning as water mode leaving in the tick it fills.
  //
  // Recomputes from what's full NOW rather than just shifting, so a channel that
  // filled mid-episode (heat pushes pee up while he stands here draining poop)
  // is picked up instead of stranded.
  private advanceQueue(inv: Inventory): void {
    if (this.drainQueue.length > 0 && this.isDrained(inv, this.drainQueue[0])) {
      this.drainQueue = this.fullChannels(inv).filter((c) => !this.isDrained(inv, c));
    }
    if (this.drainQueue.length === 0) {
      this.goal = 'treat';
      this.yardOwnerId = null;
    }
  }

  // The rawhide is the ONE thing that preempts a committed mode — that is the
  // point of the item, and dropping it mid-relief is exactly when a player wants
  // it to work. To keep that from costing the emptying guarantee it SUSPENDS
  // rather than cancels: whatever he was doing (and the drain queue and yard
  // that went with it) is handed back when the rawhide is gone, so a Bandit
  // pulled off a half-drained lawn returns to finish it.
  //
  // He only ever enters while the rawhide is reachable, and leaves the moment it
  // stops being — so an unreachable one (penned behind the gate, walled off by a
  // repeller) is simply ignored rather than latching him forever.
  private updateRawhide(rawhide: BanditTickInput['rawhide']): void {
    const available = !!rawhide && rawhide.reachable;
    if (available && this.goal !== 'rawhide') {
      this.suspended = { goal: this.goal, drainQueue: this.drainQueue, yardOwnerId: this.yardOwnerId };
      // Clear the live state as well as snapshotting it: while he is chewing he
      // is not relieving, and `activeChannel()` promises null when he isn't.
      this.goal = 'rawhide';
      this.drainQueue = [];
      this.yardOwnerId = null;
      return;
    }
    if (!available && this.goal === 'rawhide') {
      const prev = this.suspended ?? { goal: 'treat' as BanditGoal, drainQueue: [], yardOwnerId: null };
      this.goal = prev.goal;
      this.drainQueue = prev.drainQueue;
      this.yardOwnerId = prev.yardOwnerId;
      this.suspended = null;
    }
  }

  // Mode transitions. Only `treat` picks a new mode, so nothing preempts an
  // episode in progress; relief outranks water when both trigger at once.
  private updateGoal(inv: Inventory): void {
    if (this.goal === 'rawhide') return; // handled by updateRawhide
    if (this.goal === 'treat') {
      if (needsRelieve(inv)) {
        this.goal = 'relief';
        this.drainQueue = this.fullChannels(inv);
      } else if (isThirsty(inv)) this.goal = 'water';
      return;
    }
    if (this.goal === 'relief') this.advanceQueue(inv);
    // Water mode's exit is owned by `tick`, which leaves the instant he hits the
    // cap rather than a tick later — see the comment there.
  }

  // Side-effect-free mirror of `tick`'s hold decision, used to gate the movement
  // chain so he doesn't glide away from a commitment. Relief only holds him on
  // the yard the AI is targeting, so he travels to the most-liked yard rather
  // than fouling whatever grass is under his feet.
  shouldHold(input: BanditTickInput, onTargetYard: boolean): boolean {
    if (this.goal === 'rawhide') return !!input.rawhide?.onIt; // chewing: he doesn't budge
    if (this.goal === 'relief')
      return onTargetYard && canFoulTile(input.inv, input.tile, this.activeChannel());
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
    this.updateRawhide(input.rawhide);
    this.updateGoal(input.inv);

    // Rawhide: walk to it, then sit and chew. The eat countdown lives with the
    // deployed item in GameScene, which removes it when it's finished — at which
    // point `rawhide` goes null and updateRawhide hands his old mode back.
    if (this.goal === 'rawhide') return { suppressMove: !!input.rawhide?.onIt };

    // Relief: foul the current tile only when it's in the committed yard and it
    // can take it (hold + drain); otherwise release so he keeps travelling to
    // that yard's remaining tiles — or, once it saturates, to the next-best one.
    if (this.goal === 'relief') {
      if (onTargetYard() && canFoulTile(input.inv, input.tile, this.activeChannel())) {
        this.drainActiveChannel(input);
        this.advanceQueue(input.inv); // retire the channel in the SAME tick it empties
        return { suppressMove: this.goal === 'relief' }; // last drop? released now, like water at the cap
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
