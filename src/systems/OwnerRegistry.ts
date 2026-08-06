import { OWNERS } from '../data/owners';
import { Owner } from '../entities/Owner';
import { AffectionSystem } from './AffectionSystem';
import { foodValue, type Food } from '../entities/Food';
import type { GameMap } from '../world/MapParser';
import type { TileCoord } from '../types';
import type { RelieveTarget } from './AISystem';

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

// Bandit's relieve targets: one per family yard (its centroid tile + the owner's
// current affection). The public/street owner has no grass, so `yardCentroid`
// returns null for it and it is naturally excluded — Bandit only fouls yards.
export function buildRelieveTargets(map: GameMap, reg: OwnerRegistry): RelieveTarget[] {
  const targets: RelieveTarget[] = [];
  for (const owner of reg.all()) {
    const centroid = yardCentroid(map, owner.id);
    if (centroid) targets.push({ tile: centroid, affection: owner.affection });
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
