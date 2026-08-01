import { describe, it, expect } from 'vitest';
import { tolerancePips, pipString, heatLabel, TOLERANCE_MAX } from '../src/ui/indicators';
import { HEAT_GRASS, HEAT_PAVEMENT } from '../src/config/constants';

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
