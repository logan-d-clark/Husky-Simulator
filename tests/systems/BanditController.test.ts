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

describe('BanditController — water refill', () => {
  it('drinks to a full refill, suppressing movement until the cap', () => {
    const c = new BanditController();
    const i = inv({ water: 10 });
    let ticks = 0;
    let res = c.tick({ inv: i, tile: tile('pavement'), owner: owner(80), waterAdjacent: true });
    while (res.suppressMove) {
      ticks++;
      res = c.tick({ inv: i, tile: tile('pavement'), owner: owner(80), waterAdjacent: true });
    }
    expect(i.water).toBe(config.WATER_CAP);
    // 10 -> 125 at WATER_VALUE(10)/tick, capped.
    expect(ticks).toBeGreaterThan(1);
  });

  it('gains exactly WATER_VALUE on a drinking tick (same as Blizzard)', () => {
    const c = new BanditController();
    const bInv = inv({ water: 50 });
    c.tick({ inv: bInv, tile: tile('pavement'), owner: owner(80), waterAdjacent: true });
    const zInv = inv({ water: 50 });
    ResourceSystem.drink(zInv);
    expect(bInv.water).toBe(zInv.water);
  });

  it('does not linger at water when already full', () => {
    const c = new BanditController();
    const i = inv({ water: config.WATER_CAP });
    const res = c.tick({ inv: i, tile: tile('pavement'), owner: owner(80), waterAdjacent: true });
    expect(res.suppressMove).toBe(false);
    expect(i.water).toBe(config.WATER_CAP);
  });

  it('does not interrupt an in-progress refill when a relieve need arises', () => {
    const c = new BanditController();
    const i = inv({ water: 100, poop: 0 });
    c.tick({ inv: i, tile: tile('grass'), owner: owner(80), waterAdjacent: true }); // refill starts
    i.poop = config.BANDIT_RELIEVE_THRESHOLD + 20; // need crosses threshold mid-refill
    const res = c.tick({ inv: i, tile: tile('grass'), owner: owner(80), waterAdjacent: true });
    expect(res.suppressMove).toBe(true);
    expect(i.poop).toBe(config.BANDIT_RELIEVE_THRESHOLD + 20); // NOT drained — still refilling
    expect(i.water).toBe(120); // kept drinking
  });
});

describe('BanditController — relieving', () => {
  it('poops and pees on the yard until spent, dropping owner affection, then releases', () => {
    const c = new BanditController();
    const o = owner(80);
    const i = inv({ poop: 32, pee: 31 });
    let res = c.tick({ inv: i, tile: tile('grass'), owner: o, waterAdjacent: false });
    while (res.suppressMove) {
      res = c.tick({ inv: i, tile: tile('grass'), owner: o, waterAdjacent: false });
    }
    expect(i.poop).toBe(1);
    expect(i.pee).toBe(1);
    // 31 poops + 30 pees drained, each -1 affection at sensitivity 1.
    expect(o.affection).toBe(80 - 31 - 30);
  });

  it('does not interrupt an in-progress relieve when thirst arises', () => {
    const c = new BanditController();
    const i = inv({ water: 5, poop: config.BANDIT_RELIEVE_THRESHOLD }); // thirsty AND high need
    const res = c.tick({ inv: i, tile: tile('grass'), owner: owner(80), waterAdjacent: true });
    expect(res.suppressMove).toBe(true);
    expect(i.poop).toBe(config.BANDIT_RELIEVE_THRESHOLD - 1); // relieved
    expect(i.water).toBe(5); // did NOT drink — relieve wasn't interrupted
  });

  it('drops poop and owner affection by the same amount as Blizzard would', () => {
    const c = new BanditController();
    const bOwner = owner(80);
    const bInv = inv({ poop: config.BANDIT_RELIEVE_THRESHOLD, pee: 0 });
    c.tick({ inv: bInv, tile: tile('grass'), owner: bOwner, waterAdjacent: false });
    const zOwner = owner(80);
    const zInv = inv({ poop: config.BANDIT_RELIEVE_THRESHOLD, pee: 0 });
    WorldActions.poop({ inv: zInv }, tile('grass'), zOwner);
    expect(bInv.poop).toBe(zInv.poop);
    expect(bOwner.affection).toBe(zOwner.affection);
  });

  it('does not relieve on a non-grass tile', () => {
    const c = new BanditController();
    const i = inv({ poop: config.BANDIT_RELIEVE_THRESHOLD, pee: config.BANDIT_RELIEVE_THRESHOLD });
    const res = c.tick({ inv: i, tile: tile('pavement'), owner: owner(80), waterAdjacent: false });
    expect(res.suppressMove).toBe(false);
    expect(i.poop).toBe(config.BANDIT_RELIEVE_THRESHOLD); // untouched
  });
});

describe('BanditController — shouldHold (movement gate)', () => {
  it('holds on a yard when the need is high', () => {
    const c = new BanditController();
    expect(c.shouldHold({ inv: inv({ poop: config.BANDIT_RELIEVE_THRESHOLD }), tile: tile('grass'), owner: owner(50), waterAdjacent: false })).toBe(true);
  });
  it('holds next to water while below the cap', () => {
    const c = new BanditController();
    expect(c.shouldHold({ inv: inv({ water: 10 }), tile: tile('pavement'), owner: owner(50), waterAdjacent: true })).toBe(true);
  });
  it('does not hold on pavement with a low need and full water', () => {
    const c = new BanditController();
    expect(c.shouldHold({ inv: inv({ water: config.WATER_CAP }), tile: tile('pavement'), owner: owner(50), waterAdjacent: true })).toBe(false);
  });
  it('does not hold on a yard once the need is spent', () => {
    const c = new BanditController();
    expect(c.shouldHold({ inv: inv({ poop: 0, pee: 0 }), tile: tile('grass'), owner: owner(50), waterAdjacent: false })).toBe(false);
  });

  it('does not trap him on a fully-maxed yard (no progress possible)', () => {
    const c = new BanditController();
    const maxed: Tile = { ...tile('grass'), dirt: config.POOP_MAX, destruction: config.PEE_MAX };
    const input = { inv: inv({ poop: config.BANDIT_RELIEVE_THRESHOLD, pee: config.BANDIT_RELIEVE_THRESHOLD }), tile: maxed, owner: owner(80), waterAdjacent: false };
    expect(c.shouldHold(input)).toBe(false);      // free to move on
    expect(c.tick(input).suppressMove).toBe(false); // and tick agrees
  });
});
