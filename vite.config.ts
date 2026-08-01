import { defineConfig } from 'vite';

export default defineConfig({
  base: '/Husky-Simulator/',
  build: {
    target: 'es2020',
    outDir: 'dist',
    // Emit SVG art as real files instead of inlining them as data: URIs.
    // Phaser's loader (load.svg) throws "String contains an invalid character"
    // on inlined data-URI SVGs in production builds, which aborts boot and
    // leaves a blank screen. Serving them as files matches the dev behavior.
    assetsInlineLimit: 0,
  },
});
