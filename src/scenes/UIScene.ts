import Phaser from 'phaser';
import { PALETTE } from '../config/palette';
import { DESIGN_HEIGHT } from '../main';
import { GRID, WATER_CAP } from '../config/constants';
import type { GameScene } from './GameScene';

const HUD_H = 140;
// Two stat columns; each label sits immediately left of its own bar.
// Col A = Food (top) / Poop (bottom); Col B = Water (top) / Pee (bottom).
const COL_A_LABEL = 28, COL_A_BAR = 158;
const COL_B_LABEL = 470, COL_B_BAR = 600;
const BAR_W = 200, BAR_H = 14, BAR_R = 7;
// Offsets relative to the HUD top (y0). Bars sit ~3px below their label's top
// so the pill vertically centers against the 15px text.
const ROW1_TEXT = 44, ROW2_TEXT = 76;
const ROW1_BAR = 47, ROW2_BAR = 79;

export class UIScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private texts: Record<string, Phaser.GameObjects.Text> = {};
  constructor() { super('UI'); }

  create() {
    const y0 = DESIGN_HEIGHT;
    const W = GRID.COLS * GRID.TILE;

    // Panel: warm dark card with a summer-orange accent line along the top —
    // modern and clean while staying in the game's warm palette. Drawn once.
    const panel = this.add.graphics();
    panel.fillStyle(Phaser.Display.Color.HexStringToColor('#241f1b').color, 0.96)
      .fillRect(0, y0, W, HUD_H);
    panel.fillStyle(Phaser.Display.Color.HexStringToColor(PALETTE.treat).color, 1)
      .fillRect(0, y0, W, 4);

    this.g = this.add.graphics();

    const mk = (k: string, x: number, y: number, size = '15px', originX = 0) => {
      this.texts[k] = this.add.text(x, y, '', { color: PALETTE.hudText, fontSize: size })
        .setOrigin(originX, 0);
    };
    // header row
    mk('timer', 28, y0 + 12, '17px');
    mk('score', W - 28, y0 + 12, '17px', 1);
    // stat columns
    mk('foodL', COL_A_LABEL, y0 + ROW1_TEXT);
    mk('poopL', COL_A_LABEL, y0 + ROW2_TEXT);
    mk('waterL', COL_B_LABEL, y0 + ROW1_TEXT);
    mk('peeL', COL_B_LABEL, y0 + ROW2_TEXT);
    // footer row
    mk('space', 28, y0 + 110, '13px');
    mk('profile', W - 28, y0 + 110, '13px', 1);
  }

  update() {
    const gs = this.scene.get('Game') as GameScene;
    if (!gs || !(gs as any).getHudState) return;
    const s = gs.getHudState();
    const y0 = DESIGN_HEIGHT;
    this.g.clear();

    // Rounded pill bar: translucent track + rounded fill in a palette accent.
    const bar = (x: number, y: number, val: number, max: number, color: string) => {
      this.g.fillStyle(0x000000, 0.28).fillRoundedRect(x, y, BAR_W, BAR_H, BAR_R);
      const f = Math.max(0, Math.min(1, val / max)) * BAR_W;
      if (f > 1) {
        const rr = Math.min(BAR_R, f / 2);
        this.g.fillStyle(Phaser.Display.Color.HexStringToColor(color).color, 1)
          .fillRoundedRect(x, y, f, BAR_H, rr);
      }
    };
    bar(COL_A_BAR, y0 + ROW1_BAR, s.food, 100, PALETTE.treat);
    bar(COL_A_BAR, y0 + ROW2_BAR, s.poop, 100, PALETTE.fence);
    bar(COL_B_BAR, y0 + ROW1_BAR, s.water, WATER_CAP, PALETTE.water);
    bar(COL_B_BAR, y0 + ROW2_BAR, s.pee, 100, PALETTE.affection);

    this.texts.foodL.setText(`🍖 Food ${s.food.toFixed(0)}`);
    this.texts.poopL.setText(`💩 Poop ${s.poop.toFixed(0)}`);
    this.texts.waterL.setText(`💧 Water ${s.water.toFixed(0)}`);
    this.texts.peeL.setText(`🟡 Pee ${s.pee.toFixed(0)}`);

    const mm = Math.floor(s.secondsLeft / 60), ss = s.secondsLeft % 60;
    this.texts.timer.setText(`⏰ ${mm}:${ss.toString().padStart(2, '0')}`);
    this.texts.score.setText(`🐺 You ${s.huskyTreats}     🐕 Rival ${s.chiTreats}`);
    this.texts.space.setText(
      `📍 Tile · heat ${s.currentTile.heat} · dirt ${s.currentTile.dirt} · dmg ${s.currentTile.destruction}`,
    );
    const info = gs.getOwnerInfo(s.currentTile.ownerId);
    this.texts.profile.setText(`🏠 ${info.name} · tolerance ${info.sensitivity} · likes you ${info.affection.toFixed(0)}`);
  }
}
