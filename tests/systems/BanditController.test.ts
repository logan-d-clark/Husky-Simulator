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

// Most tests exercise Bandit standing on the yard he's targeting.
const ON_TARGET = true, OFF_TARGET = false;

describe('BanditController — water refill', () => {
  it('drinks to a full refill, suppressing movement until the cap', () => {
    const c = new BanditController();
    const i = inv({ water: 10 });
    let ticks = 0;
    let res = c.tick({ inv: i, tile: tile('pavement'), owner: owner(80), waterAdjacent: true }, OFF_TARGET);
    while (res.suppressMove) {
      ticks++;
      res = c.tick({ inv: i, tile: tile('pavement'), owner: owner(80), waterAdjacent: true }, OFF_TARGET);
    }
    expect(i.water).toBe(config.WATER_CAP);
    expect(ticks).toBeGreaterThan(1);
  });

  it('gains exactly WATER_VALUE on a drinking tick (same as Blizzard)', () => {
    const c = new BanditController();
    const bInv = inv({ water: 10 }); // thirsty
    c.tick({ inv: bInv, tile: tile('pavement'), owner: owner(80), waterAdjacent: true }, OFF_TARGET);
    const zInv = inv({ water: 10 });
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

  it('only drinks when thirsty — a heat nibble below the cap does not re-trigger a refill', () => {
    const c = new BanditController();
    const i = inv({ water: 10 });
    while (c.tick({ inv: i, tile: tile('pavement'), owner: owner(80), waterAdjacent: true }, OFF_TARGET).suppressMove) { /* fill */ }
    expect(i.water).toBe(config.WATER_CAP);
    i.water = config.WATER_CAP - 0.05;
    const input = { inv: i, tile: tile('pavement'), owner: owner(80), waterAdjacent: true };
    expect(c.tick(input, OFF_TARGET).suppressMove).toBe(false);
    expect(c.shouldHold(input, OFF_TARGET)).toBe(false);
    expect(i.water).toBe(config.WATER_CAP - 0.05); // did not drink
  });

  it('does not interrupt an in-progress refill when a relieve need arises', () => {
    const c = new BanditController();
    const i = inv({ water: 10, poop: 0 }); // thirsty
    c.tick({ inv: i, tile: tile('grass'), owner: owner(80), waterAdjacent: true }, ON_TARGET); // refill starts -> 20
    i.poop = config.BANDIT_RELIEVE_THRESHOLD + 20; // need crosses threshold mid-refill
    const res = c.tick({ inv: i, tile: tile('grass'), owner: owner(80), waterAdjacent: true }, ON_TARGET);
    expect(res.suppressMove).toBe(true);
    expect(i.poop).toBe(config.BANDIT_RELIEVE_THRESHOLD + 20); // NOT drained — still refilling
    expect(i.water).toBe(30); // kept drinking (10 -> 20 -> 30)
  });
});

describe('BanditController — relieving', () => {
  it('poops and pees on the target yard until spent, dropping owner affection, then releases', () => {
    const c = new BanditController();
    const o = owner(80);
    const i = inv({ poop: 32, pee: 31 });
    let res = c.tick({ inv: i, tile: tile('grass'), owner: o, waterAdjacent: false }, ON_TARGET);
    while (res.suppressMove) {
      res = c.tick({ inv: i, tile: tile('grass'), owner: o, waterAdjacent: false }, ON_TARGET);
    }
    expect(i.poop).toBe(1);
    expect(i.pee).toBe(1);
    expect(o.affection).toBe(80 - 31 - 30);
  });

  it('does not interrupt an in-progress relieve when thirst arises', () => {
    const c = new BanditController();
    const i = inv({ water: 5, poop: config.BANDIT_RELIEVE_THRESHOLD }); // thirsty AND high need
    const res = c.tick({ inv: i, tile: tile('grass'), owner: owner(80), waterAdjacent: true }, ON_TARGET);
    expect(res.suppressMove).toBe(true);
    expect(i.poop).toBe(config.BANDIT_RELIEVE_THRESHOLD - 1); // relieved
    expect(i.water).toBe(5); // did NOT drink — relieve wasn't interrupted
  });

  it('drops poop and owner affection by the same amount as Blizzard would', () => {
    const c = new BanditController();
    const bOwner = owner(80);
    const bInv = inv({ poop: config.BANDIT_RELIEVE_THRESHOLD, pee: 0 });
    c.tick({ inv: bInv, tile: tile('grass'), owner: bOwner, waterAdjacent: false }, ON_TARGET);
    const zOwner = owner(80);
    const zInv = inv({ poop: config.BANDIT_RELIEVE_THRESHOLD, pee: 0 });
    WorldActions.poop({ inv: zInv }, tile('grass'), zOwner);
    expect(bInv.poop).toBe(zInv.poop);
    expect(bOwner.affection).toBe(zOwner.affection);
  });

  it('does not relieve on a non-grass tile', () => {
    const c = new BanditController();
    const i = inv({ poop: config.BANDIT_RELIEVE_THRESHOLD, pee: config.BANDIT_RELIEVE_THRESHOLD });
    const res = c.tick({ inv: i, tile: tile('pavement'), owner: owner(80), waterAdjacent: false }, ON_TARGET);
    expect(res.suppressMove).toBe(false);
    expect(i.poop).toBe(config.BANDIT_RELIEVE_THRESHOLD); // untouched
  });

  it('does not foul a foulable tile that is NOT his target yard — he travels on', () => {
    const c = new BanditController();
    const i = inv({ poop: config.BANDIT_RELIEVE_THRESHOLD });
    // a perfectly foulable grass tile, but it's not the yard he's targeting
    const res = c.tick({ inv: i, tile: tile('grass'), owner: owner(80), waterAdjacent: false }, OFF_TARGET);
    expect(res.suppressMove).toBe(false);                      // release to travel to the target yard
    expect(i.poop).toBe(config.BANDIT_RELIEVE_THRESHOLD);      // did NOT foul here
    expect(c.isEmptying()).toBe(true);                         // still committed to emptying
  });
});

describe('BanditController — shouldHold (movement gate)', () => {
  it('holds on his target yard when the need is high', () => {
    const c = new BanditController();
    expect(c.shouldHold({ inv: inv({ poop: config.BANDIT_RELIEVE_THRESHOLD }), tile: tile('grass'), owner: owner(50), waterAdjacent: false }, ON_TARGET)).toBe(true);
  });
  it('does not hold on a foulable yard that is not his target', () => {
    const c = new BanditController();
    expect(c.shouldHold({ inv: inv({ poop: config.BANDIT_RELIEVE_THRESHOLD }), tile: tile('grass'), owner: owner(50), waterAdjacent: false }, OFF_TARGET)).toBe(false);
  });
  it('holds next to water while thirsty', () => {
    const c = new BanditController();
    expect(c.shouldHold({ inv: inv({ water: 10 }), tile: tile('pavement'), owner: owner(50), waterAdjacent: true }, OFF_TARGET)).toBe(true);
  });
  it('does not hold next to water when not thirsty (topped up)', () => {
    const c = new BanditController();
    expect(c.shouldHold({ inv: inv({ water: config.WATER_CAP - 0.05 }), tile: tile('pavement'), owner: owner(50), waterAdjacent: true }, OFF_TARGET)).toBe(false);
  });
  it('does not hold on pavement with a low need and full water', () => {
    const c = new BanditController();
    expect(c.shouldHold({ inv: inv({ water: config.WATER_CAP }), tile: tile('pavement'), owner: owner(50), waterAdjacent: true }, ON_TARGET)).toBe(false);
  });
  it('does not hold on his target yard once the need is spent', () => {
    const c = new BanditController();
    expect(c.shouldHold({ inv: inv({ poop: 0, pee: 0 }), tile: tile('grass'), owner: owner(50), waterAdjacent: false }, ON_TARGET)).toBe(false);
  });
});

describe('BanditController — empty-out episode', () => {
  it('turns on at the threshold and stays on below it until fully spent', () => {
    const c = new BanditController();
    const i = inv({ poop: 0, pee: config.BANDIT_RELIEVE_THRESHOLD });
    c.tick({ inv: i, tile: tile('grass'), owner: owner(80), waterAdjacent: false }, ON_TARGET);
    expect(c.isEmptying()).toBe(true);
    // his remaining pee falls below the threshold (a tile filled) — still emptying, now travelling
    i.pee = 20;
    c.tick({ inv: i, tile: tile('pavement'), owner: owner(80), waterAdjacent: false }, OFF_TARGET);
    expect(c.isEmptying()).toBe(true);
    // fully spent → episode ends
    i.poop = 1; i.pee = 1;
    c.tick({ inv: i, tile: tile('grass'), owner: owner(80), waterAdjacent: false }, ON_TARGET);
    expect(c.isEmptying()).toBe(false);
  });

  it('holds+fouls a foulable target tile, releases on a maxed one without ending the episode', () => {
    const c = new BanditController();
    const i = inv({ poop: config.BANDIT_RELIEVE_THRESHOLD, pee: 0 });
    const r1 = c.tick({ inv: i, tile: tile('grass'), owner: owner(80), waterAdjacent: false }, ON_TARGET);
    expect(r1.suppressMove).toBe(true);
    expect(i.poop).toBe(config.BANDIT_RELIEVE_THRESHOLD - 1); // drained one
    const maxed: Tile = { ...tile('grass'), dirt: config.POOP_MAX };
    const r2 = c.tick({ inv: i, tile: maxed, owner: owner(80), waterAdjacent: false }, ON_TARGET);
    expect(r2.suppressMove).toBe(false);   // release to walk to another tile
    expect(c.isEmptying()).toBe(true);     // but still committed to emptying
  });

  it('does not freeze when emptying + thirsty at the water off his target yard', () => {
    // Regression: tick's emptying branch preempts refill (drinks nothing while
    // emptying); shouldHold must agree and NOT hold him for a refill, or he'd be
    // pinned at the water's edge doing nothing forever.
    const c = new BanditController();
    const i = inv({ water: 5, poop: config.BANDIT_RELIEVE_THRESHOLD }); // thirsty AND high need
    const input = { inv: i, tile: tile('pavement'), owner: owner(80), waterAdjacent: true };
    const r = c.tick(input, OFF_TARGET); // sets emptying (needsRelieve); not on a foulable target tile
    expect(c.isEmptying()).toBe(true);
    expect(r.suppressMove).toBe(false);           // does not hold — no drink, no drain
    expect(c.shouldHold(input, OFF_TARGET)).toBe(false); // shouldHold agrees → he moves on
    expect(i.water).toBe(5);                       // did NOT drink (emptying preempts refill)
  });

  it('does not trap him on a fully-maxed target tile (no progress possible)', () => {
    const c = new BanditController();
    const maxed: Tile = { ...tile('grass'), dirt: config.POOP_MAX, destruction: config.PEE_MAX };
    const input = { inv: inv({ poop: config.BANDIT_RELIEVE_THRESHOLD, pee: config.BANDIT_RELIEVE_THRESHOLD }), tile: maxed, owner: owner(80), waterAdjacent: false };
    expect(c.shouldHold(input, ON_TARGET)).toBe(false);      // free to move on
    expect(c.tick(input, ON_TARGET).suppressMove).toBe(false); // and tick agrees
  });
});
