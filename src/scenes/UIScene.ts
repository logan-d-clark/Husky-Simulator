import Phaser from 'phaser';
import { PALETTE } from '../config/palette';
import { DESIGN_HEIGHT } from '../main';
import { GRID, WATER_MAX } from '../config/constants';
import type { GameScene } from './GameScene';

export class UIScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private texts: Record<string, Phaser.GameObjects.Text> = {};
  constructor() { super('UI'); }

  create() {
    const y0 = DESIGN_HEIGHT;
    this.add.rectangle(0, y0, GRID.COLS * GRID.TILE, 140, 0x000000).setOrigin(0, 0)
      .setFillStyle(Phaser.Display.Color.HexStringToColor(PALETTE.hudBg).color);
    this.g = this.add.graphics();
    const mk = (k: string, x: number, y: number) => {
      this.texts[k] = this.add.text(x, y, '', { color: PALETTE.hudText, fontSize: '14px' });
    };
    mk('timer', 16, y0 + 10); mk('foodL', 120, y0 + 10); mk('waterL', 120, y0 + 34);
    mk('poopL', 120, y0 + 58); mk('peeL', 120, y0 + 82);
    mk('space', 16, y0 + 40); mk('score', 16, y0 + 100);
  }

  update() {
    const gs = this.scene.get('Game') as GameScene;
    if (!gs || !(gs as any).getHudState) return;
    const s = gs.getHudState();
    const y0 = DESIGN_HEIGHT;
    this.g.clear();
    const bar = (y: number, val: number, max: number, color: string) => {
      const w = 220;
      this.g.fillStyle(0x000000, 0.4).fillRect(340, y, w, 16);
      this.g.fillStyle(Phaser.Display.Color.HexStringToColor(color).color, 1)
        .fillRect(340, y, Math.max(0, Math.min(1, val / max)) * w, 16);
    };
    bar(y0 + 12, s.food, 100, PALETTE.treat);
    bar(y0 + 36, s.water, WATER_MAX / 8, PALETTE.water);
    bar(y0 + 60, s.poop, 100, PALETTE.fence);
    bar(y0 + 84, s.pee, 100, PALETTE.affection);
    this.texts.foodL.setText(`🍖 Food ${s.food.toFixed(0)}`);
    this.texts.waterL.setText(`💧 Water ${s.water.toFixed(0)}`);
    this.texts.poopL.setText(`💩 Poop ${s.poop.toFixed(0)}`);
    this.texts.peeL.setText(`🟡 Pee ${s.pee.toFixed(0)}`);
    const mm = Math.floor(s.secondsLeft / 60), ss = s.secondsLeft % 60;
    this.texts.timer.setText(`⏰ ${mm}:${ss.toString().padStart(2, '0')}`);
    this.texts.space.setText(`Heat ${s.currentTile.heat}  Poop ${s.currentTile.dirt}  Pee ${s.currentTile.destruction}`);
    this.texts.score.setText(`🐺 You ${s.huskyTreats}   🐕 Rival ${s.chiTreats}`);
  }
}
