// Bandit's AI mode flag, kept separate from the all-numeric GameConfig so the
// config serialize/parse/profiles stay number-only. The exported object is
// mutated in place and read live by the AI at move time, so a dev-panel toggle
// takes effect immediately (no restart). See [[husky-scoring-model]].
export interface BanditSettings {
  /** true = omniscient (default) — always chase the globally best food, ignoring
   *  smell range; false = advanced street patrol (scent-gated). Omniscient is the
   *  default because it plays much better as a challenge. */
  omniscient: boolean;
}

export const banditSettings: BanditSettings = { omniscient: true };

/** Restore Bandit's AI mode to the default (omniscient). */
export function resetBanditSettings(): void {
  banditSettings.omniscient = true;
}
