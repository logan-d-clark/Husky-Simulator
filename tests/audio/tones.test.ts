import { describe, it, expect } from 'vitest';
import { midiToFreq, placePhrase, type ToneStep } from '../../src/audio/tones';

const s = (over: Partial<ToneStep> = {}): ToneStep => ({
  freq: 440,
  dur: 0.1,
  wave: 'sine',
  gain: 0.5,
  ...over,
});

describe('midiToFreq', () => {
  it('anchors on A4 = 440Hz', () => {
    expect(midiToFreq(69)).toBeCloseTo(440);
  });
  it('doubles an octave up and halves an octave down', () => {
    expect(midiToFreq(81)).toBeCloseTo(880);
    expect(midiToFreq(57)).toBeCloseTo(220);
  });
  it('places middle C where it belongs', () => {
    expect(midiToFreq(60)).toBeCloseTo(261.63, 1);
  });
});

describe('placePhrase', () => {
  it('runs steps back to back when none carries an offset', () => {
    const out = placePhrase([s({ dur: 0.2 }), s({ dur: 0.3 }), s({ dur: 0.1 })], 5);
    expect(out.map((n) => n.start)).toEqual([5, 5.2, 5.5]);
  });

  it('honours an explicit offset without disturbing the cursor', () => {
    // `at` steps are absolute within the phrase — chords need to start together.
    const out = placePhrase([s({ at: 0, dur: 1 }), s({ at: 0, dur: 1 }), s({ at: 0.5, dur: 1 })], 10);
    expect(out.map((n) => n.start)).toEqual([10, 10, 10.5]);
  });

  it('drops rests but still lets them consume time', () => {
    const out = placePhrase([s({ dur: 0.2 }), s({ freq: 0, dur: 0.4 }), s({ dur: 0.1 })], 0);
    expect(out).toHaveLength(2);
    expect(out.map((n) => n.start)).toEqual([0, 0.6000000000000001]);
  });

  it('carries the tone through unchanged', () => {
    const [n] = placePhrase([s({ freq: 330, wave: 'square', gain: 0.25, dur: 0.7 })], 2);
    expect(n).toEqual({ start: 2, freq: 330, dur: 0.7, wave: 'square', gain: 0.25 });
  });

  it('handles an empty phrase', () => {
    expect(placePhrase([], 3)).toEqual([]);
  });
});
