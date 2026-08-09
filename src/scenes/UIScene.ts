import Phaser from 'phaser';
import { PALETTE } from '../config/palette';
import { GRID, DESIGN_HEIGHT } from '../config/constants';
import { config } from '../config/gameConfig';
import { HUSKY_NAME, CHI_NAME } from '../config/names';
import { tolerancePips, pipString, heatLabel } from '../ui/indicators';
import type { GameScene } from './GameScene';

export const HUD_H = 180;
const LOW_FOOD = 20;

// Left zone: Blizzard's own stats. Right zone: the tile Blizzard is standing on.
const LEFT_X = 24, LEFT_BAR = 168;
const CS_X = 706;            // Current Space panel left edge
const CS_A = 726, CS_A_BAR = 818;   // sub-column A (owner / tolerance / likes)
const CS_B = 1012, CS_B_BAR = 1072; // sub-column B (heat / poop / pee)
const BAR_W = 170, BAR_H = 14, BAR_R = 7;
// Blizzard's four stat rows share Current Space's top (y0+ROW0) and a tight
// pitch so the left section reads as the same height as the right one — a
// smaller Food→Water gap than before. Bars sit BAR_DY below their text row.
const ROW0 = 58, ROW_PITCH = 22, BAR_DY = 3;
const ROW = (i: number): number => ROW0 + i * ROW_PITCH; // 0=food 1=water 2=poop 3=pee
// Bandit's stat block sits in the gap between Blizzard's card (ends 358) and
// Current Space (starts 694). Narrower than Blizzard's, with a dimmer accent so
// the player reads it as the rival's (informational) stats, not their own. Its
// card ends 16px and its bars 24px clear of the Current Space card.
const BANDIT_CARD_X = 366, BANDIT_CARD_W = 312;
const BANDIT_X = 378, BANDIT_BAR = 512, BANDIT_BAR_W = 158;
const BANDIT_DIM = '#b7a482', BANDIT_BAR_ALPHA = 0.6;
// His mode line sits a row below the four stats, brighter than them so the
// player can read his intent at a glance. ROW(4)=146 clears the card's floor (168).
const BANDIT_GOAL = '#e8c98a';

export class UIScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private texts: Record<string, Phaser.GameObjects.Text> = {};
  constructor() { super('UI'); }

  create() {
    const y0 = DESIGN_HEIGHT;
    const W = GRID.COLS * GRID.TILE;
    const cream = Phaser.Display.Color.HexStringToColor(PALETTE.hudText).color;

    // Panel: warm dark card + summer-orange accent line. Drawn once.
    const panel = this.add.graphics();
    panel.fillStyle(Phaser.Display.Color.HexStringToColor('#241f1b').color, 0.96)
      .fillRect(0, y0, W, HUD_H);
    panel.fillStyle(Phaser.Display.Color.HexStringToColor(PALETTE.treat).color, 1)
      .fillRect(0, y0, W, 4);
    // Blizzard and Current Space each get their own matching inset card.
    const card = (x: number, w: number) => {
      panel.fillStyle(0xffffff, 0.05).fillRoundedRect(x, y0 + 30, w, HUD_H - 42, 10);
      panel.lineStyle(1, cream, 0.15).strokeRoundedRect(x, y0 + 30, w, HUD_H - 42, 10);
    };
    card(12, 346);                                   // Blizzard
    card(BANDIT_CARD_X, BANDIT_CARD_W);              // Bandit (rival — dimmer)
    card(CS_X - 12, W - (CS_X - 12) - 20);           // Current Space

    this.g = this.add.graphics();

    const mk = (k: string, x: number, y: number, size = '15px', originX = 0, color: string = PALETTE.hudText) => {
      this.texts[k] = this.add.text(x, y, '', { color, fontSize: size }).setOrigin(originX, 0);
    };
    // header — timer sits beside the score, left-aligned to the Current Space panel
    mk('timer', CS_X, y0 + 10, '17px');
    mk('score', W - 24, y0 + 10, '17px', 1);
    // zone headers
    this.add.text(LEFT_X, y0 + 34, HUSKY_NAME.toUpperCase(), { color: '#ffd27f', fontSize: '13px', fontStyle: 'bold' });
    this.add.text(BANDIT_X, y0 + 34, `🐕 ${CHI_NAME.toUpperCase()}`, { color: '#d8b06a', fontSize: '13px', fontStyle: 'bold' });
    this.add.text(CS_X, y0 + 34, 'CURRENT SPACE', { color: '#ffd27f', fontSize: '13px', fontStyle: 'bold' });
    // left zone (Blizzard) — food matches the other stat rows' size
    mk('food', LEFT_X, y0 + ROW(0), '15px');
    mk('waterL', LEFT_X, y0 + ROW(1));
    mk('poopL', LEFT_X, y0 + ROW(2));
    mk('peeL', LEFT_X, y0 + ROW(3));
    // Bandit (rival) — mirrors Blizzard's rows, dimmer accent
    mk('bFood', BANDIT_X, y0 + ROW(0), '15px', 0, BANDIT_DIM);
    mk('bWater', BANDIT_X, y0 + ROW(1), '15px', 0, BANDIT_DIM);
    mk('bPoop', BANDIT_X, y0 + ROW(2), '15px', 0, BANDIT_DIM);
    mk('bPee', BANDIT_X, y0 + ROW(3), '15px', 0, BANDIT_DIM);
    mk('bGoal', BANDIT_X, y0 + ROW(4), '14px', 0, BANDIT_GOAL); // which of his three modes he's in
    // right zone (Current Space) — sub-column A
    mk('owner', CS_A, y0 + 58, '15px');
    mk('tolL', CS_A, y0 + 88);
    mk('tolPips', CS_A + 82, y0 + 88, '15px', 0, '#ffd27f');
    mk('likesL', CS_A, y0 + 118);
    // sub-column B
    mk('heat', CS_B, y0 + 58);
    mk('csPoopL', CS_B, y0 + 88);
    mk('csPeeL', CS_B, y0 + 118);
  }

  update() {
    const gs = this.scene.get('Game') as GameScene;
    if (!gs || !(gs as any).getHudState) return;
    const s = gs.getHudState();
    const info = gs.getOwnerInfo(s.currentTile.ownerId);
    const y0 = DESIGN_HEIGHT;
    this.g.clear();

    const bar = (x: number, y: number, val: number, max: number, color: string, w = BAR_W, alpha = 1) => {
      this.g.fillStyle(0x000000, 0.28).fillRoundedRect(x, y, w, BAR_H, BAR_R);
      const f = Math.max(0, Math.min(1, val / max)) * w;
      if (f > 1) {
        const rr = Math.min(BAR_R, f / 2);
        this.g.fillStyle(Phaser.Display.Color.HexStringToColor(color).color, alpha).fillRoundedRect(x, y, f, BAR_H, rr);
      }
    };

    // Food: unbounded value (no bar/scale). Text reddens when low.
    const low = s.food < LOW_FOOD;
    this.texts.food.setText(`🍖 Food ${s.food.toFixed(0)}`);
    this.texts.food.setColor(low ? PALETTE.affection : PALETTE.hudText);

    // Blizzard's own resource bars (water has a cap; poop/pee are need-to-go).
    bar(LEFT_BAR, y0 + ROW(1) + BAR_DY, s.water, config.WATER_CAP, PALETTE.water);
    bar(LEFT_BAR, y0 + ROW(2) + BAR_DY, s.poop, config.POOP_MAX, PALETTE.fence);
    bar(LEFT_BAR, y0 + ROW(3) + BAR_DY, s.pee, config.PEE_MAX, PALETTE.affection);
    this.texts.waterL.setText(`💧 Water ${s.water.toFixed(0)}`);
    this.texts.poopL.setText(`💩 Poop ${s.poop.toFixed(0)}`);
    this.texts.peeL.setText(`🟡 Pee ${s.pee.toFixed(0)}`);

    // Bandit (rival) — same stats as Blizzard, dimmer bars/text.
    bar(BANDIT_BAR, y0 + ROW(1) + BAR_DY, s.chiWater, config.WATER_CAP, PALETTE.water, BANDIT_BAR_W, BANDIT_BAR_ALPHA);
    bar(BANDIT_BAR, y0 + ROW(2) + BAR_DY, s.chiPoop, config.POOP_MAX, PALETTE.fence, BANDIT_BAR_W, BANDIT_BAR_ALPHA);
    bar(BANDIT_BAR, y0 + ROW(3) + BAR_DY, s.chiPee, config.PEE_MAX, PALETTE.affection, BANDIT_BAR_W, BANDIT_BAR_ALPHA);
    const n0 = (v: number) => Math.max(0, v).toFixed(0); // never show a transient "-0"
    this.texts.bFood.setText(`🍖 Food ${n0(s.chiFood)}`);
    this.texts.bWater.setText(`💧 Water ${n0(s.chiWater)}`);
    this.texts.bPoop.setText(`💩 Poop ${n0(s.chiPoop)}`);
    this.texts.bPee.setText(`🟡 Pee ${n0(s.chiPee)}`);
    this.texts.bGoal.setText(s.chiGoalLabel);

    // Header
    const mm = Math.floor(s.secondsLeft / 60), ss = s.secondsLeft % 60;
    this.texts.timer.setText(`⏰ ${mm}:${ss.toString().padStart(2, '0')}`);
    this.texts.score.setText(`🐺 ${HUSKY_NAME} ${s.huskyFood.toFixed(0)}     🐕 ${CHI_NAME} ${s.chiFood.toFixed(0)}`);

    // Current Space — friendly indicators for the tile under Blizzard.
    this.texts.owner.setText(`🏠 ${info.name}`);
    this.texts.tolL.setText('Tolerance');
    this.texts.tolPips.setText(pipString(tolerancePips(info.sensitivity)));
    this.texts.likesL.setText('Likes you');
    bar(CS_A_BAR, y0 + 121, info.affection, 100, PALETTE.affection);
    const hot = heatLabel(s.currentTile.heat) === 'High';
    this.texts.heat.setText(`Heat  ${hot ? 'High' : 'Low'}`);
    this.texts.heat.setColor(hot ? '#ff8a5a' : '#7fbfe0');
    this.texts.csPoopL.setText('Poop');
    this.texts.csPeeL.setText('Pee');
    bar(CS_B_BAR, y0 + 91, s.currentTile.dirt, config.POOP_MAX, PALETTE.fence);
    bar(CS_B_BAR, y0 + 121, s.currentTile.destruction, config.PEE_MAX, PALETTE.affection);
  }
}
