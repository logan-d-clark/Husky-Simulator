import { describe, it, expect } from 'vitest';
import { assignHouseFaces, BOTTOM_BAND } from '../src/world/houseFacades';
import type { GameMap } from '../src/world/MapParser';
import type { Tile } from '../src/world/tiles';
import { emptyFences } from '../src/world/tiles';

// Build a GameMap from an ASCII grid: 'H' = house, '.' = grass.
function mapFrom(gridRows: string[]): GameMap {
  const tiles: Tile[][] = gridRows.map((line, r) =>
    line.split('').map((ch, c) => ({
      col: c, row: r, type: ch === 'H' ? 'house' : 'grass', ownerId: 0,
      fences: emptyFences(), heat: 0, dirt: 0, destruction: 0, foodPresent: false,
    })),
  );
  return { rows: tiles.length, cols: tiles[0].length, tiles };
}

const faceAt = (m: Map<string, string>, c: number, r: number) => m.get(`${c},${r}`);

describe('assignHouseFaces', () => {
  it('makes a house interior roof and its bottom row the facade with one door', () => {
    // 3-wide, 2-tall house near the top; plenty of grass below so not a bottom house.
    const grid = ['.....', '.HHH.', '.HHH.', '.....', '.....', '.....', '.....'];
    const faces = assignHouseFaces(mapFrom(grid));
    // top row is roof (house below it)
    expect(faceAt(faces, 1, 1)).toBe('roof');
    expect(faceAt(faces, 2, 1)).toBe('roof');
    // bottom row is facade; exactly one door among it
    const bottom = [faceAt(faces, 1, 2), faceAt(faces, 2, 2), faceAt(faces, 3, 2)];
    expect(bottom.filter((f) => f === 'door')).toHaveLength(1);
    // the others are window or bare
    expect(bottom.filter((f) => f === 'window' || f === 'bare')).toHaveLength(2);
  });

  it('gives bottom-of-map houses no door', () => {
    const rows = 6;
    // House facade sits within the bottom band.
    const grid: string[] = [];
    for (let r = 0; r < rows; r++) grid.push(r >= rows - 1 ? '.HHH.' : '.....');
    const faces = assignHouseFaces(mapFrom(grid));
    const bottom = [faceAt(faces, 1, rows - 1), faceAt(faces, 2, rows - 1), faceAt(faces, 3, rows - 1)];
    expect(bottom).not.toContain('door');
    expect(bottom.every((f) => f === 'window' || f === 'bare')).toBe(true);
  });

  it('labels two separate houses independently (a door each)', () => {
    const grid = ['HH..HH', 'HH..HH', '......', '......', '......', '......'];
    const faces = assignHouseFaces(mapFrom(grid));
    const left = [faceAt(faces, 0, 1), faceAt(faces, 1, 1)];
    const right = [faceAt(faces, 4, 1), faceAt(faces, 5, 1)];
    expect(left.filter((f) => f === 'door')).toHaveLength(1);
    expect(right.filter((f) => f === 'door')).toHaveLength(1);
  });

  it('BOTTOM_BAND is a positive threshold', () => {
    expect(BOTTOM_BAND).toBeGreaterThan(0);
  });
});
