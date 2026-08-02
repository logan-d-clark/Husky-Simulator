import { describe, it, expect, afterEach } from 'vitest';
import { config, DEFAULTS, resetConfig, applyConfig, serializeConfig } from '../src/config/gameConfig';

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

  describe('serializeConfig', () => {
    it('emits one KEY=value line per field', () => {
      const text = serializeConfig();
      for (const key of Object.keys(DEFAULTS)) {
        expect(text).toContain(`${key}=${config[key as keyof typeof config]}`);
      }
      expect(text.trim().split('\n')).toHaveLength(Object.keys(DEFAULTS).length);
    });
    it('reflects live edits', () => {
      applyConfig({ FOOD_RATE: 0.42 });
      expect(serializeConfig()).toContain('FOOD_RATE=0.42');
    });
  });
});
