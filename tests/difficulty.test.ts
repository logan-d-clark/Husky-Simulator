import { describe, it, expect } from 'vitest';
import {
  DIFFICULTIES,
  DEFAULT_DIFFICULTY,
  getDifficultySettings,
  type Difficulty,
} from '../src/config/difficulty';

describe('difficulty registry', () => {
  it('defines puppy, husky and blizzlord', () => {
    expect(Object.keys(DIFFICULTIES).sort()).toEqual(['blizzlord', 'husky', 'puppy']);
  });

  it('puppy (Normal) moves the chihuahua at half husky speed, no fog', () => {
    const s = getDifficultySettings('puppy');
    expect(s.chiSpeedMultiplier).toBe(2);
    expect(s.subtitle).toBe('Normal');
    expect(s.fogOfWar).toBe(false);
  });

  it('husky (Hard) moves the chihuahua at husky speed, no fog', () => {
    const s = getDifficultySettings('husky');
    expect(s.chiSpeedMultiplier).toBe(1);
    expect(s.subtitle).toBe('Hard');
    expect(s.fogOfWar).toBe(false);
  });

  it('blizzlord (Very Hard) enables fog of war', () => {
    const s = getDifficultySettings('blizzlord');
    expect(s.subtitle).toBe('Very Hard');
    expect(s.fogOfWar).toBe(true);
  });

  it('defaults to puppy', () => {
    expect(DEFAULT_DIFFICULTY).toBe('puppy');
    expect(getDifficultySettings(DEFAULT_DIFFICULTY)).toEqual(DIFFICULTIES.puppy);
  });

  it('falls back to the default settings for an unknown difficulty', () => {
    expect(getDifficultySettings(undefined as unknown as Difficulty)).toEqual(
      DIFFICULTIES[DEFAULT_DIFFICULTY],
    );
    expect(getDifficultySettings('impossible' as Difficulty)).toEqual(
      DIFFICULTIES[DEFAULT_DIFFICULTY],
    );
  });
});
