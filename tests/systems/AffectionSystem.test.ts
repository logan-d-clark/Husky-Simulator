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

  describe('pup cups', () => {
    // rollDispense draws twice at a maxed yard: once for the pup cup, then once
    // for the existing chain. `rolls` feeds an explicit sequence so each draw is
    // controlled rather than inferred.
    const rolls = (...vals: number[]) => { let i = 0; return () => vals[Math.min(i++, vals.length - 1)]; };
    // treatRateActive = base * affection/25, so base 0.25 at affection 100 gives
    // p = 1 and the likelihood bands are their literal values. (A huge base, as
    // the bag test uses, makes every band exceed 1 so no roll can ever miss.)
    const BASE = 0.25;
    const maxed = () => new Owner(data({ affection: config.PUPCUP_THRESHOLD, treatRateBase: BASE }));

    it('needs a perfectly maxed yard — one point short is never enough', () => {
      const almost = new Owner(data({ affection: config.PUPCUP_THRESHOLD - 1, treatRateBase: BASE }));
      // Even the luckiest possible roll cannot produce one.
      expect(AffectionSystem.rollDispense(almost, rolls(0))).not.toBe('pupcup');
    });

    it('dispenses at a maxed yard on a winning roll', () => {
      expect(AffectionSystem.rollDispense(maxed(), rolls(0.0001))).toBe('pupcup');
    });

    it('STILL dispenses bags at a maxed yard when the pup cup roll misses', () => {
      // The regression the independent roll exists to prevent: folding pup cups
      // into the chain at equal likelihood would have eaten the bag's band, so
      // maxing a yard would silently stop it producing bags.
      expect(AffectionSystem.rollDispense(maxed(), rolls(0.99, 0.0001))).toBe('bag');
    });

    it('leaves the treat/bowl/bag chain untouched below the threshold', () => {
      // Same owner, same single roll value, with and without the pup cup branch
      // reachable — the outcome must not depend on affection being 99 vs 100.
      const below = new Owner(data({ affection: 95, treatRateBase: BASE }));
      expect(AffectionSystem.rollDispense(below, rolls(0.0001))).toBe('bag');
      expect(AffectionSystem.rollDispense(maxed(), rolls(0.99, 0.0001))).toBe('bag');
    });

    it('is as likely as a bag — the 100-affection gate is the scarcity', () => {
      expect(config.PUPCUP_LIKELIHOOD).toBe(config.BAG_LIKELIHOOD);
    });
  });
});
