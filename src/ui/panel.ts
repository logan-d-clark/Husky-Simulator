import Phaser from 'phaser';
import { PALETTE } from '../config/palette';

// The modal panel shape shared by the item explainer and the tutorial's
// coaching/summary panels. Extracted so there is one implementation of the
// dimmer, the card, the copy layout and — most importantly — the dismissal
// rules, which are subtler than they look.

export interface PanelOpts {
  /** Small caps line at the top, e.g. NEW ITEM. */
  kicker: string;
  title: string;
  body: string;
  /** Optional emphasised line above the dismiss hint. */
  footer?: string;
  /** Optional texture key shown above the title. */
  iconKey?: string;
  /** Text of the dismiss hint. */
  hint: string;
  /** Runs once, after this scene has already been stopped. */
  onDismiss: () => void;
}

const W = 560,
  H = 300;

/**
 * Draw the panel into `scene` and wire its dismissal.
 *
 * Two rules here are load-bearing and were both bugs first:
 *
 * 1. The scene stops BEFORE `onDismiss` runs. That callback may queue the next
 *    panel's launch, and Phaser processes scene ops in order — stopping after
 *    would kill the panel just started, leaving the game paused with nothing on
 *    screen able to un-pause it.
 * 2. Input is ignored for a beat, and auto-repeat keydowns never dismiss. A
 *    panel often opens while a movement key is physically held, and the OS
 *    repeats that keydown ~30x a second, which closed the panel within a frame.
 */
export function drawPanel(scene: Phaser.Scene, opts: PanelOpts): void {
  const { width, height } = scene.scale;
  const cx = width / 2,
    cy = height / 2;

  scene.add.rectangle(0, 0, width, height, 0x000000, 0.62).setOrigin(0, 0);

  const card = scene.add.graphics();
  card
    .fillStyle(Phaser.Display.Color.HexStringToColor('#241f1b').color, 0.98)
    .fillRoundedRect(cx - W / 2, cy - H / 2, W, H, 14);
  card
    .lineStyle(2, Phaser.Display.Color.HexStringToColor(PALETTE.treat).color, 1)
    .strokeRoundedRect(cx - W / 2, cy - H / 2, W, H, 14);

  scene.add
    .text(cx, cy - H / 2 + 28, opts.kicker, {
      fontSize: '13px',
      color: '#d8b06a',
      fontStyle: 'bold',
    })
    .setOrigin(0.5)
    .setLetterSpacing(2);

  if (opts.iconKey) scene.add.image(cx, cy - 62, opts.iconKey).setDisplaySize(46, 51);

  scene.add
    .text(cx, cy - 22, opts.title, { fontSize: '26px', color: '#ffd27f', fontStyle: 'bold' })
    .setOrigin(0.5)
    .setWordWrapWidth(W - 60);
  scene.add
    .text(cx, cy + 36, opts.body, {
      fontSize: '15px',
      color: PALETTE.hudText,
      align: 'center',
      wordWrap: { width: W - 80 },
    })
    .setOrigin(0.5);
  if (opts.footer) {
    scene.add.text(cx, cy + H / 2 - 46, opts.footer, { fontSize: '17px', color: '#ffd27f' }).setOrigin(0.5);
  }
  scene.add.text(cx, cy + H / 2 - 20, opts.hint, { fontSize: '12px', color: '#b7a482' }).setOrigin(0.5);

  let done = false;
  const dismiss = () => {
    if (done) return;
    done = true;
    scene.scene.stop();
    opts.onDismiss();
  };

  scene.time.delayedCall(350, () => {
    scene.input.once('pointerdown', dismiss);
    scene.input.keyboard?.on('keydown', (e: KeyboardEvent) => {
      if (!e.repeat) dismiss();
    });
  });
}
