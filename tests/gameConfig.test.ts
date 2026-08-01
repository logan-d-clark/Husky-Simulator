import { describe, it, expect, afterEach } from 'vitest';
import { config, DEFAULTS, resetConfig, applyConfig } from '../src/config/gameConfig';

afterEach(() => resetConfig());

describe('gameConfig', () => {
  it('starts equal to DEFAULTS', () => {
    expect(config).toEqual(DEFAULTS);
  });

  it('applyConfig patches individual fields', () => {
    applyConfig({ FOOD_RATE: 0.5, START_FOOD: 200 });
    expect(config.FOOD_RATE).toBe(0.5);
    expect(config.START_FOOD).toBe(200);
    expect(config.WATER_RATE).toBe(DEFAULTS.WATER_RATE); // untouched
  });

  it('resetConfig restores every field to DEFAULTS', () => {
    applyConfig({ FOOD_RATE: 9, GAME_SECONDS: 1 });
    resetConfig();
    expect(config).toEqual(DEFAULTS);
  });

  it('DEFAULTS is frozen (a durable baseline to restore from)', () => {
    expect(Object.isFrozen(DEFAULTS)).toBe(true);
  });
});
