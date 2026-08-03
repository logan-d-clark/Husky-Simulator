// Bandit's AI mode flag, kept separate from the all-numeric GameConfig so the
// config serialize/parse/profiles stay number-only. The exported object is
// mutated in place and read live by the AI at move time, so a dev-panel toggle
// takes effect immediately (no restart). See [[husky-scoring-model]].
export interface BanditSettings {
  /** false = advanced street patrol (default); true = omniscient — always
   *  chase the globally best food, ignoring smell range. */
  omniscient: boolean;
}

export const banditSettings: BanditSettings = { omniscient: false };

/** Restore Bandit's AI mode to the default (advanced patrol). */
export function resetBanditSettings(): void {
  banditSettings.omniscient = false;
}
