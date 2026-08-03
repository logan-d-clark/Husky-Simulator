import { describe, it, expect, afterEach } from 'vitest';
import { banditSettings, resetBanditSettings } from '../../src/config/banditMode';

afterEach(() => resetBanditSettings());

describe('banditMode', () => {
  it('defaults to advanced patrol (omniscient off)', () => {
    expect(banditSettings.omniscient).toBe(false);
  });

  it('is mutated in place so the AI reads changes live', () => {
    banditSettings.omniscient = true;
    expect(banditSettings.omniscient).toBe(true);
  });

  it('resetBanditSettings restores the default', () => {
    banditSettings.omniscient = true;
    resetBanditSettings();
    expect(banditSettings.omniscient).toBe(false);
  });
});
