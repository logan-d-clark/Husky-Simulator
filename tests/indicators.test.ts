import { describe, it, expect } from 'vitest';
import { tolerancePips, pipString, heatLabel, thresholdMarkerX, TOLERANCE_MAX } from '../src/ui/indicators';
import { DEFAULTS } from '../src/config/gameConfig';

const HEAT_GRASS = DEFAULTS.HEAT_GRASS;
const HEAT_PAVEMENT = DEFAULTS.HEAT_PAVEMENT;

describe('tolerancePips', () => {
  it('inverts sensitivity: least sensitive = most tolerant', () => {
    expect(tolerancePips(0)).toBe(5); // Public
    expect(tolerancePips(1)).toBe(4);
    expect(tolerancePips(3)).toBe(2);
    expect(tolerancePips(5)).toBe(0); // The Grumbles
  });
  it('clamps out-of-range sensitivity', () => {
    expect(tolerancePips(6)).toBe(0);
    expect(tolerancePips(-2)).toBe(TOLERANCE_MAX);
  });
});

describe('pipString', () => {
  it('renders filled then empty pips', () => {
    expect(pipString(4)).toBe('●●●●○');
    expect(pipString(0)).toBe('○○○○○');
    expect(pipString(5)).toBe('●●●●●');
  });
  it('clamps overflow', () => {
    expect(pipString(9)).toBe('●●●●●');
  });
});

describe('heatLabel', () => {
  it('pavement-hot tiles are High, cooler tiles Low', () => {
    expect(heatLabel(HEAT_PAVEMENT)).toBe('High');
    expect(heatLabel(HEAT_GRASS)).toBe('Low');
    expect(heatLabel(0)).toBe('Low');
  });
});

describe('thresholdMarkerX', () => {
  const LEFT = 100, WIDTH = 200;

  it('puts 0 at the left edge of the bar and 100 at its right', () => {
    expect(thresholdMarkerX(0, LEFT, WIDTH)).toBe(LEFT);
    expect(thresholdMarkerX(100, LEFT, WIDTH)).toBe(LEFT + WIDTH);
  });

  it('places a threshold proportionally along the bar', () => {
    expect(thresholdMarkerX(50, LEFT, WIDTH)).toBe(LEFT + WIDTH / 2);
    expect(thresholdMarkerX(90, LEFT, WIDTH)).toBe(LEFT + WIDTH * 0.9);
  });

  it('lines the real food thresholds up in ascending order', () => {
    const bowl = thresholdMarkerX(DEFAULTS.BOWL_THRESHOLD, LEFT, WIDTH);
    const bag = thresholdMarkerX(DEFAULTS.BAG_THRESHOLD, LEFT, WIDTH);
    const pupcup = thresholdMarkerX(DEFAULTS.PUPCUP_THRESHOLD, LEFT, WIDTH);
    expect(bowl).toBeLessThan(bag);
    expect(bag).toBeLessThan(pupcup);
    expect(pupcup).toBe(LEFT + WIDTH); // the pup cup gate is the very top of the scale
  });

  it('clamps a threshold tuned outside the scale so the marker stays on the bar', () => {
    expect(thresholdMarkerX(-10, LEFT, WIDTH)).toBe(LEFT);
    expect(thresholdMarkerX(150, LEFT, WIDTH)).toBe(LEFT + WIDTH);
  });

  it('respects a bar that does not start at the origin', () => {
    expect(thresholdMarkerX(50, 0, WIDTH)).toBe(WIDTH / 2);
  });
});
