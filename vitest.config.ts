import { defineConfig } from 'vitest/config';

export default defineConfig({
  assetsInclude: ['**/*.csv'],
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
    },
  },
});
