import { describe, it, expect } from 'vitest';
import {
  barNotes,
  chordRootForBar,
  scaleForBar,
  mulberry32,
  barsToSchedule,
  PROGRESSION,
  BAR_SECONDS,
  BPM,
} from '../../src/audio/music';
import { midiToFreq } from '../../src/audio/tones';

const seeded = () => mulberry32(1234);

describe('music', () => {
  it('runs at an unhurried tempo with bars that match it', () => {
    expect(BPM).toBeLessThan(120); // background bed, not a chase theme
    expect(BAR_SECONDS).toBeCloseTo((60 / BPM) * 4);
  });

  it('cycles the fixed progression, including across a wrap', () => {
    for (let bar = 0; bar < PROGRESSION.length * 3; bar++) {
      expect(chordRootForBar(bar)).toBe(PROGRESSION[bar % PROGRESSION.length]);
    }
  });

  it('handles a negative bar index without going out of range', () => {
    expect(PROGRESSION).toContain(chordRootForBar(-1));
  });

  describe('barNotes', () => {
    it('is deterministic for a given seed', () => {
      expect(barNotes(0, seeded())).toEqual(barNotes(0, seeded()));
    });

    it('keeps every melody note inside the bar chord scale', () => {
      for (let bar = 0; bar < 8; bar++) {
        const allowed = scaleForBar(bar).map(midiToFreq);
        for (const note of barNotes(bar, seeded()).lead) {
          expect(
            allowed.some((f) => Math.abs(f - note.freq) < 1e-6),
            `bar ${bar}`,
          ).toBe(true);
        }
      }
    });

    it('does not repeat: the melody keeps moving as the scheduler runs', () => {
      // One continuous rng, as the scheduler uses it.
      const rng = seeded();
      const bars = [0, 1, 2, 3, 4, 5, 6, 7].map((b) => JSON.stringify(barNotes(b, rng).lead));
      expect(new Set(bars).size).toBeGreaterThan(6);
    });

    it('actually follows the bar, not just the rng', () => {
      // The test above would still pass if barNotes ignored `bar` entirely —
      // a stateful rng varies the melody on its own. Feeding each bar a FRESH,
      // identically-seeded rng removes that source of variation, so any
      // remaining difference must come from the chord changing.
      const a = barNotes(0, mulberry32(99));
      const b = barNotes(1, mulberry32(99));
      expect(b).not.toEqual(a);
      expect(b.bass[0].freq).not.toBeCloseTo(a.bass[0].freq);
    });

    it('re-voices the bass to each chord root', () => {
      const roots = [0, 1, 2, 3].map((b) => barNotes(b, seeded()).bass[0].freq);
      expect(new Set(roots).size).toBe(PROGRESSION.length);
    });

    it('leaves space — a bar is never a wall of notes', () => {
      for (let bar = 0; bar < 8; bar++) {
        expect(barNotes(bar, seeded()).lead.length).toBeLessThanOrEqual(8);
      }
    });

    it('keeps every note inside its own bar', () => {
      const rng = seeded();
      for (let bar = 0; bar < 8; bar++) {
        for (const n of [...barNotes(bar, rng).lead, ...barNotes(bar, rng).bass]) {
          expect(n.at ?? 0).toBeGreaterThanOrEqual(0);
          expect(n.at ?? 0).toBeLessThan(BAR_SECONDS);
        }
      }
    });
  });

  describe('barsToSchedule', () => {
    const BAR = 2;

    it('queues only the bars inside the look-ahead window', () => {
      const { times, nextBarAt } = barsToSchedule(10, 10, 5, BAR);
      expect(times).toEqual([10, 12, 14]);
      expect(nextBarAt).toBe(16);
    });

    it('queues nothing when the next bar is still beyond the window', () => {
      expect(barsToSchedule(100, 10, 5, BAR)).toEqual({ times: [], nextBarAt: 100 });
    });

    it('resyncs instead of scheduling bars into the past after a late wake', () => {
      // A hidden tab throttles timers to ~1s+ while the audio clock keeps
      // running. Replaying the missed bars would fire them all bunched at the
      // wake instant; they must be dropped and the beat restarted from now.
      const { times, nextBarAt } = barsToSchedule(10, 60, 1, BAR);
      for (const t of times) expect(t).toBeGreaterThanOrEqual(60);
      expect(nextBarAt).toBeGreaterThan(60);
    });

    it('does not burst a minute of missed bars in one wake', () => {
      // Intensive throttling can be one wake per minute — ~30 bars' worth.
      expect(barsToSchedule(0, 60, 1.5, BAR).times.length).toBeLessThanOrEqual(2);
    });

    it('never spins on a non-positive bar length', () => {
      expect(barsToSchedule(0, 0, 5, 0)).toEqual({ times: [], nextBarAt: 0 });
      expect(barsToSchedule(0, 0, 5, -1)).toEqual({ times: [], nextBarAt: 0 });
    });

    it('advances continuously across successive wakes', () => {
      let next = 0;
      const seen: number[] = [];
      for (let now = 0; now < 10; now += 0.25) {
        const r = barsToSchedule(next, now, 1.5, BAR);
        seen.push(...r.times);
        next = r.nextBarAt;
      }
      expect(seen).toEqual([0, 2, 4, 6, 8, 10]); // every bar, exactly once
    });
  });

  describe('mulberry32', () => {
    it('produces a stable stream in [0,1)', () => {
      const a = mulberry32(7),
        b = mulberry32(7);
      for (let i = 0; i < 50; i++) {
        const v = a();
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThan(1);
        expect(v).toBe(b());
      }
    });
    it('differs between seeds', () => {
      expect(mulberry32(1)()).not.toBe(mulberry32(2)());
    });
  });
});
