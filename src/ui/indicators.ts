import { config } from '../config/gameConfig';

// Player-friendly mappings for raw backend tile/owner values.

export const TOLERANCE_MAX = 5;

// Owner sensitivity is inverse to tolerance: a highly sensitive owner tolerates
// little. Returns the number of filled pips out of TOLERANCE_MAX (5 = most
// tolerant), clamped into range.
export function tolerancePips(sensitivity: number): number {
  const pips = TOLERANCE_MAX - Math.round(sensitivity);
  return Math.max(0, Math.min(TOLERANCE_MAX, pips));
}

// Compact pip string, e.g. 4 -> "●●●●○".
export function pipString(filled: number, max = TOLERANCE_MAX): string {
  const n = Math.max(0, Math.min(max, filled));
  return '●'.repeat(n) + '○'.repeat(max - n);
}

// Tiles at or above pavement heat read as "High"; cooler tiles (grass, houses,
// water) read as "Low".
export function heatLabel(heat: number): 'Low' | 'High' {
  return heat >= config.HEAT_PAVEMENT ? 'High' : 'Low';
}
