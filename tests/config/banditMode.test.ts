import { describe, it, expect, afterEach } from 'vitest';
import { banditSettings, resetBanditSettings } from '../../src/config/banditMode';

afterEach(() => resetBanditSettings());

describe('banditMode', () => {
  it('defaults to omniscient on', () => {
    expect(banditSettings.omniscient).toBe(true);
  });

  it('is mutated in place so the AI reads changes live', () => {
    banditSettings.omniscient = false;
    expect(banditSettings.omniscient).toBe(false);
  });

  it('resetBanditSettings restores omniscient on after being toggled off', () => {
    banditSettings.omniscient = false;
    resetBanditSettings();
    expect(banditSettings.omniscient).toBe(true);
  });
});
