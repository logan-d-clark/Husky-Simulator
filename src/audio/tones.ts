// The vocabulary every sound in the game is built from. Deliberately DOM-free
// (a local `Wave` union rather than lib.dom's `OscillatorType`) so the sound
// design stays pure data that unit-tests in Vitest's node environment — only
// AudioEngine touches the browser.

export type Wave = 'sine' | 'square' | 'triangle' | 'sawtooth';

export interface ToneStep {
  freq: number;  // Hz; 0 is a rest
  dur: number;   // seconds
  wave: Wave;
  gain: number;  // 0..1, relative to the channel's own volume
  at?: number;   // seconds from the start of the phrase (default: sequential)
}

/** Equal-temperament frequency of a MIDI note number (69 = A4 = 440Hz). */
export function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** A tone step with its absolute start time worked out. */
export interface PlacedTone {
  start: number;
  freq: number;
  dur: number;
  wave: Wave;
  gain: number;
}

/**
 * Turn a phrase into absolutely-timed notes: a step with `at` is placed at that
 * offset within the phrase, one without follows the previous step. Rests
 * (`freq <= 0`) still advance the cursor but produce no note. Pure, so the
 * timing rule is testable without an AudioContext.
 */
export function placePhrase(steps: readonly ToneStep[], startAt: number): PlacedTone[] {
  const out: PlacedTone[] = [];
  let cursor = 0;
  for (const s of steps) {
    const offset = s.at ?? cursor;
    if (s.at === undefined) cursor += s.dur;
    if (s.freq > 0) out.push({ start: startAt + offset, freq: s.freq, dur: s.dur, wave: s.wave, gain: s.gain });
  }
  return out;
}
