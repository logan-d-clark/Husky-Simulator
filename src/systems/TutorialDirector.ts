import type { Inventory } from '../types';
import {
  TUTORIAL_STAGES,
  type TutorialEvent,
  type TutorialStage,
  type TutorialState,
} from './TutorialScript';

// The walkthrough's state machine. Pure: it is handed a snapshot each tick and
// answers what stage we are on, whether to advance, and whether a mistake needs
// coaching. GameScene supplies the world; this decides the lesson.

/** A mistake worth stopping to explain. These are the real loss conditions. */
export type WarningId = 'food' | 'water';

export interface WarningCopy {
  title: string;
  body: string;
}

export const WARNINGS: Record<WarningId, WarningCopy> = {
  food: {
    title: 'You ran out of food.',
    body: 'In a real game that ends your run on the spot. Food is also your score, so it is the one thing you can never let hit zero — go find a treat.',
  },
  water: {
    title: 'You ran out of water.',
    body: 'In a real game that ends your run on the spot. Ponds are the blue tiles — stand next to one and hold Q to drink.',
  },
};

export type DirectorState = Omit<TutorialState, 'counters'>;

export class TutorialDirector {
  private index = 0;
  private counters: Record<string, number> = {};
  private fired = new Set<WarningId>();

  /** The stage being taught, or null once the walkthrough is over. */
  stage(): TutorialStage | null {
    return TUTORIAL_STAGES[this.index] ?? null;
  }

  isFinished(): boolean {
    return this.index >= TUTORIAL_STAGES.length;
  }

  /** 1-based, for "Step 3 of 12". Clamped so the summary does not read 13. */
  stageNumber(): number {
    return Math.min(this.index + 1, TUTORIAL_STAGES.length);
  }

  totalStages(): number {
    return TUTORIAL_STAGES.length;
  }

  /** Report something the player actually did. */
  bump(event: TutorialEvent): void {
    this.counters[event] = (this.counters[event] ?? 0) + 1;
  }

  private full(state: DirectorState): TutorialState {
    return { ...state, counters: this.counters };
  }

  /** Text for the banner's progress readout, or '' when a stage has none. */
  progressText(state: DirectorState): string {
    const stage = this.stage();
    return stage?.progress?.(this.full(state)) ?? '';
  }

  /**
   * Advance if the current stage's objective is met. Counters are cleared on
   * every advance, so each stage's targets are counted from its own start.
   */
  update(state: DirectorState): { advanced: boolean; finished: boolean } {
    const stage = this.stage();
    if (!stage) return { advanced: false, finished: false };
    if (!stage.done(this.full(state))) return { advanced: false, finished: false };
    this.index += 1;
    this.counters = {};
    return { advanced: true, finished: this.isFinished() };
  }

  /**
   * A mistake to coach, or null. Fires at most once per id per run: the point is
   * to teach the lesson, not to nag while the stat sits at zero.
   */
  warningFor(inv: Inventory): WarningId | null {
    const hit = (['food', 'water'] as const).find((id) => inv[id] <= 0 && !this.fired.has(id));
    if (!hit) return null;
    this.fired.add(hit);
    return hit;
  }
}
