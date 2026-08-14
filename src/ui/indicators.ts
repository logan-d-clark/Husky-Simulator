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

// Where a food's affection threshold sits along an affection bar, in pixels
// from the bar's left edge. Affection runs 0..100 across the full bar width, so
// a 0 threshold lands on the left edge and 100 on the right. Clamped, so a
// dev-panel threshold tuned outside the scale still draws on the bar.
export function thresholdMarkerX(threshold: number, barLeft: number, barWidth: number): number {
  const frac = Math.max(0, Math.min(1, threshold / 100));
  return barLeft + frac * barWidth;
}

// Tiles at or above pavement heat read as "High"; cooler tiles (grass, houses,
// water) read as "Low".
export function heatLabel(heat: number): 'Low' | 'High' {
  return heat >= config.HEAT_PAVEMENT ? 'High' : 'Low';
}

// Seconds as M:SS. Shared by the round clock and the penned-Bandit countdown so
// the padding arithmetic exists once.
//
// The negative clamp is unconditional defence, not a frame anyone has observed:
// today both callers stop at zero on their own (advanceGateSeconds opens the
// gate at <= 0, shouldEndGame ends the round at <= 0), so the lowest value ever
// rendered is "0:01". It is here so a future caller cannot put "-1:-5" on screen.
export function formatClock(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${mm}:${ss.toString().padStart(2, '0')}`;
}
