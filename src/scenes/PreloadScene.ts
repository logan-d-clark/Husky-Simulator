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
    svg('house-front', new URL('../assets/house-front.svg', import.meta.url).href, 28, 28);
    svg('water', new URL('../assets/water.svg', import.meta.url).href, 28, 28);
    svg('fenceH', new URL('../assets/fence-h.svg', import.meta.url).href, 28, 4);
    svg('fenceV', new URL('../assets/fence-v.svg', import.meta.url).href, 4, 28);
    svg('treat', new URL('../assets/treat.svg', import.meta.url).href, 16, 16);
    svg('bowl', new URL('../assets/bowl.svg', import.meta.url).href, 18, 18);
    svg('bag', new URL('../assets/bag.svg', import.meta.url).href, 18, 20);

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

  create() { this.scene.start('Menu'); }
}
