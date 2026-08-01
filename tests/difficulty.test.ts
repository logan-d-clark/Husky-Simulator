import { describe, it, expect } from 'vitest';
import {
  DIFFICULTIES,
  DEFAULT_DIFFICULTY,
  getDifficultySettings,
  type Difficulty,
} from '../src/config/difficulty';

describe('difficulty registry', () => {
  it('defines normal and hard', () => {
    expect(Object.keys(DIFFICULTIES).sort()).toEqual(['hard', 'normal']);
  });

  it('normal moves the chihuahua at half husky speed (2x duration)', () => {
    expect(getDifficultySettings('normal').chiSpeedMultiplier).toBe(2);
  });

  it('hard moves the chihuahua at husky speed (1x duration)', () => {
    expect(getDifficultySettings('hard').chiSpeedMultiplier).toBe(1);
  });

  it('defaults to normal', () => {
    expect(DEFAULT_DIFFICULTY).toBe('normal');
    expect(getDifficultySettings(DEFAULT_DIFFICULTY)).toEqual(DIFFICULTIES.normal);
  });

  it('falls back to the default settings for an unknown difficulty', () => {
    // Simulates stale/absent scene-init data reaching the accessor.
    expect(getDifficultySettings(undefined as unknown as Difficulty)).toEqual(
      DIFFICULTIES[DEFAULT_DIFFICULTY],
    );
    expect(getDifficultySettings('impossible' as Difficulty)).toEqual(
      DIFFICULTIES[DEFAULT_DIFFICULTY],
    );
  });
});
