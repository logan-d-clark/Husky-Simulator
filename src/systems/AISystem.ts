import type { Grid } from '../world/Grid';
import type { Direction, TileCoord, Inventory, FoodType } from '../types';
import type { Tile } from '../world/tiles';
import type { Food } from '../entities/Food';
import { config } from '../config/gameConfig';
import { banditSettings } from '../config/banditMode';
import { WorldActions } from './WorldActions';

// The two waste channels. Like Blizzard, Bandit drains exactly one at a time.
export type WasteChannel = 'poop' | 'pee';

// A family-yard tile Bandit could still foul: grass with room for the waste he's
// holding. Given a `channel` it asks only about that one — a tile with pee room
// is no use to a Bandit draining poop onto maxed dirt. Delegates to WorldActions'
// capacity guards (single source of truth) so the AI's targeting and the
// controller's fouling can never disagree.
export function canFoulTile(inv: Inventory, tile: Tile, channel: WasteChannel | null = null): boolean {
  if (channel === 'poop') return WorldActions.canPoop({ inv }, tile);
  if (channel === 'pee') return WorldActions.canPee({ inv }, tile);
  return WorldActions.canPoop({ inv }, tile) || WorldActions.canPee({ inv }, tile);
}

const DIRS: Direction[] = ['up', 'down', 'left', 'right'];
const key = (c: number, r: number): string => `${c},${r}`;
const manhattan = (a: TileCoord, b: TileCoord): number => Math.abs(a.col - b.col) + Math.abs(a.row - b.row);

export interface Bandit {
  tile: TileCoord;
  inv: Inventory;
  facing: Direction;
}

// Bandit's smell radius (tiles) for a food type — bigger/higher-value foods
// carry farther.
export function smellRadius(type: FoodType): number {
  if (type === 'pupcup') return config.SMELL_PUPCUP;
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
    if (score > bestScore) {
      bestScore = score;
      best = f;
    }
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

// Bandit's water is low enough to send him to the nearest water and hold him
// there until he's topped right back up to WATER_CAP.
export function isThirsty(inv: Inventory): boolean {
  return inv.water <= config.WATER_CAP * config.BANDIT_THIRST_FRACTION;
}

function isWaterAdjacent(grid: Grid, t: TileCoord): boolean {
  for (const [dc, dr] of [
    [0, 0],
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ] as const) {
    if (grid.tileAt(t.col + dc, t.row + dr)?.type === 'water') return true;
  }
  return false;
}

// BFS for the first-step direction toward the nearest tile satisfying isGoal
// (only walkable tiles are traversed). null if no goal is reachable.
// `blocked` marks tiles the walker refuses to ENTER — Bandit's repeller
// exclusion. It is never applied to `from`, so a walker already standing in a
// blocked region can always route out of it. Only Bandit's callers pass one;
// this is why the repeller can't live in Grid.canMove the way the gate does,
// since canMove is shared by both dogs and the whole point here is asymmetry.
export function bfsFirstStep(
  grid: Grid,
  from: TileCoord,
  isGoal: (t: TileCoord) => boolean,
  blocked: (t: TileCoord) => boolean = () => false,
): Direction | null {
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
      if (blocked(nxt)) continue; // marked visited first: never revisited, never entered
      queue.push({ coord: nxt, firstDir: node.firstDir ?? dir });
    }
  }
  return null;
}

const OPPOSITE: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left' };
const YARD_EXPLORE_CHANCE = 0.15; // chance to dip off the street into a yard
const CONTINUE_CHANCE = 0.8; // chance to keep heading straight down the street

const pick = (dirs: Direction[], rng: () => number): Direction => dirs[Math.floor(rng() * dirs.length)];

// Cohesive street-search patrol (advanced mode's no-scent behaviour). Bandit
// sticks mostly to pavement: he keeps heading down the street, avoids doubling
// back, and only occasionally dips into an adjacent yard — from which he then
// biases straight back toward the street. Stateless: the "return to street"
// emerges from a strong pavement preference, so no history is stored on Bandit.
export function patrolStep(
  grid: Grid,
  from: TileCoord,
  facing: Direction,
  rng: () => number,
  blocked: (t: TileCoord) => boolean = () => false,
): Direction | null {
  // Wandering must respect the repeller too, or he'd stroll into a zone his
  // pathfinding carefully routes around. If every way out is blocked he is
  // standing inside one, and `repellerBlocks` has already stood that one down.
  const open = DIRS.filter((d) => grid.canMove(from, d) && !blocked(grid.neighbor(from, d)));
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
export interface BanditMove {
  dir: Direction;
  mode: BanditMode;
}

// A family yard Bandit can foul to relieve himself, tagged with its owner (so a
// relief episode can commit to one yard) and that owner's current affection (so
// he picks the most-liked one to begin with).
export interface RelieveTarget {
  tile: TileCoord;
  ownerId: number;
  affection: number;
}

// Bandit's three mutually-exclusive behaviour modes. He stays in whichever one
// he entered until its exit condition fires — no mode preempts another, which is
// what stops him dribbling waste across half the block.
// `rawhide` is the one mode that preempts the others — see BanditController.
export type BanditGoal = 'treat' | 'relief' | 'water' | 'rawhide';

// The HUD's label for a goal. Relief names the channel he is actually draining,
// taken from the episode's own state — NOT inferred from what he happens to be
// carrying. The old inventory sniff (`inv.poop > 1 ? poop : pee`) answered "is he
// holding drainable poop", so a pee-triggered trip read "Need to Poop!" whenever
// he also carried poop.
export function banditGoalLabel(goal: BanditGoal, channel: WasteChannel | null): string {
  if (goal === 'rawhide') return 'Rawhide!';
  if (goal === 'water') return 'Needs Water!';
  if (goal === 'relief') return channel === 'pee' ? 'Need to Pee!' : 'Need to Poop!';
  return 'Looking for Treats';
}

// Rank relieve targets so Bandit fouls the most-liked yard first: affection
// descending, ties broken by nearest, then by original order (fully stable /
// deterministic). Pure; does not consider reachability — the caller walks the
// ranked list and takes the first reachable one.
export function rankRelieveTargets(from: TileCoord, targets: RelieveTarget[]): RelieveTarget[] {
  return targets
    .map((t, i) => ({ t, i, d: manhattan(from, t.tile) }))
    .sort((a, b) => b.t.affection - a.t.affection || a.d - b.d || a.i - b.i)
    .map((x) => x.t);
}

// Bandit's poop or pee has crossed the level that sends him to a yard to relieve.
// Shared by the AI (path toward a yard) and BanditController (commit to fouling).
export function needsRelieve(inv: Inventory): boolean {
  return inv.poop >= config.BANDIT_RELIEVE_THRESHOLD || inv.pee >= config.BANDIT_RELIEVE_THRESHOLD;
}

// The relieve target Bandit heads for, and the yard it belongs to.
//
// `committedOwnerId` is the yard he's already emptying on: his own fouling drops
// that owner's affection, so re-ranking every tick would hand the "most-liked"
// crown to a neighbour and walk him off with most of his load still held. While
// committed he only considers that yard's tiles; the affection ranking is
// consulted again solely when the yard has no reachable room left (it saturated),
// which is how the episode hands off to the next-best yard. Pure.
export function firstReachableRelieveTarget(
  grid: Grid,
  from: TileCoord,
  relieveTargets: RelieveTarget[],
  committedOwnerId: number | null = null,
  blocked: (t: TileCoord) => boolean = () => false,
): { tile: TileCoord; ownerId: number; dir: Direction | null } | null {
  const stepTo = (
    target: RelieveTarget,
  ): { tile: TileCoord; ownerId: number; dir: Direction | null } | null => {
    // The tile under his paws is a hit with no step to take. bfsFirstStep can
    // never return it (its seed node carries no first direction), so without
    // this case the last foulable tile of a committed yard reads as unreachable
    // — and he'd abandon the yard, and the commitment, one tile early.
    if (target.tile.col === from.col && target.tile.row === from.row) {
      return { tile: target.tile, ownerId: target.ownerId, dir: null };
    }
    const dir = bfsFirstStep(
      grid,
      from,
      (t) => t.col === target.tile.col && t.row === target.tile.row,
      blocked,
    );
    return dir ? { tile: target.tile, ownerId: target.ownerId, dir } : null;
  };
  if (committedOwnerId !== null) {
    for (const target of rankRelieveTargets(
      from,
      relieveTargets.filter((t) => t.ownerId === committedOwnerId),
    )) {
      const hit = stepTo(target);
      if (hit) return hit;
    }
  }
  for (const target of rankRelieveTargets(from, relieveTargets)) {
    const hit = stepTo(target);
    if (hit) return hit;
  }
  return null;
}

// Bandit's next move for the goal he's currently in (BanditController owns the
// mode; this just routes). `relief` walks to his committed yard's nearest
// foulable tile, `water` beelines to the nearest water with no treat detour, and
// `treat` heads for the best food — smell-gated in advanced mode, anywhere in
// omniscient mode (read live, so a dev-panel toggle lands on the next move) —
// falling back to the half-speed street patrol. Each goal falls through to the
// treat chain when its own target is unreachable, so he never stands still.
// All goal-directed moves are full-speed chases.
/**
 * The best food a walker can actually WALK to, plus the first step toward it.
 *
 * `bestFoodAnywhere` ranks by value over *manhattan* distance, but the step
 * comes from a real path — which frequently moves away in straight-line terms to
 * get round a fence. Re-picking every tick therefore oscillates: leave a yard by
 * its only exit, the target's manhattan distance grows, a different treat now
 * scores higher, and the next step walks straight back in. Callers commit to the
 * returned food and only re-pick when it is gone, which is what actually stops
 * the loop; this function's job is to never hand back a target with no path.
 */
export function firstReachableFood(
  grid: Grid,
  from: TileCoord,
  foods: Food[],
  blocked: (t: TileCoord) => boolean = () => false,
): { food: Food; dir: Direction } | null {
  const ranked = [...foods].sort(
    (a, b) => b.value / (manhattan(from, b.tile) + 1) - a.value / (manhattan(from, a.tile) + 1),
  );
  for (const food of ranked) {
    const dir = bfsFirstStep(grid, from, (t) => t.col === food.tile.col && t.row === food.tile.row, blocked);
    if (dir) return { food, dir };
  }
  return null;
}

export interface BanditMoveContext {
  goal?: BanditGoal;
  relieveTargets?: RelieveTarget[];
  committedOwnerId?: number | null;
  /** Where a deployed rawhide is, when he's going for it. */
  rawhideTile?: TileCoord | null;
  /** Tiles he refuses to enter (repeller zones). */
  blocked?: (t: TileCoord) => boolean;
}

export function nextBanditMove(
  grid: Grid,
  bandit: Bandit,
  foods: Food[],
  rng: () => number,
  ctx: BanditMoveContext = {},
): BanditMove | null {
  const goal = ctx.goal ?? 'treat';
  const blocked = ctx.blocked ?? (() => false);
  const stepTo = (isGoal: (t: TileCoord) => boolean) => bfsFirstStep(grid, bandit.tile, isGoal, blocked);

  if (goal === 'rawhide' && ctx.rawhideTile) {
    const t = ctx.rawhideTile;
    const dir = stepTo((c) => c.col === t.col && c.row === t.row);
    if (dir) return { dir, mode: 'chase' };
    if (bandit.tile.col === t.col && bandit.tile.row === t.row) return null; // arrived; settle in
  }
  if (goal === 'relief') {
    const target = firstReachableRelieveTarget(
      grid,
      bandit.tile,
      ctx.relieveTargets ?? [],
      ctx.committedOwnerId ?? null,
      blocked,
    );
    if (target) return target.dir ? { dir: target.dir, mode: 'chase' } : null; // null dir: already on it, stay
  }
  if (goal === 'water') {
    const toWater = stepTo((t) => isWaterAdjacent(grid, t));
    if (toWater) return { dir: toWater, mode: 'chase' };
  }
  const food = banditSettings.omniscient
    ? bestFoodAnywhere(bandit.tile, foods)
    : bestSmelledFood(bandit.tile, foods);
  if (food) {
    const toFood = stepTo((t) => t.col === food.tile.col && t.row === food.tile.row);
    if (toFood) return { dir: toFood, mode: 'chase' };
  }
  const dir = patrolStep(grid, bandit.tile, bandit.facing, rng, blocked);
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
