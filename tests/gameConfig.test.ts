import { describe, it, expect, afterEach } from 'vitest';
import { config, DEFAULTS, INIT_ONLY_KEYS, resetConfig, applyConfig, serializeConfig, parseConfig } from '../src/config/gameConfig';

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

  it('every INIT_ONLY key is a real config field', () => {
    for (const key of INIT_ONLY_KEYS) {
      expect(DEFAULTS).toHaveProperty(key);
    }
  });

  it('has the Bandit need tunables at their defaults', () => {
    // He only leaves for a yard at a 100%-full channel, and only for water at 10%.
    expect(DEFAULTS.BANDIT_RELIEVE_THRESHOLD).toBe(100);
    expect(DEFAULTS.BANDIT_RELIEVE_THRESHOLD).toBe(DEFAULTS.POOP_MAX);
    expect(DEFAULTS.BANDIT_RELIEVE_THRESHOLD).toBe(DEFAULTS.PEE_MAX);
    expect(DEFAULTS.BANDIT_THIRST_FRACTION).toBe(0.1);
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

  describe('parseConfig', () => {
    it('round-trips a serialized config', () => {
      applyConfig({ FOOD_RATE: 0.42, START_FOOD: 200, GAME_SECONDS: 90 });
      const text = serializeConfig();
      resetConfig();
      const parsed = parseConfig(text);
      expect(parsed.FOOD_RATE).toBe(0.42);
      expect(parsed.START_FOOD).toBe(200);
      expect(parsed.GAME_SECONDS).toBe(90);
    });
    it('ignores unknown keys and malformed lines', () => {
      const parsed = parseConfig('FOOD_RATE=0.9\nBOGUS_KEY=5\ngarbage line\nWATER_RATE=abc');
      expect(parsed).toEqual({ FOOD_RATE: 0.9 });
    });
  });
});
