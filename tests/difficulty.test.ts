import { describe, it, expect } from 'vitest';
import {
  DIFFICULTIES,
  DEFAULT_DIFFICULTY,
  getDifficultySettings,
  banditDelaySeconds,
  type Difficulty,
} from '../src/config/difficulty';
import { config, resetConfig } from '../src/config/gameConfig';

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

describe('banditDelaySeconds', () => {
  it('scales the live config base by the difficulty multiplier', () => {
    for (const d of ['puppy', 'husky', 'blizzlord'] as const) {
      expect(banditDelaySeconds(d)).toBe(
        config.BANDIT_DELAY_SECONDS * DIFFICULTIES[d].banditDelayMultiplier,
      );
    }
  });

  it('gives a shorter reprieve the harder the level', () => {
    expect(banditDelaySeconds('blizzlord')).toBeLessThan(banditDelaySeconds('husky'));
    expect(banditDelaySeconds('husky')).toBeLessThan(banditDelaySeconds('puppy'));
  });

  it('follows a dev-panel edit to the base', () => {
    const before = banditDelaySeconds('husky');
    config.BANDIT_DELAY_SECONDS *= 2;
    expect(banditDelaySeconds('husky')).toBe(before * 2);
    resetConfig();
  });

  it('falls back to the default difficulty for an unknown level', () => {
    expect(banditDelaySeconds('nonsense' as Difficulty)).toBe(banditDelaySeconds(DEFAULT_DIFFICULTY));
  });
});
