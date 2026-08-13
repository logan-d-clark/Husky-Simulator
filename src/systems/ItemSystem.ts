import type { TileCoord } from '../types';
import { config } from '../config/gameConfig';
import { ITEM_TYPES, type ItemType } from '../entities/Item';

// Every decision the item system makes, kept pure so it unit-tests without
// Phaser. GameScene owns only sprites, timers and input.

export type ItemCounts = Record<ItemType, number>;

export function emptyCounts(): ItemCounts {
  return { rawhide: 0, repeller: 0, diaper: 0, zoomies: 0 };
}

/**
 * Per-tick chance that an item drops somewhere on the map. Scales with the food
 * Blizzard is carrying, so the endgame hands out more of them — the rate
 * doubles for every ITEM_DROP_FOOD_SCALE food held. Negative food (possible
 * mid-tick before clamping) is floored so the chance can never invert.
 */
export function itemDropChance(food: number): number {
  return config.ITEM_DROP_PER_TICK * (1 + Math.max(0, food) / config.ITEM_DROP_FOOD_SCALE);
}

/**
 * How many food milestones have been reached. The caller grants an item for
 * each newly-crossed one, so tracking the highest count reached (rather than
 * testing a boundary) means dipping below and climbing back cannot pay twice.
 */
export function milestoneCount(food: number): number {
  return Math.max(0, Math.floor(food / config.ITEM_MILESTONE_FOOD));
}

export function randomItemType(rand: () => number): ItemType {
  const i = Math.floor(rand() * ITEM_TYPES.length);
  return ITEM_TYPES[Math.min(ITEM_TYPES.length - 1, Math.max(0, i))];
}

export function grant(counts: ItemCounts, type: ItemType): void {
  counts[type] += 1;
}

/** Spend one, if there is one. False means the player pressed a key for an item they don't have. */
export function consume(counts: ItemCounts, type: ItemType): boolean {
  if (counts[type] <= 0) return false;
  counts[type] -= 1;
  return true;
}

/**
 * How many milestone payouts are owed. A single big pickup can cross more than
 * one boundary at once, so this is a count, not a boolean.
 */
export function milestonesToGrant(alreadyPaid: number, food: number): number {
  return Math.max(0, milestoneCount(food) - alreadyPaid);
}

/**
 * The next item still owed its first-pickup tutorial. Granting can happen more
 * than once in a frame (a pickup during a tween, plus a milestone in the same
 * tick), and each launch of the overlay would replace the last — so tutorials
 * queue and are shown one at a time.
 */
export function nextTutorial(seen: ReadonlySet<ItemType>, queued: readonly ItemType[]): ItemType | null {
  return queued.find((t) => !seen.has(t)) ?? null;
}

export interface Repeller { tile: TileCoord; secondsLeft: number }

/**
 * One second of repeller countdown: the survivors (decremented) and the ones
 * that just expired, so the caller can tear their sprites down.
 */
export function tickRepellers<T extends Repeller>(repellers: readonly T[]): { alive: T[]; expired: T[] } {
  const alive: T[] = [], expired: T[] = [];
  for (const r of repellers) {
    r.secondsLeft -= 1;
    (r.secondsLeft > 0 ? alive : expired).push(r);
  }
  return { alive, expired };
}

const withinRadius = (a: TileCoord, b: TileCoord, radius: number): boolean =>
  (a.col - b.col) ** 2 + (a.row - b.row) ** 2 <= radius ** 2;

/**
 * The tiles Bandit refuses to enter, as a predicate for `bfsFirstStep`.
 *
 * A repeller Bandit is ALREADY inside stops applying to him. Without that, one
 * dropped on his head would make every neighbouring tile illegal and freeze him
 * where he stands — the item prevents him coming near, it does not cage him.
 */
export function repellerBlocks(
  repellers: readonly Repeller[], banditTile: TileCoord,
): (t: TileCoord) => boolean {
  const r = config.REPELLER_RADIUS;
  const active = repellers.filter((rep) => !withinRadius(banditTile, rep.tile, r));
  if (active.length === 0) return () => false;
  return (t) => active.some((rep) => withinRadius(t, rep.tile, r));
}
