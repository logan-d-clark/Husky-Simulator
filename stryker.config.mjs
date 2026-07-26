// stryker.config.mjs
export default {
  packageManager: 'npm',
  testRunner: 'vitest',
  coverageAnalysis: 'perTest',
  reporters: ['html', 'clear-text', 'progress'],
  mutate: ['src/**/*.ts', '!src/**/*.{test,spec}.ts'],
};
