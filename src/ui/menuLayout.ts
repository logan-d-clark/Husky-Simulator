export const DIFFICULTY_SEGMENT_HEIGHT = 46;

export interface MenuLayout {
  challengeHeadingY: number;
  difficultyY: number;
  startY: number;
  tutorialY: number;
  howToPlayY: number;
}

/** Vertically place the interactive menu content beneath the summer horizon. */
export function buildMenuLayout(horizonY: number): MenuLayout {
  return {
    challengeHeadingY: horizonY + 30,
    difficultyY: horizonY + 70,
    startY: horizonY + 150,
    tutorialY: horizonY + 214,
    howToPlayY: horizonY + 272,
  };
}
