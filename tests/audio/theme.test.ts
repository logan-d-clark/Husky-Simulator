import { describe, it, expect } from 'vitest';
import { themeNotes, THEME_BPM, THEME_BAR_SECONDS, FORM_BARS } from '../../src/audio/theme';
import { mulberry32, scaleForBar, PROGRESSION } from '../../src/audio/music';
import { midiToFreq } from '../../src/audio/tones';

const seeded = () => mulberry32(0xba11);
const bars = (n: number) => Array.from({ length: n }, (_, i) => i);

describe('title theme', () => {
  it('is faster than the in-game bed', () => {
    expect(THEME_BPM).toBeGreaterThan(92);
    expect(THEME_BAR_SECONDS).toBeCloseTo((60 / THEME_BPM) * 4);
  });

  it('is deterministic for a given rng', () => {
    expect(themeNotes(9, seeded())).toEqual(themeNotes(9, seeded()));
  });

  it('keeps every note inside its own bar', () => {
    const rng = seeded();
    for (const bar of bars(FORM_BARS)) {
      for (const n of themeNotes(bar, rng)) {
        expect(n.at ?? 0).toBeGreaterThanOrEqual(0);
        expect(n.at ?? 0).toBeLessThan(THEME_BAR_SECONDS);
        expect(n.freq).toBeGreaterThan(0);
        expect(n.dur).toBeGreaterThan(0);
      }
    }
  });

  it('repeats its hook, which is what makes it a song and not a bed', () => {
    // The written sections use no rng at all, so the form comes round identical.
    for (const bar of [0, 1, 2, 3, 12]) {
      expect(themeNotes(bar, seeded())).toEqual(themeNotes(bar + FORM_BARS, seeded()));
    }
  });

  it('varies the break bars run to run, so sitting on the menu does not loop audibly', () => {
    const rng = seeded();
    const breaks = [8, 9, 10, 11].map((b) => JSON.stringify(themeNotes(b, rng)));
    const again = [8, 9, 10, 11].map((b) => JSON.stringify(themeNotes(b, rng)));
    expect(new Set([...breaks, ...again]).size).toBe(8);
  });

  it('stays in key — the break only uses the bar chord pentatonic', () => {
    const rng = seeded();
    for (const bar of [8, 9, 10, 11]) {
      const allowed = scaleForBar(bar).map(midiToFreq);
      const bass = midiToFreq(60 + PROGRESSION[bar % 4] - 24);
      const melody = themeNotes(bar, rng).filter((n) => n.wave === 'sine' && n.freq > bass);
      expect(melody.length).toBeGreaterThan(0);
      for (const n of melody) {
        expect(allowed.some((f) => Math.abs(f - n.freq) < 0.01)).toBe(true);
      }
    }
  });

  it('follows the same progression as the in-game bed, so they sound like one soundtrack', () => {
    const roots = bars(4).map((b) => themeNotes(b, seeded())[0].freq);
    expect(roots).toEqual(PROGRESSION.map((semi) => midiToFreq(60 + semi - 24)));
  });

  it('is denser than the bed — four layers, not two', () => {
    // The bed tops out at 2 bass + 8 lead. Every theme bar carries bass,
    // offbeat stabs and a melody at once.
    for (const bar of bars(FORM_BARS)) {
      expect(themeNotes(bar, seeded()).length).toBeGreaterThan(16);
    }
  });
});
