import { HUSKY_NAME, CHI_NAME } from '../config/names';

// How a round is judged. This lived as an expression inside GameOverScene's
// render method, which is how it drifted from the design and started calling a
// dry, starved dog the winner as long as he was ahead on food.

export type EndReason = 'Time' | 'Food' | 'Water';

export interface RoundOutcome {
  won: boolean;
  /** The verdict line. */
  headline: string;
  /** Why — which of the two conditions was missed. */
  detail: string;
}

/**
 * Winning takes BOTH: last the whole round, and finish with more food than
 * Bandit. Running out is a loss however far ahead you were — that is the entire
 * reason water is worth managing.
 */
export function roundOutcome(reason: EndReason, huskyFood: number, chiFood: number): RoundOutcome {
  const ahead = huskyFood >= chiFood;

  if (reason === 'Food') {
    return {
      won: false,
      headline: `${CHI_NAME} won this time…`,
      detail: `${HUSKY_NAME} ran out of food. You have to last the whole round to win.`,
    };
  }
  if (reason === 'Water') {
    return {
      won: false,
      headline: `${CHI_NAME} won this time…`,
      detail: `${HUSKY_NAME} ran out of water. You have to last the whole round to win.`,
    };
  }
  return ahead
    ? {
        won: true,
        headline: `${HUSKY_NAME} wins! 🏆`,
        detail: `Lasted the whole day AND out-ate ${CHI_NAME}.`,
      }
    : {
        won: false,
        headline: `${CHI_NAME} won this time…`,
        detail: `${HUSKY_NAME} lasted the day, but ${CHI_NAME} finished with more food.`,
      };
}
