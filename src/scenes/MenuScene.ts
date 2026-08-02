import Phaser from 'phaser';
import { PALETTE } from '../config/palette';
import { DEFAULT_DIFFICULTY, DIFFICULTIES, type Difficulty } from '../config/difficulty';

const hex = (c: string) => Phaser.Display.Color.HexStringToColor(c).color;

export class MenuScene extends Phaser.Scene {
  private difficulty: Difficulty = DEFAULT_DIFFICULTY;
  private devMode = false;
  constructor() { super('Menu'); }

  create() {
    this.difficulty = DEFAULT_DIFFICULTY;
    this.devMode = false;
    const W = this.scale.width, H = this.scale.height, cx = W / 2;

    this.drawScene(W, H);

    // Title
    this.add.text(cx, 132, 'Husky Simulator', {
      fontSize: '58px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5).setShadow(0, 4, '#2a2622', 6, false, true);
    this.add.text(cx, 192, 'Escape the yard. Gather treats. Beat the rival.', {
      fontSize: '20px', color: '#f2ede0',
    }).setOrigin(0.5).setShadow(0, 2, '#2a2622', 3);

    // Flanking dogs facing the center.
    this.add.image(196, 452, 'husky-right-0').setScale(3.6).setOrigin(0.5);
    this.add.image(W - 196, 452, 'chi-left-0').setScale(3.6).setOrigin(0.5);

    // Difficulty segmented control.
    this.add.text(cx, 300, 'DIFFICULTY', { fontSize: '15px', color: '#ffd27f', fontStyle: 'bold' }).setOrigin(0.5);
    this.buildDifficulty(cx, 340);

    // Primary + secondary actions, stacked and centered.
    this.button(cx, 430, 240, 56, 'Start', true, () =>
      this.scene.start('Game', { difficulty: this.difficulty, devMode: this.devMode }));
    this.button(cx, 502, 240, 46, 'How to Play', false, () => this.scene.start('Instructions'));
    this.button(cx, 562, 240, 46, 'Credits', false, () => this.scene.start('Instructions'));

    // Dev mode lives out of the way in the bottom-left corner.
    this.buildDevToggle(96, H - 48);
  }

  private drawScene(W: number, H: number) {
    const g = this.add.graphics();
    const horizon = 360;
    // Sky gradient.
    g.fillGradientStyle(hex('#8fd4ec'), hex('#8fd4ec'), hex('#cdeef7'), hex('#cdeef7'), 1)
      .fillRect(0, 0, W, horizon);
    // Sun with a soft halo.
    g.fillStyle(hex('#ffe08a'), 0.35).fillCircle(W - 150, 110, 78);
    g.fillStyle(hex('#ffe08a'), 1).fillCircle(W - 150, 110, 52);
    // Clouds.
    g.fillStyle(0xffffff, 0.9);
    for (const [x, y, s] of [[240, 96, 1], [520, 150, 0.8], [900, 84, 1.1]] as const) {
      g.fillCircle(x, y, 22 * s); g.fillCircle(x + 26 * s, y + 6, 28 * s); g.fillCircle(x + 58 * s, y, 20 * s);
    }
    // Grass with a lighter strip at the horizon.
    g.fillStyle(hex(PALETTE.grassBase), 1).fillRect(0, horizon, W, H - horizon);
    g.fillStyle(hex('#7cbb5e'), 1).fillRect(0, horizon, W, 10);
  }

  private buildDifficulty(cx: number, y: number) {
    const levels = Object.keys(DIFFICULTIES) as Difficulty[];
    const segW = 132, gap = 8, totalW = levels.length * segW + (levels.length - 1) * gap;
    const startX = cx - totalW / 2 + segW / 2;
    const segs: { key: Difficulty; g: Phaser.GameObjects.Graphics; t: Phaser.GameObjects.Text }[] = [];
    const refresh = () => {
      for (const s of segs) {
        const active = s.key === this.difficulty;
        s.g.clear();
        s.g.fillStyle(active ? hex('#ffd27f') : hex('#2a2622'), active ? 1 : 0.55)
          .fillRoundedRect(-segW / 2, -18, segW, 36, 10);
        s.g.lineStyle(1.5, hex('#ffd27f'), active ? 1 : 0.4).strokeRoundedRect(-segW / 2, -18, segW, 36, 10);
        s.t.setColor(active ? '#3a2f22' : '#f2ede0');
      }
    };
    levels.forEach((key, i) => {
      const x = startX + i * (segW + gap);
      const cont = this.add.container(x, y);
      const g = this.add.graphics();
      const label = key.charAt(0).toUpperCase() + key.slice(1);
      const t = this.add.text(0, 0, label, { fontSize: '18px', color: '#f2ede0' }).setOrigin(0.5);
      cont.add([g, t]);
      cont.setSize(segW, 36).setInteractive(new Phaser.Geom.Rectangle(-segW / 2, -18, segW, 36), Phaser.Geom.Rectangle.Contains);
      cont.on('pointerdown', () => { this.difficulty = key; refresh(); });
      segs.push({ key, g, t });
    });
    refresh();
  }

  private button(cx: number, y: number, w: number, h: number, label: string, primary: boolean, fn: () => void) {
    const base = primary ? '#e08a3d' : '#2a2622';
    const hover = primary ? '#ffab5c' : '#4a423a';
    const cont = this.add.container(cx, y);
    const g = this.add.graphics();
    const t = this.add.text(0, 0, label, {
      fontSize: primary ? '26px' : '20px', color: '#ffffff', fontStyle: primary ? 'bold' : 'normal',
    }).setOrigin(0.5);
    const draw = (h2: boolean) => {
      g.clear();
      g.fillStyle(hex(h2 ? hover : base), primary ? 1 : 0.9).fillRoundedRect(-w / 2, -h / 2, w, h, 14);
      g.lineStyle(2, hex('#f2ede0'), primary ? 0.9 : 0.35).strokeRoundedRect(-w / 2, -h / 2, w, h, 14);
    };
    draw(false);
    cont.add([g, t]);
    cont.setSize(w, h).setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);
    cont.on('pointerover', () => draw(true));
    cont.on('pointerout', () => draw(false));
    cont.on('pointerdown', fn);
  }

  private buildDevToggle(x: number, y: number) {
    const w = 150, h = 34;
    const cont = this.add.container(x, y);
    const g = this.add.graphics();
    const t = this.add.text(0, 0, '', { fontSize: '14px' }).setOrigin(0.5);
    const draw = () => {
      g.clear();
      g.fillStyle(this.devMode ? hex('#8fd98f') : hex('#2a2622'), 0.9).fillRoundedRect(-w / 2, -h / 2, w, h, 10);
      g.lineStyle(1.5, hex('#f2ede0'), 0.4).strokeRoundedRect(-w / 2, -h / 2, w, h, 10);
      t.setText(`Dev Mode: ${this.devMode ? 'On' : 'Off'}`).setColor(this.devMode ? '#26301f' : '#f2ede0');
    };
    draw();
    cont.add([g, t]);
    cont.setSize(w, h).setInteractive(new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h), Phaser.Geom.Rectangle.Contains);
    cont.on('pointerdown', () => { this.devMode = !this.devMode; draw(); });
  }
}
