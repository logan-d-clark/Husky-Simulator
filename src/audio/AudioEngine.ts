import { config } from '../config/gameConfig';
import { placePhrase, type ToneStep } from './tones';
import { CUES, type CueName } from './cues';
import { barNotes, barsToSchedule, mulberry32, BAR_SECONDS } from './music';
import { themeNotes, THEME_BAR_SECONDS } from './theme';

// The only browser-coupled file in src/audio. Everything it plays is decided by
// the pure modules; this just turns tone steps into oscillators. Kept thin on
// purpose — Vitest runs in `node`, which has no Web Audio, so logic that lives
// here is logic that cannot be tested. Every method no-ops without an
// AudioContext, so importing this module is always safe.

const LOOKAHEAD_MS = 250; // how often the scheduler wakes
// Must comfortably exceed the ~1s timer floor a background tab imposes, or a
// throttled wake lands after the bar it was meant to queue.
const SCHEDULE_AHEAD = 1.5; // seconds of music queued in advance

export type TrackName = 'game' | 'theme';

/** What the scheduler needs to know about a piece: how long a bar is, and what's in it. */
const TRACKS: Record<
  TrackName,
  { barSeconds: number; notes: (bar: number, rng: () => number) => ToneStep[] }
> = {
  game: {
    barSeconds: BAR_SECONDS,
    notes: (bar, rng) => {
      const { bass, lead } = barNotes(bar, rng);
      return [...bass, ...lead];
    },
  },
  theme: { barSeconds: THEME_BAR_SECONDS, notes: themeNotes },
};

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private nextBarAt = 0;
  private bar = 0;
  private rng = mulberry32(0x5eed);
  private track: TrackName = 'game';
  private muted = false;

  private ensure(): boolean {
    if (this.ctx) return true;
    const Ctor =
      typeof window === 'undefined'
        ? undefined
        : (window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext);
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

  isMuted(): boolean {
    return this.muted;
  }

  /** Whether sound can actually be heard right now — false until a gesture unlocks the context. */
  isRunning(): boolean {
    return this.ctx?.state === 'running';
  }

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

  /**
   * Start (or switch to) a track. Calling it again for the track already playing
   * is a no-op, so scenes can assert what should be playing without restarting
   * the music every time one of them wakes.
   */
  startMusic(track: TrackName = 'game'): void {
    if (this.timer && this.track === track) return;
    this.stopMusic();
    if (!this.ensure() || !this.ctx) return;
    this.track = track;
    // Restart the form, so a piece with structure always begins at its opening
    // bar rather than wherever the previous track happened to leave the count.
    this.bar = 0;
    this.rng = mulberry32(0x5eed);
    this.nextBarAt = this.ctx.currentTime + 0.15;
    // The scheduler accumulates bar times off ctx.currentTime rather than
    // stepping a wall-clock interval — a setInterval-driven clock drifts audibly
    // over a 20-minute round, and the drift is cumulative.
    this.timer = setInterval(() => this.pump(), LOOKAHEAD_MS);
    this.pump();
  }

  private pump(): void {
    if (!this.ctx || !this.musicGain) return;
    // Nothing goes into a context that is not running. A suspended context's
    // clock is frozen, so bars queued against it all pile onto the first second
    // after the unlock — which, if the player unlocked by pressing Start, means
    // the menu theme bleeding over the opening of the in-game bed. The pump
    // keeps ticking; barsToSchedule resyncs to the live clock on the first wake
    // after the context comes up.
    if (this.ctx.state !== 'running') return;
    this.applyVolumes();
    const { barSeconds, notes } = TRACKS[this.track];
    const { times, nextBarAt } = barsToSchedule(
      this.nextBarAt,
      this.ctx.currentTime,
      SCHEDULE_AHEAD,
      barSeconds,
    );
    for (const at of times) {
      this.schedule(notes(this.bar, this.rng), at, this.musicGain);
      this.bar++;
    }
    this.nextBarAt = nextBarAt;
  }

  stopMusic(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (!this.ctx || !this.musicGain) return;
    // Clearing the timer only stops NEW bars being queued: up to SCHEDULE_AHEAD
    // seconds of music is already committed to the audio clock and cannot be
    // un-scheduled. Left alone it plays on over whatever comes next — the menu
    // theme stumbling over the opening of the in-game bed. So retire the whole
    // music channel: fade it out fast enough to be inaudible, slow enough not to
    // click, and hand the next track a fresh one.
    const retired = this.musicGain;
    const now = this.ctx.currentTime;
    retired.gain.cancelScheduledValues(now);
    retired.gain.setValueAtTime(retired.gain.value, now);
    retired.gain.linearRampToValueAtTime(0.0001, now + 0.08);
    setTimeout(() => retired.disconnect(), (SCHEDULE_AHEAD + 1) * 1000);
    this.musicGain = this.ctx.createGain();
    this.musicGain.connect(this.master!);
  }
}

/** One engine for the whole game, so MenuScene and GameScene address the same audio. */
export const audio = new AudioEngine();
