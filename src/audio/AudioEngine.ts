import { config } from '../config/gameConfig';
import { placePhrase, type ToneStep } from './tones';
import { CUES, type CueName } from './cues';
import { barNotes, barsToSchedule, mulberry32 } from './music';

// The only browser-coupled file in src/audio. Everything it plays is decided by
// the pure modules; this just turns tone steps into oscillators. Kept thin on
// purpose — Vitest runs in `node`, which has no Web Audio, so logic that lives
// here is logic that cannot be tested. Every method no-ops without an
// AudioContext, so importing this module is always safe.

const LOOKAHEAD_MS = 250;   // how often the scheduler wakes
// Must comfortably exceed the ~1s timer floor a background tab imposes, or a
// throttled wake lands after the bar it was meant to queue.
const SCHEDULE_AHEAD = 1.5; // seconds of music queued in advance

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextBarAt = 0;
  private bar = 0;
  private rng = mulberry32(0x5eed);
  private muted = false;

  private ensure(): boolean {
    if (this.ctx) return true;
    const Ctor = typeof window === 'undefined'
      ? undefined
      : window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return false;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.musicGain = this.ctx.createGain();
    this.sfxGain = this.ctx.createGain();
    this.musicGain.connect(this.master);
    this.sfxGain.connect(this.master);
    this.master.connect(this.ctx.destination);
    this.applyVolumes();
    return true;
  }

  // Volumes are pushed from live config on every use, so dev-panel edits to
  // MUSIC_VOLUME / SFX_VOLUME take effect without a restart.
  private applyVolumes(): void {
    if (!this.master) return;
    this.master.gain.value = this.muted ? 0 : 1;
    if (this.musicGain) this.musicGain.gain.value = config.MUSIC_VOLUME;
    if (this.sfxGain) this.sfxGain.gain.value = config.SFX_VOLUME;
  }

  /** Must be called from a real user gesture — browsers start contexts suspended. */
  resume(): void {
    if (!this.ensure() || !this.ctx) return;
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  isMuted(): boolean { return this.muted; }

  toggleMute(): boolean {
    this.muted = !this.muted;
    this.applyVolumes();
    return this.muted;
  }

  /** Schedule one phrase. `at` places a step in the phrase; otherwise steps run back to back. */
  private schedule(steps: ToneStep[], startAt: number, into: GainNode): void {
    if (!this.ctx) return;
    for (const n of placePhrase(steps, startAt)) {
      const osc = this.ctx.createOscillator();
      const env = this.ctx.createGain();
      osc.type = n.wave;
      osc.frequency.value = n.freq;
      // Short attack/decay ramps: a raw gate on an oscillator clicks audibly.
      env.gain.setValueAtTime(0.0001, n.start);
      env.gain.exponentialRampToValueAtTime(Math.max(0.0002, n.gain), n.start + 0.008);
      env.gain.exponentialRampToValueAtTime(0.0001, n.start + n.dur);
      osc.connect(env);
      env.connect(into);
      osc.start(n.start);
      osc.stop(n.start + n.dur + 0.02);
    }
  }

  play(cue: CueName): void {
    if (!this.ensure() || !this.ctx || !this.sfxGain || this.muted) return;
    this.applyVolumes();
    this.schedule(CUES[cue], this.ctx.currentTime, this.sfxGain);
  }

  /** Play an already-built phrase (e.g. eatCue's value-transposed notes). */
  playSteps(steps: ToneStep[]): void {
    if (!this.ensure() || !this.ctx || !this.sfxGain || this.muted) return;
    this.applyVolumes();
    this.schedule(steps, this.ctx.currentTime, this.sfxGain);
  }

  startMusic(): void {
    if (!this.ensure() || !this.ctx || this.timer) return;
    this.nextBarAt = this.ctx.currentTime + 0.15;
    // The scheduler accumulates bar times off ctx.currentTime rather than
    // stepping a wall-clock interval — a setInterval-driven clock drifts audibly
    // over a 20-minute round, and the drift is cumulative.
    this.timer = setInterval(() => this.pump(), LOOKAHEAD_MS);
    this.pump();
  }

  private pump(): void {
    if (!this.ctx || !this.musicGain) return;
    this.applyVolumes();
    const { times, nextBarAt } = barsToSchedule(this.nextBarAt, this.ctx.currentTime, SCHEDULE_AHEAD);
    for (const at of times) {
      const { bass, lead } = barNotes(this.bar, this.rng);
      this.schedule(bass, at, this.musicGain);
      this.schedule(lead, at, this.musicGain);
      this.bar++;
    }
    this.nextBarAt = nextBarAt;
  }

  stopMusic(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

/** One engine for the whole game, so MenuScene and GameScene address the same audio. */
export const audio = new AudioEngine();
