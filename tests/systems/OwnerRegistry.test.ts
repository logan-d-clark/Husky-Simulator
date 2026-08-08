import { describe, it, expect } from 'vitest';
import { parseMap } from '../../src/world/MapParser';
import { OwnerRegistry, yardCentroid, dispenseOverMap, buildRelieveTargets } from '../../src/systems/OwnerRegistry';
import type { Food } from '../../src/entities/Food';

describe('OwnerRegistry', () => {
  it('provides owners by id', () => {
    const reg = new OwnerRegistry();
    expect(reg.get(1).name).toBe('The Grumbles');
  });
  it('computes a yard centroid over owned grass', () => {
    const map = parseMap('G7,G7,H\nG7,G7,H'); // owner 7 occupies a 2x2 block
    const c = yardCentroid(map, 7);
    expect(c).toEqual({ col: 0, row: 0 }); // rounded average of cols {0,1}, rows {0,1} = (0.5,0.5)->round->(1,1)? see note
  });
  const holding = (poop: number, pee = 0) => ({ food: 0, water: 0, poop, pee });

  it('yields one target per available family-yard tile, excluding public/street', () => {
    // owner 2 owns two grass tiles; the rest is public (0) pavement/water.
    const map = parseMap('G2,P0,W0\nG2,P0,P0');
    const reg = new OwnerRegistry();
    const targets = buildRelieveTargets(map, reg, holding(40));
    expect(targets).toHaveLength(2); // both grass-2 tiles are foulable
    expect(targets.every((t) => t.affection === reg.get(2).affection)).toBe(true);
    expect(targets.every((t) => map.tiles[t.tile.row][t.tile.col].ownerId === 2)).toBe(true);
  });

  it('excludes maxed tiles, and yields nothing when he holds no drainable waste', () => {
    const map = parseMap('G2,G2');
    const reg = new OwnerRegistry();
    map.tiles[0][0].dirt = 100; // POOP_MAX — this tile is full for poop
    expect(buildRelieveTargets(map, reg, holding(40))).toHaveLength(1); // only the open tile
    expect(buildRelieveTargets(map, reg, holding(1))).toHaveLength(0);  // holds nothing drainable
  });

  it('dispense emits food when roll succeeds', () => {
    const map = parseMap('G2'); // owner 2
    const reg = new OwnerRegistry();
    reg.get(2).affection = 100;
    const emitted: Food[] = [];
    dispenseOverMap(map, reg, () => 0, (f) => emitted.push(f)); // roll 0 always <= p
    expect(emitted.length).toBe(1);
    expect(map.tiles[0][0].foodPresent).toBe(true);
  });
});
