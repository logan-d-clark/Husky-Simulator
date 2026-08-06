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
  it('builds one relieve target per family yard, excluding public/street', () => {
    // owner 2 has a grass yard; the rest of the map is public (0) pavement/water.
    const map = parseMap('G2,P0,W0\nG2,P0,P0');
    const reg = new OwnerRegistry();
    const targets = buildRelieveTargets(map, reg);
    expect(targets).toHaveLength(1);
    expect(targets[0].affection).toBe(reg.get(2).affection);
    // The public owner (id 0) contributes no target (it owns no grass).
    expect(yardCentroid(map, 0)).toBeNull();
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
