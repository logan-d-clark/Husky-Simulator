import { midiToFreq, type ToneStep } from './tones';
import { chordRootForBar, scaleForBar } from './music';

// The title theme. Same neighbourhood as the in-game bed — same key, same
// I–V–vi–IV — so the menu and the game sound like one soundtrack. What makes it
// a *title* song rather than a bed is structure and density: a written hook that
// comes back (the bed's melody is generated every bar and never repeats), four
// layers instead of two, offbeat chord stabs, and half again the tempo.
//
// Pure data, like the rest of src/audio: no AudioContext, so it unit-tests in
// Vitest's node environment.

export const THEME_BPM = 132; // brisk — the bed's 92 is a porch, this is the trailer
export const THEME_BAR_SECONDS = (60 / THEME_BPM) * 4;
const EIGHTH = THEME_BAR_SECONDS / 8;
const SIXTEENTH = THEME_BAR_SECONDS / 16;

const ROOT_MIDI = 60; // C4, matching music.ts
const LEAD = ROOT_MIDI + 12;

/**
 * The 16-bar form, four bars to a section: hook, hook an octave up, a
 * generated break, then the hook again with a sparkle line over it. Looping the
 * form (rather than the bar) is what stops a menu you sit on for two minutes
 * turning into a nursery rhyme.
 */
export const FORM_BARS = 16;

/** `[eighth, semitones above C5, length in eighths]` — written against the progression. */
type HookNote = readonly [number, number, number];

const HOOK: readonly (readonly HookNote[])[] = [
  [
    [0, 7, 1.5],
    [2, 9, 0.5],
    [3, 7, 1],
    [4, 4, 2],
    [6, 0, 2],
  ],
  [
    [0, 2, 1.5],
    [2, 4, 0.5],
    [3, 7, 1],
    [4, 11, 2],
    [6, 7, 2],
  ],
  [
    [0, 9, 1],
    [1, 12, 1],
    [2, 9, 2],
    [4, 7, 1],
    [5, 4, 1],
    [6, 9, 2],
  ],
  [
    [0, 5, 1],
    [1, 7, 1],
    [2, 9, 2],
    [4, 12, 3],
    [7, 11, 1],
  ],
];

const BREAK_REST_CHANCE = 0.18; // the break is the busy part, so it rests rarely

/** One bar of the theme. Deterministic for a given `rng` sequence. */
export function themeNotes(bar: number, rng: () => number): ToneStep[] {
  const pos = ((bar % FORM_BARS) + FORM_BARS) % FORM_BARS;
  const section = Math.floor(pos / 4);
  const step = pos % 4;
  const root = chordRootForBar(bar);
  const triad = [0, step === 2 ? 3 : 4, 7]; // the vi is the only minor chord
  const out: ToneStep[] = [];

  // Bass: driving eighths instead of the bed's held root — root, fifth, octave,
  // fifth. This is most of what makes it feel like it's going somewhere.
  for (const [i, semi] of [
    [0, 0],
    [2, 7],
    [4, 12],
    [6, 7],
  ] as const) {
    out.push({
      freq: midiToFreq(ROOT_MIDI + root - 24 + semi),
      dur: EIGHTH * 0.9,
      wave: 'triangle',
      gain: 0.45,
      at: i * EIGHTH,
    });
  }

  // Chord stabs on every offbeat — the summery upstroke.
  for (const i of [1, 3, 5, 7]) {
    for (const semi of triad) {
      out.push({
        freq: midiToFreq(ROOT_MIDI + root - 12 + semi),
        dur: EIGHTH * 0.5,
        wave: 'triangle',
        gain: 0.16,
        at: i * EIGHTH,
      });
    }
  }

  if (section === 2) {
    // The break: the bed's own trick — a random walk over the bar's pentatonic,
    // but at sixteenths and barely resting, so it reads as a fill.
    const scale = scaleForBar(bar);
    for (let i = 0; i < 16; i++) {
      if (rng() < BREAK_REST_CHANCE) continue;
      out.push({
        freq: midiToFreq(scale[Math.floor(rng() * scale.length)]),
        dur: SIXTEENTH * 1.5,
        wave: 'sine',
        gain: 0.34,
        at: i * SIXTEENTH,
      });
    }
  } else {
    const octave = section === 1 ? 12 : 0;
    for (const [i, semi, len] of HOOK[step]) {
      out.push({
        freq: midiToFreq(LEAD + semi + octave),
        dur: EIGHTH * len * 0.92,
        wave: 'square',
        gain: 0.24,
        at: i * EIGHTH,
      });
    }
  }

  // Last time through the hook, add a sparkle arpeggio two octaves up.
  if (section === 3) {
    for (let i = 0; i < 16; i++) {
      out.push({
        freq: midiToFreq(LEAD + 12 + root + triad[i % 3]),
        dur: SIXTEENTH * 0.9,
        wave: 'sine',
        gain: 0.12,
        at: i * SIXTEENTH,
      });
    }
  }

  return out;
}
