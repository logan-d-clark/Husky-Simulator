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
    expect(o.affection).toBe(49);
  });
  it('poop refused on non-grass', () => {
    const h = new Husky(); h.inv.poop = 10;
    const t = grass(); t.type = 'pavement'; const o = owner();
    expect(WorldActions.poop(h, t, o)).toBe(false);
  });
  it('trick costs food+water and raises affection', () => {
    const h = new Husky(); const t = grass(); const o = owner();
    WorldActions.trick(h, t, o);
    expect(o.affection).toBe(51);
    expect(h.inv.food).toBeCloseTo(49);
    expect(h.inv.water).toBeCloseTo(49);
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
