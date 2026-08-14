import { midiToFreq, type ToneStep } from './tones';

// The background bed. "Catchy but not repetitive" is solved structurally rather
// than by writing a longer loop: the chord progression is FIXED, so the piece
// stays coherent and recognisable, while the melody over it is GENERATED per bar
// from that chord's pentatonic. Bars never repeat exactly, but every bar belongs
// to the same tune. It also makes the music pure, seeded data — testable without
// a browser.

export const BPM = 92; // unhurried; a porch on a hot afternoon
export const BEATS_PER_BAR = 4;
export const BAR_SECONDS = (60 / BPM) * BEATS_PER_BAR;
const EIGHTH = BAR_SECONDS / 8;

const ROOT_MIDI = 60; // C4
const LEAD_OCTAVE = 12; // melody sits an octave above the root
const BASS_OCTAVE = -24;

/** I – V – vi – IV in semitones from the key root. The summer-pop progression. */
export const PROGRESSION: readonly number[] = [0, 7, 9, 5];

/** Major pentatonic — no semitone clashes, so a random walk always sounds intentional. */
const PENTATONIC: readonly number[] = [0, 2, 4, 7, 9, 12];

const REST_CHANCE = 0.42; // sparse: it has to sit under the sound effects
const LONG_CHANCE = 0.25;

export function chordRootForBar(bar: number): number {
  const n = PROGRESSION.length;
  return PROGRESSION[((bar % n) + n) % n];
}

/** The MIDI notes the melody may use in this bar. */
export function scaleForBar(bar: number): number[] {
  const root = ROOT_MIDI + chordRootForBar(bar) + LEAD_OCTAVE;
  return PENTATONIC.map((p) => root + p);
}

export interface Bar {
  bass: ToneStep[];
  lead: ToneStep[];
}

/** One bar of music. Deterministic for a given `rng` sequence. */
export function barNotes(bar: number, rng: () => number): Bar {
  const root = chordRootForBar(bar);
  const scale = scaleForBar(bar);

  const bass: ToneStep[] = [
    {
      freq: midiToFreq(ROOT_MIDI + root + BASS_OCTAVE),
      dur: BAR_SECONDS * 0.92,
      wave: 'triangle',
      gain: 0.5,
      at: 0,
    },
    {
      freq: midiToFreq(ROOT_MIDI + root + BASS_OCTAVE + 7),
      dur: BAR_SECONDS * 0.42,
      wave: 'triangle',
      gain: 0.3,
      at: BAR_SECONDS / 2,
    },
  ];

  const lead: ToneStep[] = [];
  for (let i = 0; i < 8; i++) {
    if (rng() < REST_CHANCE) continue;
    const note = scale[Math.floor(rng() * scale.length)];
    const long = rng() < LONG_CHANCE;
    lead.push({
      freq: midiToFreq(note),
      dur: EIGHTH * (long ? 1.8 : 0.85),
      wave: 'sine',
      gain: 0.6,
      at: i * EIGHTH,
    });
  }
  return { bass, lead };
}

// How far past "now" a late-waking scheduler restarts the beat.
const CATCHUP_OFFSET = 0.05;

export interface BarSchedule {
  times: number[]; // absolute start times for the bars to queue now
  nextBarAt: number; // where the scheduler resumes on its next wake
}

/**
 * Which bar start times a look-ahead scheduler should queue on this wake.
 *
 * The resync matters: a hidden tab throttles timers to a second or more while
 * the audio clock keeps running, so the pump can wake after bars were already
 * due. Without this, those bars are handed to Web Audio with start times in the
 * past — they fire bunched at the wake instant, or get stopped before sounding,
 * and the music comes back garbled. Skipping to the next beat drops the missed
 * bars instead of replaying them into the past.
 */
export function barsToSchedule(
  nextBarAt: number,
  currentTime: number,
  ahead: number,
  barSeconds: number = BAR_SECONDS,
): BarSchedule {
  if (barSeconds <= 0) return { times: [], nextBarAt }; // never spin on a bad tempo
  let next = nextBarAt < currentTime ? currentTime + CATCHUP_OFFSET : nextBarAt;
  const times: number[] = [];
  while (next < currentTime + ahead) {
    times.push(next);
    next += barSeconds;
  }
  return { times, nextBarAt: next };
}

/** Small seeded PRNG so the music is reproducible (and testable) run to run. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
