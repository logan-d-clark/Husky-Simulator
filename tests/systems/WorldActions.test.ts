import { describe, it, expect } from 'vitest';
import { WorldActions } from '../../src/systems/WorldActions';
import { Husky } from '../../src/entities/Husky';
import { Owner } from '../../src/entities/Owner';
import { emptyFences } from '../../src/world/tiles';
import type { Tile } from '../../src/world/tiles';
import { config } from '../../src/config/gameConfig';

const grass = (): Tile => ({
  col: 0, row: 0, type: 'grass', ownerId: 5, fences: emptyFences(),
  heat: 0.01, dirt: 0, destruction: 0, foodPresent: false,
});
const owner = () => new Owner({ id: 5, affection: 50, sensitivity: 1, treatRateBase: 0, name: 'T' });

describe('WorldActions', () => {
  it('poop deposits dirt and lowers affection', () => {
    const h = new Husky(); h.inv.poop = 10;
    const t = grass(); const o = owner();
    expect(WorldActions.poop(h, t, o)).toBe(true);
    expect(t.dirt).toBe(1);
    expect(h.inv.poop).toBe(9);
    expect(o.affection).toBeCloseTo(50 - config.POOP_COST * o.sensitivity);
  });
  it('poop refused on non-grass', () => {
    const h = new Husky(); h.inv.poop = 10;
    const t = grass(); t.type = 'pavement'; const o = owner();
    expect(WorldActions.poop(h, t, o)).toBe(false);
  });
  it('trick spends water only — food is the score currency and stays untouched', () => {
    const h = new Husky(); const t = grass(); const o = owner();
    const food0 = h.inv.food, water0 = h.inv.water;
    expect(WorldActions.trick(h, t, o)).toBe(true);
    expect(o.affection).toBe(50 + config.TRICK_RATE);
    expect(h.inv.food).toBeCloseTo(food0);                              // no score burned
    expect(h.inv.water).toBeCloseTo(water0 - config.TRICK_WATER_COST);  // paid in water
  });

  it('trick is refused when the water would run out', () => {
    const h = new Husky(); h.inv.water = config.TRICK_WATER_COST;
    const t = grass(); const o = owner();
    expect(WorldActions.trick(h, t, o)).toBe(false);
    expect(o.affection).toBe(50);
  });

  it('a zero food cost does not keep gating the trick at low food', () => {
    // Regression: the old guard tested `food - COST <= 0` against a shared cost,
    // so zeroing the food price alone would still have blocked a hungry dog.
    const h = new Husky(); h.inv.food = 0.5; // nearly starving, but tricks are free
    const t = grass(); const o = owner();
    expect(WorldActions.trick(h, t, o)).toBe(true);
    expect(h.inv.food).toBeCloseTo(0.5);
  });

  describe('foul cost calibration', () => {
    // One full load is a drain from POOP_MAX down to WorldActions' `> 1` floor.
    const FULL_LOAD_DROPS = (config.POOP_MAX - 1) / config.POOP_RATE;
    const emptyOnto = (sensitivity: number): number => {
      const h = new Husky(); h.inv.poop = config.POOP_MAX;
      const t = grass();
      const o = new Owner({ id: 5, affection: 100, sensitivity, treatRateBase: 0, name: 'T' });
      while (WorldActions.poop(h, t, o)) { /* drain to the floor */ }
      return o.affection;
    };

    it('leaves an average (median sensitivity 3) yard at about 75%', () => {
      expect(emptyOnto(3)).toBeCloseTo(100 - FULL_LOAD_DROPS * config.POOP_COST * 3, 5);
      // The stated budget: a full load costs an average yard no more than a
      // quarter of the scale.
      expect(100 - emptyOnto(3)).toBeLessThanOrEqual(25);
      expect(100 - emptyOnto(3)).toBeGreaterThan(24);
    });

    it('costs a forgiving yard less and a harsh yard more', () => {
      const survives = (s: number) => 100 - FULL_LOAD_DROPS * config.POOP_COST * s;
      expect(emptyOnto(1)).toBeGreaterThan(emptyOnto(3)); // sens 1 keeps more
      expect(emptyOnto(5)).toBeLessThan(emptyOnto(3));    // sens 5 keeps less
      expect(emptyOnto(1)).toBeCloseTo(survives(1), 5);   // ~92 at the defaults
      expect(emptyOnto(5)).toBeCloseTo(survives(5), 5);   // ~58 at the defaults
    });

    it('never zeroes a yard in a single visit, even the harshest', () => {
      expect(emptyOnto(5)).toBeGreaterThan(0);
    });
  });
  it('autoDump empties maxed poop into an empty tile', () => {
    const h = new Husky(); h.inv.poop = 100; // POOP_MAX
    const t = grass(); const o = owner();
    WorldActions.autoDump(h, t, o);
    expect(h.inv.poop).toBeLessThan(100);
    expect(t.dirt).toBeGreaterThan(0);
  });

  describe('canPoop / canPee capacity guards', () => {
    const actor = (poop: number, pee: number) => ({ inv: { food: 0, water: 0, poop, pee } });
    it('canPoop true on grass with waste above the floor and room', () => {
      expect(WorldActions.canPoop(actor(10, 0), grass())).toBe(true);
    });
    it('canPoop false at the floor', () => {
      expect(WorldActions.canPoop(actor(1, 0), grass())).toBe(false);
    });
    it('canPoop false when the tile dirt is maxed', () => {
      const t = grass(); t.dirt = config.POOP_MAX;
      expect(WorldActions.canPoop(actor(10, 0), t)).toBe(false);
    });
    it('canPoop false on non-grass', () => {
      const t = grass(); t.type = 'pavement';
      expect(WorldActions.canPoop(actor(10, 0), t)).toBe(false);
    });
    it('canPee mirrors canPoop on the destruction channel', () => {
      expect(WorldActions.canPee(actor(0, 10), grass())).toBe(true);
      const maxed = grass(); maxed.destruction = config.PEE_MAX;
      expect(WorldActions.canPee(actor(0, 10), maxed)).toBe(false);
    });
    it('poop/pee agree with their guards at the exact boundary', () => {
      const nearMax = grass(); nearMax.dirt = config.POOP_MAX - config.POOP_RATE; // exactly one more fits
      expect(WorldActions.canPoop(actor(10, 0), nearMax)).toBe(true);
      expect(WorldActions.poop(actor(10, 0), nearMax, owner())).toBe(true);
      const atMax = grass(); atMax.dirt = config.POOP_MAX;
      expect(WorldActions.canPoop(actor(10, 0), atMax)).toBe(false);
      expect(WorldActions.poop(actor(10, 0), atMax, owner())).toBe(false);
    });
  });
});
