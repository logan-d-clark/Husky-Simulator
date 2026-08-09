import { OWNERS } from '../data/owners';
import { Owner } from '../entities/Owner';
import { AffectionSystem } from './AffectionSystem';
import { foodValue, type Food } from '../entities/Food';
import type { GameMap } from '../world/MapParser';
import type { TileCoord, Inventory } from '../types';
import { canFoulTile, type RelieveTarget } from './AISystem';

export class OwnerRegistry {
  private byId = new Map<number, Owner>();
  constructor() { for (const d of OWNERS) this.byId.set(d.id, new Owner(d)); }
  get(id: number): Owner {
    const o = this.byId.get(id);
    if (!o) throw new Error(`No owner ${id}`);
    return o;
  }
  all(): Owner[] { return [...this.byId.values()]; }
}

export function yardCentroid(map: GameMap, ownerId: number): TileCoord | null {
  const owned: TileCoord[] = [];
  for (const row of map.tiles) for (const t of row) {
    if (t.type === 'grass' && t.ownerId === ownerId) owned.push({ col: t.col, row: t.row });
  }
  if (owned.length === 0) return null;
  const avgCol = owned.reduce((s, c) => s + c.col, 0) / owned.length;
  const avgRow = owned.reduce((s, c) => s + c.row, 0) / owned.length;
  // snap to the owned tile nearest the average
  let best = owned[0]; let bestD = Infinity;
  for (const c of owned) {
    const d = (c.col - avgCol) ** 2 + (c.row - avgRow) ** 2;
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

// Bandit's relieve targets: one per **available** (foulable) family-yard grass
// tile, tagged with its owner's current affection. He then heads for the nearest
// available tile of the most-liked yard, spreading across the yard as tiles fill
// and only moving on when a whole yard is full. The public/street owner (id 0)
// is excluded — Bandit only fouls family yards.
export function buildRelieveTargets(map: GameMap, reg: OwnerRegistry, inv: Inventory): RelieveTarget[] {
  const targets: RelieveTarget[] = [];
  for (const row of map.tiles) {
    for (const t of row) {
      if (t.type !== 'grass' || t.ownerId === 0 || !canFoulTile(inv, t)) continue;
      targets.push({ tile: { col: t.col, row: t.row }, ownerId: t.ownerId, affection: reg.get(t.ownerId).affection });
    }
  }
  return targets;
}

export function dispenseOverMap(
  map: GameMap, reg: OwnerRegistry, rand: () => number, emit: (food: Food) => void,
): void {
  for (const row of map.tiles) for (const t of row) {
    if (t.type !== 'grass' || t.foodPresent) continue;
    const owner = reg.get(t.ownerId);
    const type = AffectionSystem.rollDispense(owner, rand);
    if (type) {
      t.foodPresent = true;
      emit({ type, value: foodValue(type), tile: { col: t.col, row: t.row } });
    }
  }
}
