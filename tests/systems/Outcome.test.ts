import { describe, it, expect } from 'vitest';
import { roundOutcome, type EndReason } from '../../src/systems/Outcome';
import { ResourceSystem } from '../../src/systems/ResourceSystem';

describe('roundOutcome', () => {
  it('does NOT call a dry dog the winner, however far ahead he was', () => {
    // The shipped bug: `won = huskyFood >= chiFood` ignored the reason, so this
    // printed "Blizzard wins!" over a screen saying he ran out of water.
    const out = roundOutcome('Water', 5000, 10);
    expect(out.won).toBe(false);
    expect(out.detail).toMatch(/water/i);
  });

  it('does not call a starved dog the winner either', () => {
    const out = roundOutcome('Food', 5000, 10);
    expect(out.won).toBe(false);
    expect(out.detail).toMatch(/food/i);
  });

  it('wins on lasting the round AND finishing ahead', () => {
    const out = roundOutcome('Time', 900, 400);
    expect(out.won).toBe(true);
  });

  it('loses on lasting the round but finishing behind', () => {
    const out = roundOutcome('Time', 400, 900);
    expect(out.won).toBe(false);
    expect(out.detail).toMatch(/more food/i);
  });

  it('gives a dead heat to Blizzard', () => {
    expect(roundOutcome('Time', 500, 500).won).toBe(true);
  });

  it('needs BOTH conditions — neither alone is enough', () => {
    expect(roundOutcome('Time', 100, 500).won).toBe(false); // survived only
    expect(roundOutcome('Water', 500, 100).won).toBe(false); // out-ate only
    expect(roundOutcome('Time', 500, 100).won).toBe(true); // both
  });

  it('always says something, and says why', () => {
    for (const reason of ['Time', 'Food', 'Water'] as EndReason[]) {
      for (const [h, c] of [
        [10, 500],
        [500, 10],
      ]) {
        const out = roundOutcome(reason, h, c);
        expect(out.headline.length, reason).toBeGreaterThan(0);
        expect(out.detail.length, reason).toBeGreaterThan(10);
      }
    }
  });
});

describe('shouldEndGame precedence', () => {
  // The clock and a bar can empty on the same tick. Reporting 'Time' then would
  // print "lasted the whole day AND out-ate Bandit" over a starved dog — and,
  // with a 0-0 food tie, hand him the win.
  it('reports running out, not the buzzer, when both land together', () => {
    expect(ResourceSystem.shouldEndGame({ food: 0, water: 50, poop: 0, pee: 0 }, 0)).toBe('Food');
    expect(ResourceSystem.shouldEndGame({ food: 50, water: 0, poop: 0, pee: 0 }, 0)).toBe('Water');
  });

  it('still reports Time when he is alive at the buzzer', () => {
    expect(ResourceSystem.shouldEndGame({ food: 10, water: 10, poop: 0, pee: 0 }, 0)).toBe('Time');
  });

  it('ends nothing while he is alive with time on the clock', () => {
    expect(ResourceSystem.shouldEndGame({ food: 10, water: 10, poop: 0, pee: 0 }, 5)).toBeNull();
  });

  it('and so a same-tick tie is no longer a win', () => {
    const reason = ResourceSystem.shouldEndGame({ food: 0, water: 0, poop: 0, pee: 0 }, 0)!;
    expect(roundOutcome(reason, 0, 0).won).toBe(false);
  });
});
