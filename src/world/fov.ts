import type { GameMap } from './MapParser';
import type { TileCoord, Direction } from '../types';

const k = (c: number, r: number): string => `${c},${r}`;

// The set of tile keys visible from `from`: infinite range, but sight is blocked
// by house tiles (opaque) and fences (tile edges). Uses a 2D grid ray-traversal
// line-of-sight test to each tile, so Blizzard sees down open corridors but not
// around corners, through buildings, or into fenced-off yards.
export function computeFov(map: GameMap, from: TileCoord): Set<string> {
  const vis = new Set<string>([k(from.col, from.row)]);
  for (let r = 0; r < map.rows; r++) {
    for (let c = 0; c < map.cols; c++) {
      if (c === from.col && r === from.row) continue;
      if (hasLineOfSight(map, from, c, r)) vis.add(k(c, r));
    }
  }
  return vis;
}

// Is there a fence on the edge between (col,row) and its neighbor in `dir`?
function fenceBlocks(map: GameMap, col: number, row: number, dir: Direction): boolean {
  const a = map.tiles[row][col];
  const nc = col + (dir === 'right' ? 1 : dir === 'left' ? -1 : 0);
  const nr = row + (dir === 'down' ? 1 : dir === 'up' ? -1 : 0);
  const b = map.tiles[nr]?.[nc];
  if (!b) return true;
  if (dir === 'right') return a.fences.right || b.fences.left;
  if (dir === 'left') return a.fences.left || b.fences.right;
  if (dir === 'up') return a.fences.top || b.fences.bottom;
  return a.fences.bottom || b.fences.top; // down
}

// Amanatides–Woo grid traversal from `from` to (tc,tr), stepping one axis at a
// time. Blocked if a crossed edge has a fence, or an intermediate (non-target)
// tile is a house.
function hasLineOfSight(map: GameMap, from: TileCoord, tc: number, tr: number): boolean {
  let x = from.col,
    y = from.row;
  const stepX = Math.sign(tc - from.col),
    stepY = Math.sign(tr - from.row);
  const nx = Math.abs(tc - from.col),
    ny = Math.abs(tr - from.row);
  let ix = 0,
    iy = 0;

  while (ix < nx || iy < ny) {
    let dir: Direction;
    if (iy >= ny || (ix < nx && (0.5 + ix) * ny < (0.5 + iy) * nx)) {
      x += stepX;
      ix++;
      dir = stepX > 0 ? 'right' : 'left';
    } else {
      y += stepY;
      iy++;
      dir = stepY > 0 ? 'down' : 'up';
    }
    // Fence on the edge just crossed (from the previous cell into this one).
    const pc = dir === 'right' ? x - 1 : dir === 'left' ? x + 1 : x;
    const pr = dir === 'down' ? y - 1 : dir === 'up' ? y + 1 : y;
    if (fenceBlocks(map, pc, pr, dir)) return false;
    const isTarget = x === tc && y === tr;
    if (!isTarget && map.tiles[y][x].type === 'house') return false;
  }
  return true;
}
