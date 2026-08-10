import { describe, it, expect } from 'vitest';
import { Owner } from '../../src/entities/Owner';
import { AffectionSystem } from '../../src/systems/AffectionSystem';
import type { OwnerData } from '../../src/data/owners';
import { config } from '../../src/config/gameConfig';

const data = (over: Partial<OwnerData> = {}): OwnerData => ({
  id: 5, affection: 50, sensitivity: 2, treatRateBase: 0.5, name: 'Test', ...over,
});

describe('AffectionSystem', () => {
  it('active treat rate scales with affection', () => {
    const o = new Owner(data({ affection: 25, treatRateBase: 0.001 }));
    expect(o.treatRateActive).toBeCloseTo(0.001);
  });
  it('pee reduces affection by cost*sensitivity', () => {
    const o = new Owner(data({ affection: 3, sensitivity: 2 }));
    AffectionSystem.applyAction(o, 'pee');
    expect(o.affection).toBeCloseTo(3 - config.PEE_COST * 2);
  });

  it('floors affection at 0 rather than going negative', () => {
    const o = new Owner(data({ affection: config.PEE_COST, sensitivity: 2 }));
    AffectionSystem.applyAction(o, 'pee'); // costs more than is left
    expect(o.affection).toBe(0);
  });
  it('trick raises affection capped at 100', () => {
    const o = new Owner(data({ affection: 99.5 }));
    AffectionSystem.applyAction(o, 'trick');
    expect(o.affection).toBe(100);
  });
  it('dispense picks bag above BAG_THRESHOLD with low roll', () => {
    const o = new Owner(data({ affection: 95, treatRateBase: 100 }));
    // p is huge; a very low roll -> bag
    expect(AffectionSystem.rollDispense(o, () => 0.0001)).toBe('bag');
  });
  it('dispense returns null when roll exceeds p', () => {
    const o = new Owner(data({ affection: 10, treatRateBase: 0.0001 }));
    expect(AffectionSystem.rollDispense(o, () => 0.99)).toBeNull();
  });
});
