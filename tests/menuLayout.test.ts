import { describe, expect, it } from 'vitest';
import { buildMenuLayout, DIFFICULTY_SEGMENT_HEIGHT } from '../src/ui/menuLayout';

describe('buildMenuLayout', () => {
  it('places the entire difficulty selector below the horizon', () => {
    const horizonY = 360;
    const layout = buildMenuLayout(horizonY);

    expect(layout.difficultyY - DIFFICULTY_SEGMENT_HEIGHT / 2).toBeGreaterThan(horizonY);
  });

  it('keeps both action buttons below the difficulty selector without overlap', () => {
    const layout = buildMenuLayout(360);
    const selectorBottom = layout.difficultyY + DIFFICULTY_SEGMENT_HEIGHT / 2;

    expect(layout.startY - 28).toBeGreaterThan(selectorBottom);
    expect(layout.howToPlayY - 23).toBeGreaterThan(layout.startY + 28);
  });
});
