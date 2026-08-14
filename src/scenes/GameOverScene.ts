import Phaser from 'phaser';
import { PALETTE } from '../config/palette';
import { HUSKY_NAME, CHI_NAME } from '../config/names';

import { DEFAULT_DIFFICULTY, type Difficulty } from '../config/difficulty';

// `difficulty`/`devMode` ride along purely so "Play Again" can replay the round
// the player just lost. Without them scene.start('Game') passes no data and
// GameScene.init falls back to the default, silently downgrading a Blizzlord
// run to Puppy — rival speed, fog of war and the Bandit gate delay all change.
interface Gmeta {
  reason: 'Time' | 'Food' | 'Water';
  huskyFood: number;
  chiFood: number;
  difficulty?: Difficulty;
  devMode?: boolean;
}

export class GameOverScene extends Phaser.Scene {
  private meta!: Gmeta;
  constructor() {
    super('GameOver');
  }
  init(data: Gmeta) {
    this.meta = data;
  }
  create() {
    const cx = this.scale.width / 2;
    this.cameras.main.setBackgroundColor(PALETTE.hudBg);
    const reasonText: Record<Gmeta['reason'], string> = {
      Time: `${HUSKY_NAME}'s owner came home!`,
      Food: `${HUSKY_NAME} ran out of food!`,
      Water: `${HUSKY_NAME} ran out of water!`,
    };
    this.add
      .text(cx, 140, 'Game Over', { fontSize: '48px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5);
    this.add
      .text(cx, 210, reasonText[this.meta.reason], { fontSize: '24px', color: '#ffffff' })
      .setOrigin(0.5);
    const won = this.meta.huskyFood >= this.meta.chiFood;
    this.add
      .text(cx, 290, `${HUSKY_NAME} finished with ${this.meta.huskyFood.toFixed(0)} food`, {
        fontSize: '26px',
        color: '#ffffff',
      })
      .setOrigin(0.5);
    this.add
      .text(cx, 330, `${CHI_NAME} finished with ${this.meta.chiFood.toFixed(0)}`, {
        fontSize: '20px',
        color: '#dddddd',
      })
      .setOrigin(0.5);
    this.add
      .text(cx, 380, won ? `${HUSKY_NAME} wins! 🏆` : `${CHI_NAME} won this time…`, {
        fontSize: '28px',
        color: won ? '#ffd27f' : '#ff8a8a',
      })
      .setOrigin(0.5);
    const btn = (y: number, label: string, fn: () => void) => {
      const t = this.add
        .text(cx, y, label, {
          fontSize: '26px',
          color: PALETTE.hudText,
          backgroundColor: PALETTE.grassBase,
          padding: { x: 18, y: 8 },
        })
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
      t.on('pointerdown', fn);
    };
    btn(460, 'Play Again', () => {
      this.scene.start('Game', {
        difficulty: this.meta.difficulty ?? DEFAULT_DIFFICULTY,
        devMode: this.meta.devMode ?? false,
      });
    });
    btn(520, 'Main Menu', () => {
      this.scene.start('Menu');
    });
  }
}
