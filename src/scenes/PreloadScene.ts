import Phaser from 'phaser';

const DIRS = ['up', 'down', 'left', 'right'] as const;

export class PreloadScene extends Phaser.Scene {
  constructor() { super('Preload'); }

  preload() {
    const svg = (key: string, path: string, w: number, h: number) =>
      this.load.svg(key, path, { width: w, height: h });

    svg('grass', new URL('../assets/grass.svg', import.meta.url).href, 28, 28);
    svg('pavement', new URL('../assets/pavement.svg', import.meta.url).href, 28, 28);
    svg('house-roof', new URL('../assets/house-roof.svg', import.meta.url).href, 28, 28);
    svg('house-front-door', new URL('../assets/house-front-door.svg', import.meta.url).href, 28, 28);
    svg('house-front-window', new URL('../assets/house-front-window.svg', import.meta.url).href, 28, 28);
    svg('house-front-bare', new URL('../assets/house-front-bare.svg', import.meta.url).href, 28, 28);
    svg('water', new URL('../assets/water.svg', import.meta.url).href, 28, 28);
    // Higher-fidelity, menu-only dog portraits (rasterized at ~2x for crispness).
    svg('menu-husky', new URL('../assets/menu-husky.svg', import.meta.url).href, 256, 200);
    svg('menu-chi', new URL('../assets/menu-chi.svg', import.meta.url).href, 240, 200);
    svg('fenceH', new URL('../assets/fence-h.svg', import.meta.url).href, 28, 4);
    svg('fenceV', new URL('../assets/fence-v.svg', import.meta.url).href, 4, 28);
    // Food uses the original pixel-art PNGs from V1 (not the refactor's SVGs).
    this.load.image('treat', new URL('../assets/treat.png', import.meta.url).href);
    this.load.image('bowl', new URL('../assets/bowl.png', import.meta.url).href);
    this.load.image('bag', new URL('../assets/bag.png', import.meta.url).href);
    // The pup cup has no V1 pixel-art original, so it ships as an SVG.
    svg('pupcup', new URL('../assets/pupcup.svg', import.meta.url).href, 18, 20);

    for (const d of DIRS) {
      svg(`husky-${d}-0`, new URL(`../assets/husky-${d}-0.svg`, import.meta.url).href, 24, 24);
      svg(`husky-${d}-1`, new URL(`../assets/husky-${d}-1.svg`, import.meta.url).href, 24, 24);
      svg(`chi-${d}-0`, new URL(`../assets/chi-${d}-0.svg`, import.meta.url).href, 20, 20);
      svg(`chi-${d}-1`, new URL(`../assets/chi-${d}-1.svg`, import.meta.url).href, 20, 20);
    }
    for (const a of ['poop', 'pee', 'trick', 'idle']) {
      svg(`husky-${a}`, new URL(`../assets/husky-${a}.svg`, import.meta.url).href, 24, 24);
    }
  }

  create() {
    // Keep the pixel-art food crisp (no bilinear smoothing).
    for (const k of ['treat', 'bowl', 'bag']) {
      this.textures.get(k).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    this.scene.start('Menu');
  }
}
