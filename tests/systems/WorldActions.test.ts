import { describe, it, expect } from 'vitest';
import { WorldActions } from '../../src/systems/WorldActions';
import { Husky } from '../../src/entities/Husky';
import { Owner } from '../../src/entities/Owner';
import { emptyFences } from '../../src/world/tiles';
import type { Tile } from '../../src/world/tiles';

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
});
