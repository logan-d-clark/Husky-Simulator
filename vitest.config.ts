import { defineConfig } from 'vitest/config';

export default defineConfig({
  assetsInclude: ['**/*.csv'],
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
