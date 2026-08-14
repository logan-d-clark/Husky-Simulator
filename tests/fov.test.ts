import { describe, it, expect } from 'vitest';
import { computeFov } from '../src/world/fov';
import type { GameMap } from '../src/world/MapParser';
import type { Tile } from '../src/world/tiles';
import { emptyFences } from '../src/world/tiles';
import type { TileType } from '../src/types';

// Build a GameMap from an ASCII grid: 'G' grass, 'H' house, 'P' pavement.
// Fences: pass a list of [col,row,side] to fence a tile edge.
function mapFrom(
  rows: string[],
  fences: [number, number, 'top' | 'bottom' | 'left' | 'right'][] = [],
): GameMap {
  const T: Record<string, TileType> = { G: 'grass', H: 'house', P: 'pavement', W: 'water' };
  const tiles: Tile[][] = rows.map((line, r) =>
    line.split('').map((ch, c) => ({
      col: c,
      row: r,
      type: T[ch],
      ownerId: 0,
      fences: emptyFences(),
      heat: 0,
      dirt: 0,
      destruction: 0,
      foodPresent: false,
    })),
  );
  for (const [c, r, side] of fences) tiles[r][c].fences[side] = true;
  return { rows: tiles.length, cols: tiles[0].length, tiles };
}

const has = (s: Set<string>, c: number, r: number) => s.has(`${c},${r}`);

describe('computeFov', () => {
  it('sees the whole open room', () => {
    const fov = computeFov(mapFrom(['GGG', 'GGG', 'GGG']), { col: 1, row: 1 });
    expect(fov.size).toBe(9);
  });

  it('a house blocks sight to tiles behind it (but the house tile itself is seen)', () => {
    // row: from(0) . house(1) . grass(2 behind)
    const fov = computeFov(mapFrom(['GHG']), { col: 0, row: 0 });
    expect(has(fov, 0, 0)).toBe(true);
    expect(has(fov, 1, 0)).toBe(true); // the house facade is visible
    expect(has(fov, 2, 0)).toBe(false); // behind the house is hidden
  });

  it('a fence blocks sight past the fenced edge', () => {
    // fence on the right edge of (0,0): can't see (1,0) or (2,0)
    const fov = computeFov(mapFrom(['GGG'], [[0, 0, 'right']]), { col: 0, row: 0 });
    expect(has(fov, 0, 0)).toBe(true);
    expect(has(fov, 1, 0)).toBe(false);
    expect(has(fov, 2, 0)).toBe(false);
  });

  it('always includes the origin', () => {
    const fov = computeFov(mapFrom(['H']), { col: 0, row: 0 });
    expect(has(fov, 0, 0)).toBe(true);
  });
});
