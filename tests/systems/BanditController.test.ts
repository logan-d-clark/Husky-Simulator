import { describe, it, expect, afterEach } from 'vitest';
import { BanditController } from '../../src/systems/BanditController';
import { ResourceSystem } from '../../src/systems/ResourceSystem';
import { WorldActions } from '../../src/systems/WorldActions';
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
});
