import { describe, it, expect, afterEach } from 'vitest';
import { WarningTracker, risingEdges } from '../../src/audio/triggers';
import { config, resetConfig } from '../../src/config/gameConfig';
import type { Inventory } from '../../src/types';

afterEach(() => resetConfig());

const inv = (over: Partial<Inventory> = {}): Inventory =>
  ({ food: 100, water: 100, poop: 0, pee: 0, ...over });

describe('WarningTracker', () => {
  it('stays silent while everything is healthy', () => {
    expect(new WarningTracker().check(inv())).toEqual([]);
  });

  it('fires once on crossing, then stays quiet while the stat sits low', () => {
    const t = new WarningTracker();
    expect(t.check(inv({ food: config.WARN_FOOD_LOW + 1 }))).toEqual([]);
    expect(t.check(inv({ food: config.WARN_FOOD_LOW }))).toEqual(['warnFood']);
    // ...and not again on any of the ~10 ticks a second that follow
    for (let i = 0; i < 20; i++) {
      expect(t.check(inv({ food: config.WARN_FOOD_LOW - i * 0.1 }))).toEqual([]);
    }
  });

  it('does not re-arm on a twitch back over the line', () => {
    const t = new WarningTracker();
    t.check(inv({ food: config.WARN_FOOD_LOW }));
    t.check(inv({ food: config.WARN_FOOD_LOW + 0.5 }));   // barely recovered — not enough
    expect(t.check(inv({ food: config.WARN_FOOD_LOW }))).toEqual([]);
  });

  it('re-arms after a real recovery and warns again', () => {
    const t = new WarningTracker();
    t.check(inv({ food: config.WARN_FOOD_LOW }));
    t.check(inv({ food: config.WARN_FOOD_LOW * 1.5 }));   // properly fed again
    expect(t.check(inv({ food: config.WARN_FOOD_LOW }))).toEqual(['warnFood']);
  });

  it('warns on low water', () => {
    const t = new WarningTracker();
    expect(t.check(inv({ water: config.WARN_WATER_LOW }))).toEqual(['warnWater']);
  });

  it('warns on HIGH pee — the one threshold that triggers from above', () => {
    const t = new WarningTracker();
    expect(t.check(inv({ pee: config.WARN_PEE_HIGH - 1 }))).toEqual([]);
    expect(t.check(inv({ pee: config.WARN_PEE_HIGH }))).toEqual(['warnPee']);
    expect(t.check(inv({ pee: config.WARN_PEE_HIGH + 10 }))).toEqual([]);
  });

  it('re-arms pee after he relieves himself', () => {
    const t = new WarningTracker();
    t.check(inv({ pee: config.WARN_PEE_HIGH }));
    t.check(inv({ pee: 5 }));
    expect(t.check(inv({ pee: config.WARN_PEE_HIGH }))).toEqual(['warnPee']);
  });

  it('reports every warning that crosses on the same tick', () => {
    const t = new WarningTracker();
    const all = t.check(inv({ food: 1, water: 1, pee: config.WARN_PEE_HIGH }));
    expect(all.sort()).toEqual(['warnFood', 'warnPee', 'warnWater']);
  });

  it('does not machine-gun when a threshold is tuned to zero', () => {
    // The hysteresis margin is proportional, so at 0 it collapses to the bare
    // threshold. Locking in that this degrades to fire-once, not fire-forever.
    const t = new WarningTracker();
    config.WARN_PEE_HIGH = 0;
    expect(t.check(inv({ pee: 0 }))).toEqual(['warnPee']);
    for (let i = 0; i < 10; i++) expect(t.check(inv({ pee: 50 }))).toEqual([]);
  });

  it('follows a dev-panel threshold change immediately', () => {
    const t = new WarningTracker();
    expect(t.check(inv({ food: 50 }))).toEqual([]);
    config.WARN_FOOD_LOW = 60; // tuned live in the dev panel
    expect(t.check(inv({ food: 50 }))).toEqual(['warnFood']);
  });
});

describe('risingEdges', () => {
  it('reports only the actions that just started', () => {
    expect(risingEdges({ poop: false, pee: true }, { poop: true, pee: true })).toEqual(['poop']);
  });
  it('is silent while an action is held', () => {
    expect(risingEdges({ poop: true }, { poop: true })).toEqual([]);
  });
  it('is silent when an action stops', () => {
    expect(risingEdges({ poop: true }, { poop: false })).toEqual([]);
  });
  it('re-fires after a release and a fresh press', () => {
    expect(risingEdges({ poop: false }, { poop: true })).toEqual(['poop']);
  });
  it('handles empty input', () => {
    expect(risingEdges({}, {})).toEqual([]);
  });
  it('handles several at once', () => {
    const out = risingEdges({ a: false, b: false, c: true }, { a: true, b: true, c: true });
    expect(out.sort()).toEqual(['a', 'b']);
  });
});
