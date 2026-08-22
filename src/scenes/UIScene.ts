import Phaser from 'phaser';
import { PALETTE } from '../config/palette';
import { GRID, DESIGN_HEIGHT } from '../config/constants';
import { config } from '../config/gameConfig';
import { HUSKY_NAME, CHI_NAME } from '../config/names';
import { tolerancePips, pipString, heatLabel, thresholdMarkerX, formatClock } from '../ui/indicators';
import type { GameScene } from './GameScene';
import { ITEMS, ITEM_TYPES } from '../entities/Item';

export const HUD_H = 180;

// Left zone: Blizzard's own stats. Right zone: the tile Blizzard is standing on.
const LEFT_X = 24,
  LEFT_BAR = 168;
const CS_X = 706; // Current Space panel left edge
const CS_A = 726,
  CS_A_BAR = 818; // sub-column A (owner / tolerance / likes)
const CS_B = 1012,
  CS_B_BAR = 1072; // sub-column B (heat / poop / pee)
const BAR_W = 170,
  BAR_H = 14,
  BAR_R = 7;
// Blizzard's four stat rows share Current Space's top (y0+ROW0) and a tight
// pitch so the left section reads as the same height as the right one — a
// smaller Food→Water gap than before. Bars sit BAR_DY below their text row.
const ROW0 = 58,
  ROW_PITCH = 22,
  BAR_DY = 3;
const ROW = (i: number): number => ROW0 + i * ROW_PITCH; // 0=food 1=water 2=poop 3=pee
// Bandit's stat block sits in the gap between Blizzard's card (ends 358) and
// Current Space (starts 694). Narrower than Blizzard's, with a dimmer accent so
// the player reads it as the rival's (informational) stats, not their own. Its
// card ends 16px and its bars 24px clear of the Current Space card.
const BANDIT_CARD_X = 366,
  BANDIT_CARD_W = 312;
const BANDIT_X = 378,
  BANDIT_BAR = 512,
  BANDIT_BAR_W = 158;
const BANDIT_DIM = '#b7a482',
  BANDIT_BAR_ALPHA = 0.6;
// His mode line sits a row below the four stats, brighter than them so the
// player can read his intent at a glance. ROW(4)=146 clears the card's floor (168).
const BANDIT_GOAL = '#e8c98a';
// Food-threshold markers on the affection bar. Thresholds are read live from
// config so a dev-panel edit moves the marker with the behaviour it describes.
const FOOD_THRESHOLDS = [
  { key: 'bowl', threshold: () => config.BOWL_THRESHOLD },
  { key: 'bag', threshold: () => config.BAG_THRESHOLD },
  { key: 'pupcup', threshold: () => config.PUPCUP_THRESHOLD },
] as const;
const AFFECTION_BAR_Y = 121,
  AFFECTION_ICON_Y = 150;
// The key that acts on each bar, parked just past its right end so the control
// is readable straight off the thing it changes. Row 0 (food) has no key.
const BAR_KEYS: { row: number; key: string }[] = [
  { row: 1, key: 'Q' },
  { row: 2, key: 'C' },
  { row: 3, key: 'Z' },
];
const BAR_KEY_X = LEFT_BAR + BAR_W + 7;
// Four item slots across Blizzard's 346-wide card. Each is drawn as a pill so
// the hotkey, icon and count read as one unit instead of three loose glyphs.
const ITEM_SLOT_W = 82;
const PILL_W = 74,
  PILL_H = 21,
  PILL_R = 10,
  PILL_DY = -2;
// While Bandit is penned his stats are frozen by design, so the card shows the
// only fact that matters: when he gets out.
const PENNED_CX = BANDIT_CARD_X + BANDIT_CARD_W / 2;
// Hoisted: create() and update() both draw with it.
const CREAM = Phaser.Display.Color.HexStringToColor(PALETTE.hudText).color;
// Tutorial banner strip, across the top of the play area.
const BANNER_X = 16,
  BANNER_Y = 12,
  BANNER_W = GRID.COLS * GRID.TILE - 32,
  BANNER_H = 84,
  BANNER_PAD = 14;

export class UIScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private texts: Record<string, Phaser.GameObjects.Text> = {};
  private thresholdIcons: Record<string, Phaser.GameObjects.Image> = {};
  private itemIcons: Record<string, Phaser.GameObjects.Image> = {};
  // Tutorial banner: a strip over the top of the play area so the player reads
  // the lesson while still playing it. Hidden entirely in a normal round.
  private bannerBg!: Phaser.GameObjects.Graphics;
  constructor() {
    super('UI');
  }

  create() {
    const y0 = DESIGN_HEIGHT;
    const W = GRID.COLS * GRID.TILE;

    // Panel: warm dark card + summer-orange accent line. Drawn once.
    const panel = this.add.graphics();
    panel.fillStyle(Phaser.Display.Color.HexStringToColor('#241f1b').color, 0.96).fillRect(0, y0, W, HUD_H);
    panel.fillStyle(Phaser.Display.Color.HexStringToColor(PALETTE.treat).color, 1).fillRect(0, y0, W, 4);
    // Blizzard and Current Space each get their own matching inset card.
    const card = (x: number, w: number) => {
      panel.fillStyle(0xffffff, 0.05).fillRoundedRect(x, y0 + 30, w, HUD_H - 42, 10);
      panel.lineStyle(1, CREAM, 0.15).strokeRoundedRect(x, y0 + 30, w, HUD_H - 42, 10);
    };
    card(12, 346); // Blizzard
    card(BANDIT_CARD_X, BANDIT_CARD_W); // Bandit (rival — dimmer)
    card(CS_X - 12, W - (CS_X - 12) - 20); // Current Space

    this.g = this.add.graphics();

    // Tutorial banner. It sits OVER the top rows of the play area, not above
    // them — there is no spare canvas up there — so it does cover Bandit's pen
    // and the north pond. Acceptable because the stages that mention either
    // point at his HUD card and at the south pond. Created always, shown only
    // while a walkthrough is running.
    this.bannerBg = this.add.graphics().setDepth(40).setVisible(false);
    const bannerText = (key: string, y: number, size: string, color: string, bold = false) => {
      this.texts[key] = this.add
        .text(BANNER_X, y, '', {
          color,
          fontSize: size,
          fontStyle: bold ? 'bold' : 'normal',
          wordWrap: { width: BANNER_W - 2 * BANNER_PAD },
        })
        .setDepth(41)
        .setVisible(false);
    };
    bannerText('tutStep', BANNER_Y + 10, '12px', '#d8b06a', true);
    bannerText('tutTitle', BANNER_Y + 26, '18px', '#ffd27f', true);
    bannerText('tutBody', BANNER_Y + 50, '14px', PALETTE.hudText);
    this.texts.tutProgress = this.add
      .text(BANNER_X + BANNER_W - BANNER_PAD, BANNER_Y + 10, '', {
        color: '#8fd98f',
        fontSize: '15px',
        fontStyle: 'bold',
      })
      .setOrigin(1, 0)
      .setDepth(41)
      .setVisible(false);

    const mk = (
      k: string,
      x: number,
      y: number,
      size = '15px',
      originX = 0,
      color: string = PALETTE.hudText,
    ) => {
      this.texts[k] = this.add.text(x, y, '', { color, fontSize: size }).setOrigin(originX, 0);
    };
    // header — timer sits beside the score, left-aligned to the Current Space panel
    mk('timer', CS_X, y0 + 10, '17px');
    mk('score', W - 24, y0 + 10, '17px', 1);
    // zone headers
    this.add.text(LEFT_X, y0 + 34, HUSKY_NAME.toUpperCase(), {
      color: '#ffd27f',
      fontSize: '13px',
      fontStyle: 'bold',
    });
    this.add.text(BANDIT_X, y0 + 34, `🐕 ${CHI_NAME.toUpperCase()}`, {
      color: '#d8b06a',
      fontSize: '13px',
      fontStyle: 'bold',
    });
    this.add.text(CS_X, y0 + 34, 'CURRENT SPACE', { color: '#ffd27f', fontSize: '13px', fontStyle: 'bold' });
    // left zone (Blizzard) — food matches the other stat rows' size
    mk('food', LEFT_X, y0 + ROW(0), '15px');
    mk('waterL', LEFT_X, y0 + ROW(1));
    mk('poopL', LEFT_X, y0 + ROW(2));
    mk('peeL', LEFT_X, y0 + ROW(3));
    // Hotkey badges beside Blizzard's action bars: drink, poop, pee.
    for (const { row, key } of BAR_KEYS) {
      this.add
        .text(BAR_KEY_X, y0 + ROW(row) + 2, key, {
          color: '#ffd27f',
          fontSize: '12px',
          fontStyle: 'bold',
        })
        .setOrigin(0, 0);
    }
    // Item belt, aligned with Bandit's goal line on the card opposite. Each slot
    // is the number key, the item's sprite, and how many he is carrying.
    ITEM_TYPES.forEach((type, i) => {
      const x = LEFT_X + i * ITEM_SLOT_W;
      this.texts[`key-${type}`] = this.add.text(x, y0 + ROW(4) + 2, ITEMS[type].key, {
        color: '#ffd27f',
        fontSize: '12px',
        fontStyle: 'bold',
      });
      this.itemIcons[type] = this.add.image(x + 20, y0 + ROW(4) + 9, type).setDisplaySize(15, 17);
      this.texts[`item-${type}`] = this.add.text(x + 32, y0 + ROW(4) + 1, '', {
        color: PALETTE.hudText,
        fontSize: '14px',
      });
    });
    // Bandit (rival) — mirrors Blizzard's rows, dimmer accent
    mk('bFood', BANDIT_X, y0 + ROW(0), '15px', 0, BANDIT_DIM);
    mk('bWater', BANDIT_X, y0 + ROW(1), '15px', 0, BANDIT_DIM);
    mk('bPoop', BANDIT_X, y0 + ROW(2), '15px', 0, BANDIT_DIM);
    mk('bPee', BANDIT_X, y0 + ROW(3), '15px', 0, BANDIT_DIM);
    mk('bGoal', BANDIT_X, y0 + ROW(4), '14px', 0, BANDIT_GOAL); // which of his three modes he's in
    // The penned presentation. Hidden whenever he is loose; see update().
    this.texts.bPennedLabel = this.add
      .text(PENNED_CX, y0 + 74, 'Leaves the yard in:', { color: BANDIT_DIM, fontSize: '15px' })
      .setOrigin(0.5, 0);
    this.texts.bPennedTime = this.add
      .text(PENNED_CX, y0 + 100, '', { color: '#ffd27f', fontSize: '40px', fontStyle: 'bold' })
      .setOrigin(0.5, 0);
    // right zone (Current Space) — sub-column A
    mk('owner', CS_A, y0 + 58, '15px');
    mk('tolL', CS_A, y0 + 88);
    mk('tolPips', CS_A + 82, y0 + 88, '15px', 0, '#ffd27f');
    mk('likesL', CS_A, y0 + 118);
    // Food thresholds on the affection bar: what this family's affection has to
    // reach before each food can appear on their lawn. The icons sit below the
    // bar (which ends at y0+135) with the card floor at y0+168.
    for (const t of FOOD_THRESHOLDS) {
      this.thresholdIcons[t.key] = this.add
        .image(0, y0 + AFFECTION_ICON_Y, t.key)
        .setOrigin(0.5, 0.5)
        .setDisplaySize(13, 14)
        .setDepth(2);
    }
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
        this.g
          .fillStyle(Phaser.Display.Color.HexStringToColor(color).color, alpha)
          .fillRoundedRect(x, y, f, BAR_H, rr);
      }
    };

    // Food: unbounded value (no bar/scale). Text reddens when low.
    // Shares WARN_FOOD_LOW with the audio warning, so the red text and the
    // sound can never disagree about what "low" means.
    const low = s.food <= config.WARN_FOOD_LOW;
    this.texts.food.setText(`🍖 Food ${s.food.toFixed(0)}`);
    this.texts.food.setColor(low ? PALETTE.affection : PALETTE.hudText);

    // Blizzard's own resource bars (water has a cap; poop/pee are need-to-go).
    bar(LEFT_BAR, y0 + ROW(1) + BAR_DY, s.water, config.WATER_CAP, PALETTE.water);
    bar(LEFT_BAR, y0 + ROW(2) + BAR_DY, s.poop, config.POOP_MAX, PALETTE.fence);
    bar(LEFT_BAR, y0 + ROW(3) + BAR_DY, s.pee, config.PEE_MAX, PALETTE.affection);
    this.texts.waterL.setText(`💧 Water ${s.water.toFixed(0)}`);
    this.texts.poopL.setText(`💩 Poop ${s.poop.toFixed(0)}`);
    this.texts.peeL.setText(`🟡 Pee ${s.pee.toFixed(0)}`);
    // Item belt. Each slot gets a pill behind it so its hotkey, icon and count
    // read as one unit rather than three loose glyphs. `this.g` is created
    // before the icons and labels in create(), so the pill lands behind them
    // without any depth juggling. A slot he can't use is dimmed, pill included.
    ITEM_TYPES.forEach((type, i) => {
      const n = s.items[type] ?? 0;
      const has = n > 0;
      this.g
        .fillStyle(0xffffff, has ? 0.1 : 0.04)
        .fillRoundedRect(LEFT_X + i * ITEM_SLOT_W - 4, y0 + ROW(4) + PILL_DY, PILL_W, PILL_H, PILL_R);
      this.g
        .lineStyle(1, CREAM, has ? 0.28 : 0.12)
        .strokeRoundedRect(LEFT_X + i * ITEM_SLOT_W - 4, y0 + ROW(4) + PILL_DY, PILL_W, PILL_H, PILL_R);
      this.texts[`item-${type}`].setText(`${n}`).setColor(has ? PALETTE.hudText : '#6b6055');
      this.texts[`key-${type}`].setAlpha(has ? 1 : 0.4);
      this.itemIcons[type].setAlpha(has ? 1 : 0.3);
    });

    // Bandit's card has two presentations. Visibility is set on BOTH paths
    // every frame rather than toggled on transition, so there is no state to
    // get stuck in — a row hidden by one branch is always re-shown by the other.
    const banditStats = ['bFood', 'bWater', 'bPoop', 'bPee', 'bGoal'];
    for (const k of banditStats) this.texts[k].setVisible(!s.chiPenned);
    this.texts.bPennedLabel.setVisible(s.chiPenned);
    this.texts.bPennedTime.setVisible(s.chiPenned);

    if (s.chiPenned) {
      // Penned: his needs are frozen by design, so four flat bars would say
      // nothing. The one fact worth the space is when he gets out.
      // No clock running yet (the tutorial holds him until its Bandit stage):
      // say so, rather than formatting a placeholder into a nonsense time.
      const counting = s.chiPennedSeconds !== null;
      this.texts.bPennedLabel.setText(counting ? 'Leaves the yard in:' : 'Shut in his own yard');
      this.texts.bPennedTime.setText(counting ? formatClock(s.chiPennedSeconds as number) : '');
    } else {
      const n0 = (v: number) => Math.max(0, v).toFixed(0); // never show a transient "-0"
      bar(
        BANDIT_BAR,
        y0 + ROW(1) + BAR_DY,
        s.chiWater,
        config.WATER_CAP,
        PALETTE.water,
        BANDIT_BAR_W,
        BANDIT_BAR_ALPHA,
      );
      bar(
        BANDIT_BAR,
        y0 + ROW(2) + BAR_DY,
        s.chiPoop,
        config.POOP_MAX,
        PALETTE.fence,
        BANDIT_BAR_W,
        BANDIT_BAR_ALPHA,
      );
      bar(
        BANDIT_BAR,
        y0 + ROW(3) + BAR_DY,
        s.chiPee,
        config.PEE_MAX,
        PALETTE.affection,
        BANDIT_BAR_W,
        BANDIT_BAR_ALPHA,
      );
      this.texts.bFood.setText(`🍖 Food ${n0(s.chiFood)}`);
      this.texts.bWater.setText(`💧 Water ${n0(s.chiWater)}`);
      this.texts.bPoop.setText(`💩 Poop ${n0(s.chiPoop)}`);
      this.texts.bPee.setText(`🟡 Pee ${n0(s.chiPee)}`);
      this.texts.bGoal.setText(s.chiGoalLabel);
    }

    // Tutorial banner. One branch, so the strip and its four texts are always
    // in agreement about whether a walkthrough is running.
    const tut = s.tutorial;
    this.bannerBg.clear().setVisible(!!tut);
    for (const k of ['tutStep', 'tutTitle', 'tutBody', 'tutProgress']) {
      this.texts[k].setVisible(!!tut);
    }
    if (tut) {
      this.bannerBg.fillStyle(0x241f1b, 0.9).fillRoundedRect(BANNER_X, BANNER_Y, BANNER_W, BANNER_H, 10);
      this.bannerBg
        .lineStyle(2, Phaser.Display.Color.HexStringToColor(PALETTE.treat).color, 0.9)
        .strokeRoundedRect(BANNER_X, BANNER_Y, BANNER_W, BANNER_H, 10);
      this.texts.tutStep.setText(`STEP ${tut.step} OF ${tut.total}`).setX(BANNER_X + BANNER_PAD);
      this.texts.tutTitle.setText(tut.title).setX(BANNER_X + BANNER_PAD);
      this.texts.tutBody.setText(tut.body).setX(BANNER_X + BANNER_PAD);
      this.texts.tutProgress.setText(tut.progress);
    }

    // Header
    // A tutorial has no round clock at all, so show nothing rather than a
    // 20:00 that never moves.
    this.texts.timer.setText(s.secondsLeft === null ? '' : `⏰ ${formatClock(s.secondsLeft)}`);
    this.texts.score.setText(
      `🐺 ${HUSKY_NAME} ${s.huskyFood.toFixed(0)}     🐕 ${CHI_NAME} ${s.chiFood.toFixed(0)}`,
    );

    // Current Space — friendly indicators for the tile under Blizzard.
    this.texts.owner.setText(`🏠 ${info.name}`);
    this.texts.tolL.setText('Tolerance');
    this.texts.tolPips.setText(pipString(tolerancePips(info.sensitivity)));
    this.texts.likesL.setText('Likes you');
    bar(CS_A_BAR, y0 + AFFECTION_BAR_Y, info.affection, 100, PALETTE.affection);
    // Referent line + icon per food threshold, so the bar says what it buys.
    for (const t of FOOD_THRESHOLDS) {
      const x = thresholdMarkerX(t.threshold(), CS_A_BAR, BAR_W);
      const reached = info.affection >= t.threshold();
      this.g
        .fillStyle(Phaser.Display.Color.HexStringToColor(PALETTE.hudText).color, reached ? 0.9 : 0.4)
        .fillRect(Math.round(x) - 1, y0 + AFFECTION_BAR_Y - 3, 2, BAR_H + 6);
      this.thresholdIcons[t.key].setX(x).setAlpha(reached ? 1 : 0.45);
    }
    const hot = heatLabel(s.currentTile.heat) === 'High';
    this.texts.heat.setText(`Heat  ${hot ? 'High' : 'Low'}`);
    this.texts.heat.setColor(hot ? '#ff8a5a' : '#7fbfe0');
    this.texts.csPoopL.setText('Poop');
    this.texts.csPeeL.setText('Pee');
    bar(CS_B_BAR, y0 + 91, s.currentTile.dirt, config.POOP_MAX, PALETTE.fence);
    bar(CS_B_BAR, y0 + 121, s.currentTile.destruction, config.PEE_MAX, PALETTE.affection);
  }
}
