import type { Grid } from '../world/Grid';
import type { Direction, TileCoord, Inventory, FoodType } from '../types';
import type { Food } from '../entities/Food';
import { config } from '../config/gameConfig';
import { banditSettings } from '../config/banditMode';

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

// Rank foods by value/distance (so a distant high-value bag can beat a nearby
// treat); when `smellGated`, skip any food beyond its type's smell radius.
function bestFood(from: TileCoord, foods: Food[], smellGated: boolean): Food | null {
  let best: Food | null = null;
  let bestScore = -Infinity;
  for (const f of foods) {
    const d = manhattan(from, f.tile);
    if (smellGated && d > smellRadius(f.type)) continue;
    const score = f.value / (d + 1);
    if (score > bestScore) { bestScore = score; best = f; }
  }
  return best;
}

// Best food Bandit can currently smell (advanced mode). null when nothing is
// within smell range.
export function bestSmelledFood(from: TileCoord, foods: Food[]): Food | null {
  return bestFood(from, foods, true);
}

// Best food anywhere on the map, ignoring smell range (omniscient mode). null
// only when no food exists at all.
export function bestFoodAnywhere(from: TileCoord, foods: Food[]): Food | null {
  return bestFood(from, foods, false);
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

const OPPOSITE: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left' };
const YARD_EXPLORE_CHANCE = 0.15; // chance to dip off the street into a yard
const CONTINUE_CHANCE = 0.8;      // chance to keep heading straight down the street

const pick = (dirs: Direction[], rng: () => number): Direction => dirs[Math.floor(rng() * dirs.length)];

// Cohesive street-search patrol (advanced mode's no-scent behaviour). Bandit
// sticks mostly to pavement: he keeps heading down the street, avoids doubling
// back, and only occasionally dips into an adjacent yard — from which he then
// biases straight back toward the street. Stateless: the "return to street"
// emerges from a strong pavement preference, so no history is stored on Bandit.
export function patrolStep(grid: Grid, from: TileCoord, facing: Direction, rng: () => number): Direction | null {
  const open = DIRS.filter((d) => grid.canMove(from, d));
  if (open.length === 0) return null;
  const typeOf = (d: Direction): string | undefined => {
    const n = grid.neighbor(from, d);
    return grid.tileAt(n.col, n.row)?.type;
  };
  const pavement = open.filter((d) => typeOf(d) === 'pavement');
  const onPavement = grid.tileAt(from.col, from.row)?.type === 'pavement';

  if (onPavement && pavement.length > 0) {
    const yards = open.filter((d) => typeOf(d) === 'grass' && d !== OPPOSITE[facing]);
    if (yards.length > 0 && rng() < YARD_EXPLORE_CHANCE) return pick(yards, rng);
    if (pavement.includes(facing) && rng() < CONTINUE_CHANCE) return facing;
    const forward = pavement.filter((d) => d !== OPPOSITE[facing]);
    return pick(forward.length > 0 ? forward : pavement, rng);
  }
  // Off the street (or no pavement ahead): head back toward pavement if any is
  // adjacent, otherwise keep moving without reversing.
  if (pavement.length > 0) return pick(pavement, rng);
  const forward = open.filter((d) => d !== OPPOSITE[facing]);
  return pick(forward.length > 0 ? forward : open, rng);
}

export type BanditMode = 'chase' | 'patrol';
export interface BanditMove { dir: Direction; mode: BanditMode; }

// Bandit's next move: seek water when thirsty (full-speed chase), else head for
// the best food — smell-gated in advanced mode, anywhere in omniscient mode
// (full-speed chase) — else wander the streets (half-speed patrol). Reads the
// live omniscient flag so a dev-panel toggle takes effect on the next move.
export function nextBanditMove(grid: Grid, bandit: Bandit, foods: Food[], rng: () => number): BanditMove | null {
  if (isThirsty(bandit.inv)) {
    const toWater = bfsFirstStep(grid, bandit.tile, (t) => isWaterAdjacent(grid, t));
    if (toWater) return { dir: toWater, mode: 'chase' };
  }
  const food = banditSettings.omniscient
    ? bestFoodAnywhere(bandit.tile, foods)
    : bestSmelledFood(bandit.tile, foods);
  if (food) {
    const toFood = bfsFirstStep(grid, bandit.tile, (t) => t.col === food.tile.col && t.row === food.tile.row);
    if (toFood) return { dir: toFood, mode: 'chase' };
  }
  const dir = patrolStep(grid, bandit.tile, bandit.facing, rng);
  return dir ? { dir, mode: 'patrol' } : null;
}

// Per-tile tween duration for a Bandit move: patrol steps take `patrolMultiplier`
// times longer than a chase step (2 = half speed). Pure so it unit-tests without
// Phaser.
export function banditTweenDuration(base: number, mode: BanditMode, patrolMultiplier: number): number {
  return mode === 'patrol' ? base * patrolMultiplier : base;
}

// Retained for the water-drinking check at the call site.
export { isWaterAdjacent };
