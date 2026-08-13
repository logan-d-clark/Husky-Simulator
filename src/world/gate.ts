import type { GameMap } from './MapParser';
import { GATE_TILES } from '../config/constants';

// The Grumbles' driveway gate. It is deliberately not a new kind of obstacle:
// it toggles the same `fences.right` flag the map format already uses, so
// Grid.canMove, both dogs' BFS, and every other consumer of the fence rules need
// to know nothing about gates at all.

/** Shut or open the gate on a parsed map. */
export function setGate(map: GameMap, shut: boolean): void {
  for (const g of GATE_TILES) map.tiles[g.row][g.col].fences.right = shut;
}

/**
 * One second of the countdown. Split out of GameScene so the boundary — the
 * exact second he gets out — is testable; the scene keeps only the sprites and
 * the sound.
 */
export function advanceGateSeconds(secondsLeft: number): { secondsLeft: number; open: boolean } {
  const next = secondsLeft - 1;
  return { secondsLeft: next, open: next <= 0 };
}
