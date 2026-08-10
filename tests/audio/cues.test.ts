import { describe, it, expect } from 'vitest';
import { CUES, eatCue, cueForBanditGoal, type CueName } from '../../src/audio/cues';
import { config } from '../../src/config/gameConfig';

const names = Object.keys(CUES) as CueName[];

describe('cues', () => {
  it('covers every sound the game triggers', () => {
    expect(names.sort()).toEqual([
      'banditRelief', 'banditTreat', 'banditWater',
      'drink', 'eat', 'pee', 'poop', 'trick',
      'warnFood', 'warnPee', 'warnWater',
    ]);
  });

  it('every cue is playable — audible notes, positive durations, sane gain', () => {
    for (const name of names) {
      const steps = CUES[name];
      expect(steps.length, name).toBeGreaterThan(0);
      for (const s of steps) {
        expect(s.dur, name).toBeGreaterThan(0);
        expect(s.freq, name).toBeGreaterThan(20);      // below this is inaudible rumble
        expect(s.freq, name).toBeLessThan(12000);
        expect(s.gain, name).toBeGreaterThan(0);
        expect(s.gain, name).toBeLessThanOrEqual(1);
      }
    }
  });

  it('keeps every cue short enough to not overlap the next tick meaningfully', () => {
    for (const name of names) {
      const total = CUES[name].reduce((s, t) => s + t.dur, 0);
      expect(total, name).toBeLessThan(0.6);
    }
  });

  it('mixes Bandit quieter than Blizzard so the rival never masks your own feedback', () => {
    const peak = (n: CueName) => Math.max(...CUES[n].map((s) => s.gain));
    const bandit = Math.max(peak('banditTreat'), peak('banditRelief'), peak('banditWater'));
    const blizzard = Math.min(peak('eat'), peak('drink'), peak('trick'));
    expect(bandit).toBeLessThan(blizzard);
  });

  describe('eatCue', () => {
    const treat = config.TREAT_VALUE;
    const freqs = (v: number) => eatCue(v, treat).map((s) => s.freq);

    it('plays a plain treat at the base pitch', () => {
      expect(freqs(treat)).toEqual(CUES.eat.map((s) => s.freq));
    });

    it('pitches a bowl above a treat, and a bag above a bowl', () => {
      const t = freqs(treat)[0];
      const bowl = freqs(treat * config.BOWL_MULTIPLIER)[0];
      const bag = freqs(treat * config.BAG_MULTIPLIER)[0];
      expect(bowl).toBeGreaterThan(t);
      expect(bag).toBeGreaterThan(bowl);
    });

    it('stays in register no matter how large the value gets', () => {
      for (const f of freqs(treat * 1000)) {
        expect(f).toBeLessThan(12000);
        expect(f).toBeGreaterThan(20);
      }
    });

    it('never drops below the base pitch for a worthless pickup', () => {
      expect(freqs(0)[0]).toBeCloseTo(CUES.eat[0].freq);
    });

    it('survives TREAT_VALUE being tuned to zero in the dev panel', () => {
      // 0/0 is NaN, and Web Audio throws on a non-finite frequency — from
      // inside the movement chain, which would then stall.
      for (const f of eatCue(10, 0).map((x) => x.freq)) expect(Number.isFinite(f)).toBe(true);
      for (const f of eatCue(0, 0).map((x) => x.freq)) expect(Number.isFinite(f)).toBe(true);
    });

    it('never emits a non-finite frequency for a negative value', () => {
      for (const f of eatCue(-50, treat).map((x) => x.freq)) expect(Number.isFinite(f)).toBe(true);
    });
  });

  describe('cueForBanditGoal', () => {
    it('maps each mode to its own cue', () => {
      expect(cueForBanditGoal('treat')).toBe('banditTreat');
      expect(cueForBanditGoal('relief')).toBe('banditRelief');
      expect(cueForBanditGoal('water')).toBe('banditWater');
    });
    it('only ever names a cue that exists', () => {
      for (const g of ['treat', 'relief', 'water'] as const) {
        expect(CUES[cueForBanditGoal(g)]).toBeDefined();
      }
    });
  });
});
