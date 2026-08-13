import { describe, it, expect, afterEach } from 'vitest';
import { BanditController } from '../../src/systems/BanditController';
import { ResourceSystem } from '../../src/systems/ResourceSystem';
import { WorldActions } from '../../src/systems/WorldActions';
import { banditGoalLabel } from '../../src/systems/AISystem';
import { Owner } from '../../src/entities/Owner';
import { emptyFences, type Tile } from '../../src/world/tiles';
import { config, resetConfig } from '../../src/config/gameConfig';
import type { Inventory } from '../../src/types';

afterEach(() => resetConfig());

const inv = (over: Partial<Inventory> = {}): Inventory => ({ food: 50, water: 50, poop: 0, pee: 0, ...over });
const owner = (affection: number): Owner =>
  new Owner({ id: 1, affection, sensitivity: 1, treatRateBase: 1, name: 'Test' });
const tile = (type: Tile['type']): Tile =>
  ({ col: 0, row: 0, type, ownerId: 1, fences: emptyFences(), heat: 0, dirt: 0, destruction: 0, foodPresent: false });

// Most tests exercise Bandit standing on the yard he's committed to. `tick`
// takes these as thunks (it resolves the yard only after the mode transition);
// `shouldHold` takes the resolved boolean.
const ON_TARGET = () => true, OFF_TARGET = () => false;
const ON = true, OFF = false;
const FULL = config.BANDIT_RELIEVE_THRESHOLD;   // 100% of a channel — his relief trigger
const THIRSTY = config.WATER_CAP * config.BANDIT_THIRST_FRACTION;

// Run ticks until he stops suppressing movement (or the guard trips), so tests
// can assert on the end state of a whole committed episode. Returns the total
// ticks run, INCLUDING the one that released him.
const runEpisode = (c: BanditController, input: () => Parameters<BanditController['tick']>[0], onTarget: () => boolean): number => {
  let ticks = 0;
  for (;;) {
    ticks++;
    if (!c.tick(input(), onTarget).suppressMove) return ticks;
    if (ticks > 1000) throw new Error('episode did not terminate');
  }
};

describe('BanditController — mode transitions', () => {
  it('starts in treat seeking', () => {
    expect(new BanditController().currentGoal()).toBe('treat');
  });

  it('stays in treat seeking below both triggers', () => {
    const c = new BanditController();
    c.tick({ inv: inv({ poop: FULL - 1, pee: FULL - 1, water: THIRSTY + 1 }), tile: tile('grass'), owner: owner(80), waterAdjacent: true }, ON_TARGET);
    expect(c.currentGoal()).toBe('treat');
  });

  it('enters relief at a full poop channel', () => {
    const c = new BanditController();
    c.tick({ inv: inv({ poop: FULL }), tile: tile('pavement'), owner: owner(80), waterAdjacent: false }, OFF_TARGET);
    expect(c.currentGoal()).toBe('relief');
  });

  it('enters relief at a full pee channel alone', () => {
    const c = new BanditController();
    c.tick({ inv: inv({ pee: FULL }), tile: tile('pavement'), owner: owner(80), waterAdjacent: false }, OFF_TARGET);
    expect(c.currentGoal()).toBe('relief');
  });

  it('enters water mode at the thirst threshold', () => {
    const c = new BanditController();
    c.tick({ inv: inv({ water: THIRSTY }), tile: tile('pavement'), owner: owner(80), waterAdjacent: false }, OFF_TARGET);
    expect(c.currentGoal()).toBe('water');
  });

  it('relief outranks water when both trigger on the same tick', () => {
    const c = new BanditController();
    c.tick({ inv: inv({ poop: FULL, water: 1 }), tile: tile('pavement'), owner: owner(80), waterAdjacent: false }, OFF_TARGET);
    expect(c.currentGoal()).toBe('relief');
  });

  it('does not interrupt a relief episode when thirst arrives mid-way', () => {
    const c = new BanditController();
    const i = inv({ poop: FULL });
    c.tick({ inv: i, tile: tile('grass'), owner: owner(80), waterAdjacent: false }, ON_TARGET);
    i.water = 1; // now desperately thirsty
    const res = c.tick({ inv: i, tile: tile('grass'), owner: owner(80), waterAdjacent: true }, ON_TARGET);
    expect(c.currentGoal()).toBe('relief');
    expect(res.suppressMove).toBe(true);
    expect(i.water).toBe(1); // did NOT drink
  });

  it('does not interrupt a refill when a full channel arrives mid-drink', () => {
    const c = new BanditController();
    const i = inv({ water: THIRSTY });
    c.tick({ inv: i, tile: tile('grass'), owner: owner(80), waterAdjacent: true }, ON_TARGET);
    i.poop = FULL;
    const res = c.tick({ inv: i, tile: tile('grass'), owner: owner(80), waterAdjacent: true }, ON_TARGET);
    expect(c.currentGoal()).toBe('water');
    expect(res.suppressMove).toBe(true);
    expect(i.poop).toBe(FULL); // NOT drained — still drinking
  });
});

describe('BanditController — relief mode', () => {
  it('empties a full poop channel completely, then returns to treat seeking', () => {
    const c = new BanditController();
    const i = inv({ poop: FULL, pee: 0 });
    const t = tile('grass');
    runEpisode(c, () => ({ inv: i, tile: t, owner: owner(80), waterAdjacent: false }), ON_TARGET);
    expect(i.poop).toBe(1);         // WorldActions' drain floor: fully spent
    expect(c.currentGoal()).toBe('treat');
    expect(c.committedYard()).toBeNull();
  });

  it('empties BOTH channels in one trip when both are full', () => {
    const c = new BanditController();
    const i = inv({ poop: FULL, pee: FULL });
    const t = tile('grass');
    runEpisode(c, () => ({ inv: i, tile: t, owner: owner(500), waterAdjacent: false }), ON_TARGET);
    expect(i.poop).toBe(1);
    expect(i.pee).toBe(1);
    expect(c.currentGoal()).toBe('treat');
  });

  it('drains only ONE channel per tick — never both', () => {
    const c = new BanditController();
    const i = inv({ poop: FULL, pee: FULL });
    const t = tile('grass');
    for (let n = 0; n < 20; n++) {
      const before = { poop: i.poop, pee: i.pee };
      c.tick({ inv: i, tile: t, owner: owner(500), waterAdjacent: false }, ON_TARGET);
      const moved = [i.poop !== before.poop, i.pee !== before.pee].filter(Boolean).length;
      expect(moved).toBe(1);
    }
  });

  it('costs him the same ticks it would cost Blizzard to drain both bars', () => {
    // The whole point: Blizzard's `action` holds one verb, so he drains one
    // channel at 1 unit/tick. Bandit must pay the same, or he clears two bars
    // while Blizzard clears one — free time on the map.
    const c = new BanditController();
    const i = inv({ poop: FULL, pee: FULL });
    const t = tile('grass');
    const ticks = runEpisode(c, () => ({ inv: i, tile: t, owner: owner(500), waterAdjacent: false }), ON_TARGET);
    // Blizzard's cost: (bar - drain floor) / rate, summed per bar. Each channel
    // is derived from ITS own rate — POOP_RATE and PEE_RATE are independent
    // knobs that merely happen to both be 1, so doubling one would make this
    // assertion fail on a legitimate retune of the other.
    expect(ticks).toBe((FULL - 1) / config.POOP_RATE + (FULL - 1) / config.PEE_RATE);
  });

  it('keeps shouldHold and tick agreeing on the tick a channel empties', () => {
    // Regression: the queue used to advance at the top of the NEXT tick, so for
    // the rest of this frame activeChannel() still named the spent channel.
    // buildRelieveTargets filters by that channel and a spent one matches no
    // tile at all, so a shouldHold later in the frame (the arrival tween's
    // onComplete calls tryChiStep) released him off the yard mid-episode.
    const c = new BanditController();
    const i = inv({ poop: FULL, pee: FULL }); // both full -> queue is [poop, pee]
    const t = tile('grass');
    c.tick({ inv: i, tile: t, owner: owner(500), waterAdjacent: false }, ON_TARGET);
    c.commitYard(1);
    expect(c.activeChannel()).toBe('poop');
    i.poop = 2; // wind him to one drop from empty
    const input = { inv: i, tile: t, owner: owner(500), waterAdjacent: false };

    const suppressed = c.tick(input, ON_TARGET).suppressMove; // drains poop 2 -> 1
    expect(i.poop).toBe(1);
    expect(c.activeChannel()).toBe('pee');   // handed over in the SAME tick
    expect(c.shouldHold(input, ON)).toBe(suppressed); // ...so the two still agree
    expect(suppressed).toBe(true);           // still relieving — he stays put
  });

  it('releases him in the tick his LAST channel empties, like water at the cap', () => {
    const c = new BanditController();
    const i = inv({ poop: FULL, pee: 0 });
    const t = tile('grass');
    c.tick({ inv: i, tile: t, owner: owner(500), waterAdjacent: false }, ON_TARGET);
    i.poop = 2;
    const input = { inv: i, tile: t, owner: owner(500), waterAdjacent: false };
    const suppressed = c.tick(input, ON_TARGET).suppressMove;
    expect(i.poop).toBe(1);
    expect(c.currentGoal()).toBe('treat');            // episode ended in this tick
    expect(c.activeChannel()).toBeNull();
    expect(suppressed).toBe(false);                   // free to move immediately
    expect(c.shouldHold(input, ON)).toBe(suppressed); // and the pair still agrees
  });

  it('drains poop fully before starting on pee', () => {
    const c = new BanditController();
    const i = inv({ poop: FULL, pee: FULL });
    const t = tile('grass');
    c.tick({ inv: i, tile: t, owner: owner(500), waterAdjacent: false }, ON_TARGET);
    expect(c.activeChannel()).toBe('poop');
    while (i.poop > 1) c.tick({ inv: i, tile: t, owner: owner(500), waterAdjacent: false }, ON_TARGET);
    expect(i.pee).toBe(FULL); // poop finished before a single drop of pee

    // The next tick hands over to pee.
    c.tick({ inv: i, tile: t, owner: owner(500), waterAdjacent: false }, ON_TARGET);
    expect(c.activeChannel()).toBe('pee');
    expect(i.pee).toBe(FULL - config.PEE_RATE);
  });

  it('a pee-triggered trip drains pee only and leaves the poop alone', () => {
    // The reported bug's other half: he used to drain both, so a full pee bar
    // also emptied a part-loaded poop bar that had not earned a trip.
    const c = new BanditController();
    const i = inv({ poop: 40, pee: FULL });
    const t = tile('grass');
    c.tick({ inv: i, tile: t, owner: owner(500), waterAdjacent: false }, ON_TARGET);
    expect(c.activeChannel()).toBe('pee'); // NOT poop — poop is not full
    runEpisode(c, () => ({ inv: i, tile: t, owner: owner(500), waterAdjacent: false }), ON_TARGET);
    expect(i.pee).toBe(1);
    expect(i.poop).toBe(40);   // untouched
    expect(c.currentGoal()).toBe('treat');
    expect(c.activeChannel()).toBeNull();
  });

  it('picks up a channel that fills mid-episode instead of stranding it', () => {
    // He stands still to drain poop; heat keeps pushing his pee up. If it tops
    // out before he finishes, it should be drained on this trip, not deferred.
    const c = new BanditController();
    const i = inv({ poop: FULL, pee: 0 });
    const t = tile('grass');
    c.tick({ inv: i, tile: t, owner: owner(500), waterAdjacent: false }, ON_TARGET);
    i.pee = FULL; // heat topped him out while he was busy
    runEpisode(c, () => ({ inv: i, tile: t, owner: owner(500), waterAdjacent: false }), ON_TARGET);
    expect(i.poop).toBe(1);
    expect(i.pee).toBe(1);
  });

  it('reports no active channel outside relief', () => {
    const c = new BanditController();
    expect(c.activeChannel()).toBeNull();
    c.tick({ inv: inv({ water: THIRSTY }), tile: tile('pavement'), owner: owner(80), waterAdjacent: false }, OFF_TARGET);
    expect(c.currentGoal()).toBe('water');
    expect(c.activeChannel()).toBeNull();
  });

  it('labels the trip by the channel he is draining, not by what he carries', () => {
    // The reported bug end to end: pee full, poop part-loaded. The old label
    // sniffed `inv.poop > 1` and so read "Need to Poop!" on a pee trip.
    const c = new BanditController();
    const i = inv({ poop: 40, pee: FULL });
    c.tick({ inv: i, tile: tile('grass'), owner: owner(500), waterAdjacent: false }, ON_TARGET);
    expect(banditGoalLabel(c.currentGoal(), c.activeChannel())).toBe('Need to Pee!');
  });

  it('stays in relief far below the trigger until fully spent', () => {
    const c = new BanditController();
    const i = inv({ poop: FULL });
    c.tick({ inv: i, tile: tile('grass'), owner: owner(80), waterAdjacent: false }, ON_TARGET);
    i.poop = 5; // way below the trigger, but not empty
    c.tick({ inv: i, tile: tile('pavement'), owner: owner(80), waterAdjacent: false }, OFF_TARGET);
    expect(c.currentGoal()).toBe('relief');
  });

  it('holds its yard commitment for the whole episode', () => {
    const c = new BanditController();
    const i = inv({ poop: FULL });
    c.tick({ inv: i, tile: tile('grass'), owner: owner(80), waterAdjacent: false }, ON_TARGET);
    c.commitYard(7);
    c.commitYard(9); // the AI may re-report the same yard each tick; last write wins
    expect(c.committedYard()).toBe(9);
  });

  it('resumes draining on the new yard after a mid-episode hand-off', () => {
    // The committed yard saturates, the AI re-commits him to another owner, and
    // the episode must carry on there rather than ending half-full.
    const c = new BanditController();
    const i = inv({ poop: FULL, pee: 0 });
    const yardA: Tile = { ...tile('grass'), ownerId: 4 };
    const ownerA = owner(80);
    c.tick({ inv: i, tile: yardA, owner: ownerA, waterAdjacent: false }, ON_TARGET);
    c.commitYard(4);
    expect(i.poop).toBe(FULL - config.POOP_RATE);

    // Yard A is now saturated; he walks off it, still in relief, still full.
    const saturated: Tile = { ...yardA, dirt: config.POOP_MAX };
    expect(c.tick({ inv: i, tile: saturated, owner: ownerA, waterAdjacent: false }, ON_TARGET).suppressMove).toBe(false);
    expect(c.currentGoal()).toBe('relief');

    // The AI hands him to yard B; he drains there and finishes the episode on it.
    c.commitYard(5);
    const yardB: Tile = { ...tile('grass'), ownerId: 5 };
    const ownerB = owner(90);
    runEpisode(c, () => ({ inv: i, tile: yardB, owner: ownerB, waterAdjacent: false }), ON_TARGET);
    expect(i.poop).toBe(1);
    expect(c.committedYard()).toBeNull();       // episode over, commitment cleared
    expect(c.currentGoal()).toBe('treat');
    expect(ownerB.affection).toBeLessThan(90);  // the new yard took the rest of it
  });

  it('drains the channel a tile can still take when the other is capacity-blocked', () => {
    // Tile has poop room but no pee room. He must not stall holding both: poop
    // drains here, then he releases to find a tile that can take the pee.
    const c = new BanditController();
    const i = inv({ poop: FULL, pee: FULL });
    const t: Tile = { ...tile('grass'), destruction: config.PEE_MAX };
    runEpisode(c, () => ({ inv: i, tile: t, owner: owner(500), waterAdjacent: false }), ON_TARGET);
    expect(i.poop).toBe(1);                  // fully drained the channel it could
    expect(i.pee).toBe(FULL);                // pee untouched — no room here
    expect(c.currentGoal()).toBe('relief');  // episode continues; he travels on
  });

  it('ignores a yard commitment outside relief, so none leaks into the next episode', () => {
    const c = new BanditController();
    c.commitYard(7);
    expect(c.committedYard()).toBeNull();
  });

  it('does not foul a foulable tile that is NOT his committed yard — he travels on', () => {
    const c = new BanditController();
    const i = inv({ poop: FULL });
    const res = c.tick({ inv: i, tile: tile('grass'), owner: owner(80), waterAdjacent: false }, OFF_TARGET);
    expect(res.suppressMove).toBe(false);      // released to travel
    expect(i.poop).toBe(FULL);                 // did NOT foul here
    expect(c.currentGoal()).toBe('relief');    // still committed
  });

  it('does not relieve on a non-grass tile', () => {
    const c = new BanditController();
    const i = inv({ poop: FULL, pee: FULL });
    const res = c.tick({ inv: i, tile: tile('pavement'), owner: owner(80), waterAdjacent: false }, ON_TARGET);
    expect(res.suppressMove).toBe(false);
    expect(i.poop).toBe(FULL);
  });

  it('releases on a maxed tile without ending the episode (he walks to the next one)', () => {
    const c = new BanditController();
    const i = inv({ poop: FULL, pee: 0 });
    expect(c.tick({ inv: i, tile: tile('grass'), owner: owner(80), waterAdjacent: false }, ON_TARGET).suppressMove).toBe(true);
    expect(i.poop).toBe(FULL - config.POOP_RATE);
    const maxed: Tile = { ...tile('grass'), dirt: config.POOP_MAX };
    const res = c.tick({ inv: i, tile: maxed, owner: owner(80), waterAdjacent: false }, ON_TARGET);
    expect(res.suppressMove).toBe(false);
    expect(c.currentGoal()).toBe('relief');
  });

  it('drops poop and owner affection by the same amount as Blizzard would', () => {
    const c = new BanditController();
    const bOwner = owner(80);
    const bInv = inv({ poop: FULL, pee: 0 });
    c.tick({ inv: bInv, tile: tile('grass'), owner: bOwner, waterAdjacent: false }, ON_TARGET);
    const zOwner = owner(80);
    const zInv = inv({ poop: FULL, pee: 0 });
    WorldActions.poop({ inv: zInv }, tile('grass'), zOwner);
    expect(bInv.poop).toBe(zInv.poop);
    expect(bOwner.affection).toBe(zOwner.affection);
  });
});

describe('BanditController — water mode', () => {
  it('drinks to a full refill, suppressing movement until the cap', () => {
    const c = new BanditController();
    const i = inv({ water: THIRSTY });
    const ticks = runEpisode(c, () => ({ inv: i, tile: tile('pavement'), owner: owner(80), waterAdjacent: true }), OFF_TARGET);
    expect(i.water).toBe(config.WATER_CAP);
    // Exactly the sips the gap requires — not merely "more than one".
    expect(ticks).toBe(Math.ceil((config.WATER_CAP - THIRSTY) / config.WATER_VALUE));
  });

  it('returns to treat seeking once full', () => {
    const c = new BanditController();
    const i = inv({ water: THIRSTY });
    runEpisode(c, () => ({ inv: i, tile: tile('pavement'), owner: owner(80), waterAdjacent: true }), OFF_TARGET);
    c.tick({ inv: i, tile: tile('pavement'), owner: owner(80), waterAdjacent: true }, OFF_TARGET);
    expect(c.currentGoal()).toBe('treat');
  });

  it('gains exactly WATER_VALUE on a drinking tick (same as Blizzard)', () => {
    const c = new BanditController();
    const bInv = inv({ water: THIRSTY });
    c.tick({ inv: bInv, tile: tile('pavement'), owner: owner(80), waterAdjacent: true }, OFF_TARGET);
    const zInv = inv({ water: THIRSTY });
    ResourceSystem.drink(zInv);
    expect(bInv.water).toBe(zInv.water);
  });

  it('does not linger at water when already full', () => {
    const c = new BanditController();
    const i = inv({ water: config.WATER_CAP });
    const res = c.tick({ inv: i, tile: tile('pavement'), owner: owner(80), waterAdjacent: true }, OFF_TARGET);
    expect(res.suppressMove).toBe(false);
    expect(i.water).toBe(config.WATER_CAP);
  });

  it('a heat nibble below the cap does not re-trigger a refill', () => {
    const c = new BanditController();
    const i = inv({ water: THIRSTY });
    runEpisode(c, () => ({ inv: i, tile: tile('pavement'), owner: owner(80), waterAdjacent: true }), OFF_TARGET);
    i.water = config.WATER_CAP - 0.05;
    const input = { inv: i, tile: tile('pavement'), owner: owner(80), waterAdjacent: true };
    expect(c.tick(input, OFF_TARGET).suppressMove).toBe(false);
    expect(c.shouldHold(input, OFF)).toBe(false);
    expect(i.water).toBe(config.WATER_CAP - 0.05); // did not drink
  });

  it('does not freeze away from water while thirsty — he travels', () => {
    const c = new BanditController();
    const i = inv({ water: THIRSTY });
    const input = { inv: i, tile: tile('pavement'), owner: owner(80), waterAdjacent: false };
    expect(c.tick(input, OFF_TARGET).suppressMove).toBe(false);
    expect(c.shouldHold(input, OFF)).toBe(false);
  });
});

describe('BanditController — shouldHold (movement gate) mirrors tick', () => {
  const relieving = (c: BanditController, i: Inventory) =>
    c.tick({ inv: i, tile: tile('pavement'), owner: owner(50), waterAdjacent: false }, OFF_TARGET);

  // The whole point of shouldHold is to answer tick's hold decision WITHOUT the
  // side effects. If the two ever disagree he either freezes on the spot or
  // glides away mid-action — both have shipped as bugs before. So every case
  // asserts the pair agrees on identical input, never shouldHold alone.
  const bothAgree = (c: BanditController, input: Parameters<BanditController['shouldHold']>[0], onTarget: boolean, expected: boolean) => {
    expect(c.shouldHold(input, onTarget)).toBe(expected);
    expect(c.tick(input, () => onTarget).suppressMove).toBe(expected);
  };

  it('holds on his committed yard while in relief', () => {
    const c = new BanditController();
    const i = inv({ poop: FULL });
    relieving(c, i);
    bothAgree(c, { inv: i, tile: tile('grass'), owner: owner(50), waterAdjacent: false }, ON, true);
  });

  it('does not hold on a foulable yard that is not his committed one', () => {
    const c = new BanditController();
    const i = inv({ poop: FULL });
    relieving(c, i);
    bothAgree(c, { inv: i, tile: tile('grass'), owner: owner(50), waterAdjacent: false }, OFF, false);
  });

  it('does not hold him at the water while in relief (no drink, no drain, no freeze)', () => {
    const c = new BanditController();
    const i = inv({ poop: FULL, water: 5 });
    relieving(c, i);
    bothAgree(c, { inv: i, tile: tile('pavement'), owner: owner(50), waterAdjacent: true }, OFF, false);
    expect(i.water).toBe(5);
  });

  it('holds next to water while in water mode', () => {
    const c = new BanditController();
    const i = inv({ water: THIRSTY });
    c.tick({ inv: i, tile: tile('pavement'), owner: owner(50), waterAdjacent: false }, OFF_TARGET);
    bothAgree(c, { inv: i, tile: tile('pavement'), owner: owner(50), waterAdjacent: true }, OFF, true);
  });

  it('never holds in treat seeking', () => {
    const c = new BanditController();
    const input = { inv: inv({ water: config.WATER_CAP }), tile: tile('grass'), owner: owner(50), waterAdjacent: true };
    bothAgree(c, input, ON, false);
  });

  it('does not trap him on a fully-maxed target tile (no progress possible)', () => {
    const c = new BanditController();
    const i = inv({ poop: FULL, pee: FULL });
    relieving(c, i);
    const maxed: Tile = { ...tile('grass'), dirt: config.POOP_MAX, destruction: config.PEE_MAX };
    bothAgree(c, { inv: i, tile: maxed, owner: owner(80), waterAdjacent: false }, ON, false);
  });

  it('will not hold on a tile that cannot take the channel he is draining', () => {
    // Dirt maxed, pee room to spare — useless to a Bandit draining poop. He must
    // release and walk on rather than stand on a tile he cannot use.
    const c = new BanditController();
    const i = inv({ poop: FULL, pee: FULL });
    relieving(c, i);
    expect(c.activeChannel()).toBe('poop');
    const dirtMaxed: Tile = { ...tile('grass'), dirt: config.POOP_MAX };
    bothAgree(c, { inv: i, tile: dirtMaxed, owner: owner(500), waterAdjacent: false }, ON, false);
  });
});

describe('BanditController — rawhide (the one thing that preempts him)', () => {
  const bait = (over: Partial<{ reachable: boolean; onIt: boolean }> = {}) =>
    ({ reachable: true, onIt: false, ...over });
  const input = (i: Inventory, rawhide: { reachable: boolean; onIt: boolean } | null, tileType: Tile['type'] = 'grass') =>
    ({ inv: i, tile: tile(tileType), owner: owner(80), waterAdjacent: false, rawhide });

  it('pulls him out of treat seeking', () => {
    const c = new BanditController();
    c.tick(input(inv(), bait()), OFF_TARGET);
    expect(c.currentGoal()).toBe('rawhide');
  });

  it('preempts a committed relief episode — the whole point of the item', () => {
    const c = new BanditController();
    const i = inv({ poop: FULL });
    c.tick(input(i, null), ON_TARGET);
    expect(c.currentGoal()).toBe('relief');
    c.tick(input(i, bait()), ON_TARGET);
    expect(c.currentGoal()).toBe('rawhide');
  });

  it('preempts a refill too', () => {
    const c = new BanditController();
    const i = inv({ water: THIRSTY });
    c.tick(input(i, null), OFF_TARGET);
    expect(c.currentGoal()).toBe('water');
    c.tick(input(i, bait()), OFF_TARGET);
    expect(c.currentGoal()).toBe('rawhide');
  });

  it('hands back the interrupted episode — same channel, same yard', () => {
    const c = new BanditController();
    const i = inv({ poop: FULL, pee: FULL });
    c.tick(input(i, null), ON_TARGET);
    c.commitYard(7);
    expect(c.currentGoal()).toBe('relief');
    expect(c.activeChannel()).toBe('poop');

    c.tick(input(i, bait()), ON_TARGET);          // dragged away mid-drain
    expect(c.currentGoal()).toBe('rawhide');
    expect(c.activeChannel()).toBeNull();         // not relieving while chewing

    c.tick(input(i, null), ON_TARGET);            // rawhide eaten and gone
    expect(c.currentGoal()).toBe('relief');
    expect(c.activeChannel()).toBe('poop');       // resumes the very same channel
    expect(c.committedYard()).toBe(7);            // ...on the very same lawn
  });

  it('never touches an unreachable rawhide, and does not latch on one', () => {
    // Penned behind the gate, or walled off by a repeller. If he committed to it
    // he would sit in a mode whose exit condition can never be met.
    const c = new BanditController();
    const i = inv({ poop: FULL });
    c.tick(input(i, bait({ reachable: false })), ON_TARGET);
    expect(c.currentGoal()).toBe('relief');
    expect(c.activeChannel()).toBe('poop');
  });

  it('lets go the moment it stops being reachable', () => {
    const c = new BanditController();
    const i = inv();
    c.tick(input(i, bait()), OFF_TARGET);
    expect(c.currentGoal()).toBe('rawhide');
    c.tick(input(i, bait({ reachable: false })), OFF_TARGET);
    expect(c.currentGoal()).toBe('treat');
  });

  it('travels while away from it and sits still once on it', () => {
    const c = new BanditController();
    const i = inv();
    expect(c.tick(input(i, bait({ onIt: false })), OFF_TARGET).suppressMove).toBe(false);
    expect(c.tick(input(i, bait({ onIt: true })), OFF_TARGET).suppressMove).toBe(true);
  });

  it('keeps shouldHold and tick agreeing in every rawhide case', () => {
    for (const onIt of [true, false]) {
      const c = new BanditController();
      const i = inv();
      const args = input(i, bait({ onIt }));
      const suppressed = c.tick(args, OFF_TARGET).suppressMove;
      expect(c.shouldHold(args, OFF)).toBe(suppressed);
    }
  });

  it('does not drain or drink while chewing', () => {
    const c = new BanditController();
    const i = inv({ poop: FULL, water: THIRSTY });
    const args = { ...input(i, bait({ onIt: true })), waterAdjacent: true };
    c.tick(args, ON_TARGET);
    expect(i.poop).toBe(FULL);       // no fouling the lawn he is chewing on
    expect(i.water).toBe(THIRSTY);   // and no drinking either
  });
});

describe('BanditController — rawhide does not lose the episode it interrupted', () => {
  const bait = { reachable: true, onIt: false };
  const chewing = { reachable: true, onIt: true };
  const args = (i: Inventory, rawhide: { reachable: boolean; onIt: boolean } | null) =>
    ({ inv: i, tile: tile('grass'), owner: owner(80), waterAdjacent: true, rawhide });

  it('keeps the ORIGINAL suspended episode across many chewing ticks', () => {
    // Regression guard: if updateRawhide ever re-snapshotted while already in
    // rawhide mode, the second tick would overwrite the real episode with the
    // empty rawhide state and he'd fall back to treat forever — silently losing
    // the emptying guarantee that is the whole point of suspend/restore.
    const c = new BanditController();
    const i = inv({ poop: FULL, pee: FULL });
    c.tick(args(i, null), ON_TARGET);
    c.commitYard(4);
    expect(c.currentGoal()).toBe('relief');

    c.tick(args(i, bait), ON_TARGET);           // pulled away
    for (let n = 0; n < 12; n++) c.tick(args(i, chewing), ON_TARGET); // walks up, chews
    expect(c.currentGoal()).toBe('rawhide');

    c.tick(args(i, null), ON_TARGET);           // finished it
    expect(c.currentGoal()).toBe('relief');
    expect(c.activeChannel()).toBe('poop');
    expect(c.committedYard()).toBe(4);
  });

  it('hands back a water episode too, not just relief', () => {
    const c = new BanditController();
    const i = inv({ water: THIRSTY });
    c.tick(args(i, null), OFF_TARGET);
    expect(c.currentGoal()).toBe('water');

    c.tick(args(i, bait), OFF_TARGET);
    for (let n = 0; n < 5; n++) c.tick(args(i, chewing), OFF_TARGET);
    expect(c.currentGoal()).toBe('rawhide');

    c.tick(args(i, null), OFF_TARGET);
    expect(c.currentGoal()).toBe('water');
  });

  it('drops him back to treat when he was only treat-seeking', () => {
    const c = new BanditController();
    const i = inv();
    c.tick(args(i, bait), OFF_TARGET);
    c.tick(args(i, null), OFF_TARGET);
    expect(c.currentGoal()).toBe('treat');
    expect(c.committedYard()).toBeNull();
  });
});
