import type { GameMap } from './MapParser';
import type { Tile } from './tiles';
import type { Direction, TileCoord } from '../types';
import { GRID } from '../config/constants';

const DELTA: Record<Direction, { dc: number; dr: number }> = {
  up: { dc: 0, dr: -1 },
  down: { dc: 0, dr: 1 },
  left: { dc: -1, dr: 0 },
  right: { dc: 1, dr: 0 },
};

export class Grid {
  constructor(public map: GameMap) {}

  inBounds(col: number, row: number): boolean {
    return col >= 0 && row >= 0 && col < this.map.cols && row < this.map.rows;
  }

  tileAt(col: number, row: number): Tile | undefined {
    return this.inBounds(col, row) ? this.map.tiles[row][col] : undefined;
  }

  neighbor(coord: TileCoord, dir: Direction): TileCoord {
    const d = DELTA[dir];
    return { col: coord.col + d.dc, row: coord.row + d.dr };
  }

  canMove(from: TileCoord, dir: Direction): boolean {
    const to = this.neighbor(from, dir);
    const target = this.tileAt(to.col, to.row);
    if (!target) return false;
    if (target.type === 'house') return false;
    const src = this.tileAt(from.col, from.row);
    if (!src) return false;
    // Blocked if a fence sits on the shared edge (check both tiles' edge flags).
    if (dir === 'up' && (src.fences.top || target.fences.bottom)) return false;
    if (dir === 'down' && (src.fences.bottom || target.fences.top)) return false;
    if (dir === 'left' && (src.fences.left || target.fences.right)) return false;
    if (dir === 'right' && (src.fences.right || target.fences.left)) return false;
    return true;
  }

  tileToPixel(coord: TileCoord): { x: number; y: number } {
    return {
      x: coord.col * GRID.TILE + GRID.TILE / 2,
      y: coord.row * GRID.TILE + GRID.TILE / 2,
    };
  }
}
