import type { Grid } from '../world/Grid';
import type { Direction, TileCoord, Inventory, FoodType } from '../types';
import type { Food } from '../entities/Food';
import { config } from '../config/gameConfig';

const DIRS: Direction[] = ['up', 'down', 'left', 'right'];
const key = (c: number, r: number): string => `${c},${r}`;
const manhattan = (a: TileCoord, b: TileCoord): number =>
  Math.abs(a.col - b.col) + Math.abs(a.row - b.row);

export interface Bandit {
  tile: TileCoord;
  inv: Inventory;
  facing: Direction;
}

// Bandit's smell radius (tiles) for a food type — bigger/higher-value foods
// carry farther.
export function smellRadius(type: FoodType): number {
  return type === 'bag' ? config.SMELL_BAG : type === 'bowl' ? config.SMELL_BOWL : config.SMELL_TREAT;
}

// Best food Bandit can currently smell, ranked by value/distance so a distant
// high-value bag can beat a nearby treat. null when nothing is in range.
export function bestSmelledFood(from: TileCoord, foods: Food[]): Food | null {
  let best: Food | null = null;
  let bestScore = -Infinity;
  for (const f of foods) {
    const d = manhattan(from, f.tile);
    if (d > smellRadius(f.type)) continue;
    const score = f.value / (d + 1);
    if (score > bestScore) { bestScore = score; best = f; }
  }
  return best;
}

export function isThirsty(inv: Inventory): boolean {
  return inv.water < config.WATER_CAP * 0.3;
}

function isWaterAdjacent(grid: Grid, t: TileCoord): boolean {
  for (const [dc, dr] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    if (grid.tileAt(t.col + dc, t.row + dr)?.type === 'water') return true;
  }
  return false;
}

// BFS for the first-step direction toward the nearest tile satisfying isGoal
// (only walkable tiles are traversed). null if no goal is reachable.
export function bfsFirstStep(grid: Grid, from: TileCoord, isGoal: (t: TileCoord) => boolean): Direction | null {
  const visited = new Set<string>([key(from.col, from.row)]);
  const queue: { coord: TileCoord; firstDir: Direction | null }[] = [{ coord: from, firstDir: null }];
  while (queue.length > 0) {
    const node = queue.shift()!;
    if (node.firstDir && isGoal(node.coord)) return node.firstDir;
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
}

// A wandering step when Bandit has no goal: keep going straight most of the
// time, otherwise pick a random open direction.
export function patrolDir(grid: Grid, from: TileCoord, facing: Direction, rng: () => number): Direction | null {
  const open = DIRS.filter((d) => grid.canMove(from, d));
  if (open.length === 0) return null;
  if (open.includes(facing) && rng() < 0.65) return facing;
  return open[Math.floor(rng() * open.length)];
}

// Bandit's next move direction: seek water when thirsty, else head for the best
// smelled food, else patrol until something turns up.
export function nextBanditMove(grid: Grid, bandit: Bandit, foods: Food[], rng: () => number): Direction | null {
  if (isThirsty(bandit.inv)) {
    const toWater = bfsFirstStep(grid, bandit.tile, (t) => isWaterAdjacent(grid, t));
    if (toWater) return toWater;
  }
  const food = bestSmelledFood(bandit.tile, foods);
  if (food) {
    const toFood = bfsFirstStep(grid, bandit.tile, (t) => t.col === food.tile.col && t.row === food.tile.row);
    if (toFood) return toFood;
  }
  return patrolDir(grid, bandit.tile, bandit.facing, rng);
}

// Retained for the water-drinking check at the call site.
export { isWaterAdjacent };
