import type { Grid } from '../world/Grid';
import type { Direction, TileCoord } from '../types';
import type { Food } from '../entities/Food';

const DIRS: Direction[] = ['up', 'down', 'left', 'right'];

export const AISystem = {
  nextStep(grid: Grid, from: TileCoord, foods: Food[]): Direction | null {
    if (foods.length === 0) return null;
    const goals = new Set(foods.map((f) => key(f.tile.col, f.tile.row)));

    // BFS storing the first-step direction taken from `from`.
    const visited = new Set<string>([key(from.col, from.row)]);
    const queue: { coord: TileCoord; firstDir: Direction | null }[] = [{ coord: from, firstDir: null }];

    while (queue.length > 0) {
      const node = queue.shift()!;
      if (node.firstDir && goals.has(key(node.coord.col, node.coord.row))) {
        return node.firstDir;
      }
      for (const dir of DIRS) {
        if (!grid.canMove(node.coord, dir)) continue;
        const nxt = grid.neighbor(node.coord, dir);
        const k = key(nxt.col, nxt.row);
        if (visited.has(k)) continue;
        visited.add(k);
        queue.push({ coord: nxt, firstDir: node.firstDir ?? dir });
      }
    }
    return null;
  },
};

function key(col: number, row: number): string { return `${col},${row}`; }
