import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parseMap } from '../../src/world/MapParser';
import { Grid } from '../../src/world/Grid';
import { setGate, advanceGateSeconds } from '../../src/world/gate';
import { GATE_TILES, HUSKY_START_TILE, CHI_START_TILE } from '../../src/config/constants';
import type { Direction, TileCoord } from '../../src/types';

// The gate's coordinates are map data living in code: closing the right edge of
// two driveway tiles is only a seal because the Grumbles' property is fenced on
// every other side. That is a property of map.csv, not of any function — so this
// re-derives it from the real map. An edit that moves the driveway fails here
// instead of silently leaving the gate ajar.
const MAP = readFileSync(new URL('../../src/data/map.csv', import.meta.url), 'utf8');
const BANDIT_START: TileCoord = CHI_START_TILE;
const DIRS: Direction[] = ['up', 'down', 'left', 'right'];

// Uses the production `setGate` rather than reimplementing the toggle, so this
// exercises the real mechanism instead of a copy that could drift from it.
function build(gateShut: boolean): Grid {
  const map = parseMap(MAP);
  setGate(map, gateShut);
  return new Grid(map);
}

function reachable(grid: Grid, from: TileCoord): Set<string> {
  const key = (c: TileCoord) => `${c.col},${c.row}`;
  const seen = new Set([key(from)]);
  const queue: TileCoord[] = [from];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const dir of DIRS) {
      if (!grid.canMove(cur, dir)) continue;
      const next = grid.neighbor(cur, dir);
      if (seen.has(key(next))) continue;
      seen.add(key(next));
      queue.push(next);
    }
  }
  return seen;
}

const walkableCount = (grid: Grid) => grid.map.tiles.flat().filter((t) => t.type !== 'house').length;

describe('the Grumbles driveway gate', () => {
  it('is exactly two tiles wide', () => {
    expect(GATE_TILES).toHaveLength(2);
  });

  it('sits on the driveway, not on a fenced stretch of the property line', () => {
    const grid = build(false);
    for (const g of GATE_TILES) {
      const tile = grid.map.tiles[g.row][g.col];
      expect(tile.type).not.toBe('house');
      expect(tile.fences.right, `(${g.col},${g.row}) is already fenced`).toBe(false);
      expect(grid.canMove(g, 'right'), `(${g.col},${g.row}) should be open`).toBe(true);
    }
  });

  describe('shut', () => {
    const grid = build(true);
    const pen = reachable(grid, BANDIT_START);
    const outside = reachable(grid, HUSKY_START_TILE);

    // 190 and 852 were derived by running this same flood fill once over the
    // shipping map. They are what catches a driveway that MOVES but still seals
    // some other area — the invariants below cannot see that. If you edit
    // map.csv on purpose, re-derive them; a failure here means the pen changed
    // shape, not that the gate logic broke.
    it('seals Bandit inside the property', () => {
      expect(pen.size).toBe(190);
    });

    it('locks Blizzard out of it', () => {
      expect(outside.size).toBe(852);
    });

    it('leaves no tile reachable from both sides', () => {
      const overlap = [...pen].filter((k) => outside.has(k));
      expect(overlap).toEqual([]);
    });

    it('partitions the whole map — nothing is stranded in between', () => {
      expect(pen.size + outside.size).toBe(walkableCount(grid));
    });

    it('pens him with only his own family and their driveway', () => {
      const owners = new Set(
        [...pen].map((k) => {
          const [col, row] = k.split(',').map(Number);
          return grid.map.tiles[row][col].ownerId;
        }),
      );
      expect([...owners].sort((a, b) => a - b)).toEqual([0, 1]); // public + The Grumbles
    });
  });

  describe('open', () => {
    const grid = build(false);

    it('gives the whole map back to both dogs', () => {
      const all = walkableCount(grid);
      expect(reachable(grid, BANDIT_START).size).toBe(all);
      expect(reachable(grid, HUSKY_START_TILE).size).toBe(all);
    });

    it('restores the map exactly as it ships — the gate leaves no trace', () => {
      const pristine = new Grid(parseMap(MAP));
      for (const g of GATE_TILES) {
        expect(grid.map.tiles[g.row][g.col].fences).toEqual(pristine.map.tiles[g.row][g.col].fences);
      }
    });
  });

  describe('the countdown', () => {
    it('stays shut while seconds remain', () => {
      expect(advanceGateSeconds(3)).toEqual({ secondsLeft: 2, open: false });
      expect(advanceGateSeconds(2)).toEqual({ secondsLeft: 1, open: false });
    });

    it('opens on the second the last one runs out', () => {
      expect(advanceGateSeconds(1)).toEqual({ secondsLeft: 0, open: true });
    });

    it('reports open for a delay of zero — he was never penned', () => {
      expect(advanceGateSeconds(0).open).toBe(true);
    });

    it('keeps reporting open if it is ever ticked past zero', () => {
      expect(advanceGateSeconds(-5).open).toBe(true);
    });
  });
});
