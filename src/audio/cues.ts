import { midiToFreq, type ToneStep, type Wave } from './tones';

// Every one-shot sound in the game, as pure note data.
//
// Design language: Blizzard's own actions are bright and *rising* — he is the
// player, and his feedback should feel like progress. Bandit's mode changes are
// lower, quieter and duller in timbre: ambient intelligence about the rival
// rather than a response to your input, so they must never compete with your
// own cues. Warnings sit in a third register — insistent two-note figures that
// don't resemble either, because a warning you mistake for a reward is useless.

export type CueName =
  | 'eat' | 'drink' | 'pee' | 'poop' | 'trick'
  | 'banditTreat' | 'banditRelief' | 'banditWater'
  | 'warnFood' | 'warnWater' | 'warnPee';

const step = (midi: number, dur: number, wave: Wave, gain: number): ToneStep =>
  ({ freq: midiToFreq(midi), dur, wave, gain });

export const CUES: Record<CueName, ToneStep[]> = {
  // --- Blizzard: bright, rising, short ---------------------------------------
  eat:   [step(76, 0.06, 'square', 0.5), step(83, 0.09, 'square', 0.45)],
  drink: [step(67, 0.07, 'sine', 0.5), step(60, 0.10, 'sine', 0.42)],   // a gulp: falls
  pee:   [step(72, 0.05, 'triangle', 0.32), step(65, 0.16, 'triangle', 0.28)],
  poop:  [step(48, 0.07, 'square', 0.34), step(43, 0.10, 'square', 0.30)], // low double thud
  trick: [step(72, 0.06, 'square', 0.5), step(76, 0.06, 'square', 0.5), step(83, 0.14, 'square', 0.46)],

  // --- Bandit: lower, quieter, duller ----------------------------------------
  banditTreat:  [step(57, 0.08, 'triangle', 0.24), step(59, 0.10, 'triangle', 0.22)],
  banditRelief: [step(53, 0.10, 'sawtooth', 0.20), step(46, 0.20, 'sawtooth', 0.18)], // he's coming for your yard
  banditWater:  [step(55, 0.07, 'sine', 0.24), step(62, 0.09, 'sine', 0.20)],

  // --- Warnings: insistent, unlike either of the above -----------------------
  warnFood:  [step(70, 0.11, 'triangle', 0.44), step(63, 0.20, 'triangle', 0.42)],
  warnWater: [step(75, 0.11, 'triangle', 0.44), step(68, 0.20, 'triangle', 0.42)],
  warnPee:   [step(78, 0.08, 'square', 0.38), step(78, 0.08, 'square', 0.38), step(85, 0.12, 'square', 0.36)],
};

// Food pickup, transposed by how good the pickup was: a bag should sound like a
// bigger win than a treat without needing its own hand-authored cue. Semitones
// scale with value against a plain treat (10), capped so a lucky multiplier
// can't put it out of audible register.
export function eatCue(value: number, treatValue: number): ToneStep[] {
  // treatValue is dev-panel tunable and can be set to 0, which would make the
  // ratio NaN and every frequency NaN with it — Web Audio throws on a non-finite
  // frequency, from inside the movement chain.
  const ratio = treatValue > 0 ? value / treatValue : 1;
  const steps = Math.min(12, Math.max(0, Math.round(Math.log2(Math.max(1, ratio)) * 5)));
  return CUES.eat.map((s) => ({ ...s, freq: s.freq * Math.pow(2, steps / 12) }));
}

/** Bandit's mode-change cue. Pure so the three-way mapping is testable —
 *  GameScene has no test harness, so left inline a swapped case would ship. */
export function cueForBanditGoal(goal: 'treat' | 'relief' | 'water'): CueName {
  if (goal === 'relief') return 'banditRelief';
  if (goal === 'water') return 'banditWater';
  return 'banditTreat';
}
