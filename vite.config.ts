import { defineConfig } from 'vite';

export default defineConfig({
  base: '/husky-simulator/',
  build: { target: 'es2020', outDir: 'dist' },
});
