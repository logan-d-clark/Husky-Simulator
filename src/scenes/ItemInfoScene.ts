import Phaser from 'phaser';
import { PALETTE } from '../config/palette';
import { ITEMS, type ItemType } from '../entities/Item';

interface InfoData {
  type: ItemType;
  resume: () => void;
}

// The first time Blizzard picks up each item, the round stops and this explains
// it. A Phaser overlay rather than a DOM panel: the canvas is Scale.FIT, so a
// DOM panel would have to track the canvas transform to stay put.
//
// It owns the resume callback rather than resuming Game/UI itself, so there is
// exactly one place that knows which scenes were paused — a half-resume here
// would soft-lock the round.
export class ItemInfoScene extends Phaser.Scene {
  private info!: InfoData; // not `data` — Phaser.Scene already owns that name
  constructor() {
    super('ItemInfo');
  }
  init(data: InfoData) {
    this.info = data;
  }

  create() {
    const { width, height } = this.scale;
    const cx = width / 2,
      cy = height / 2;
    const info = ITEMS[this.info.type];

    this.add.rectangle(0, 0, width, height, 0x000000, 0.62).setOrigin(0, 0);

    const W = 560,
      H = 300;
    const panel = this.add.graphics();
    panel
      .fillStyle(Phaser.Display.Color.HexStringToColor('#241f1b').color, 0.98)
      .fillRoundedRect(cx - W / 2, cy - H / 2, W, H, 14);
    panel
      .lineStyle(2, Phaser.Display.Color.HexStringToColor(PALETTE.treat).color, 1)
      .strokeRoundedRect(cx - W / 2, cy - H / 2, W, H, 14);

    this.add
      .text(cx, cy - H / 2 + 28, 'NEW ITEM', {
        fontSize: '13px',
        color: '#d8b06a',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setLetterSpacing(2);

    this.add.image(cx, cy - 62, this.info.type).setDisplaySize(46, 51);
    this.add
      .text(cx, cy - 22, info.name, { fontSize: '26px', color: '#ffd27f', fontStyle: 'bold' })
      .setOrigin(0.5);
    this.add
      .text(cx, cy + 32, info.blurb, {
        fontSize: '15px',
        color: PALETTE.hudText,
        align: 'center',
        wordWrap: { width: W - 80 },
      })
      .setOrigin(0.5);
    this.add
      .text(cx, cy + H / 2 - 46, `Press  ${info.key}  to use it`, {
        fontSize: '17px',
        color: '#ffd27f',
      })
      .setOrigin(0.5);
    this.add
      .text(cx, cy + H / 2 - 20, 'click or press any key to continue', {
        fontSize: '12px',
        color: '#b7a482',
      })
      .setOrigin(0.5);

    let done = false;
    const dismiss = () => {
      if (done) return;
      done = true;
      this.info.resume();
      this.scene.stop();
    };

    // You reach a pickup by WALKING onto it, so a direction key is held at the
    // moment this opens — and the OS repeats that keydown ~30x a second. Wiring
    // dismissal straight to keydown closed the panel within a frame or two, and
    // the item was already marked seen, so its explanation never appeared again.
    // Hence: ignore auto-repeats, and stay up briefly before accepting anything.
    this.time.delayedCall(350, () => {
      this.input.once('pointerdown', dismiss);
      this.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
        if (!e.repeat) dismiss();
      });
    });
  }
}
