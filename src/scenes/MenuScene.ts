import Phaser from 'phaser';
import { PALETTE } from '../config/palette';
import { DEFAULT_DIFFICULTY, DIFFICULTIES, type Difficulty } from '../config/difficulty';
import { buildMenuLayout, DIFFICULTY_SEGMENT_HEIGHT } from '../ui/menuLayout';
import { audio } from '../audio/AudioEngine';

const hex = (c: string) => Phaser.Display.Color.HexStringToColor(c).color;
const DISPLAY_FONT = '"Trebuchet MS", Arial, sans-serif';

// Size a container and give it a hit area that matches its centered visuals. A
// Container anchors its setSize input frame at the top-left of the size box
// while its children render from the center, so the hit rect must be
// (0,0,w,h) — a centered (-w/2,-h/2,w,h) rect lands shifted half-width off.
function sizeAndHit(cont: Phaser.GameObjects.Container, w: number, h: number): void {
  cont.setSize(w, h).setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
}

export class MenuScene extends Phaser.Scene {
  private difficulty: Difficulty = DEFAULT_DIFFICULTY;
  private devMode = false;
  constructor() { super('Menu'); }

  create() {
    this.difficulty = DEFAULT_DIFFICULTY;
    this.devMode = false;
    const W = this.scale.width, H = this.scale.height, cx = W / 2;
    const horizon = 360;
    const layout = buildMenuLayout(horizon);

    this.drawScene(W, H, horizon);

    // Title
    this.add.text(cx, 132, 'Back Yard Bandits', {
      fontFamily: DISPLAY_FONT, fontSize: '62px', color: '#263b4a', fontStyle: 'bold',
    }).setOrigin(0.5).setShadow(0, 2, 'rgba(255,255,255,0.42)', 0, false, true);
    this.add.text(cx, 192, 'Escape the yard. Gather treats. Rule the neighborhood.', {
      fontFamily: DISPLAY_FONT, fontSize: '20px', color: '#38505b', fontStyle: 'bold',
    }).setOrigin(0.5);

    // Flanking dogs facing the center — higher-fidelity menu-only portraits.
    // The husky reads bigger than the chihuahua, as in-game.
    this.add.image(210, 468, 'menu-husky').setScale(0.64).setOrigin(0.5);
    this.add.image(W - 210, 476, 'menu-chi').setScale(0.5).setOrigin(0.5);

    // Difficulty segmented control.
    this.add.text(cx, layout.challengeHeadingY, 'CHOOSE YOUR CHALLENGE', {
      fontFamily: DISPLAY_FONT, fontSize: '15px', color: '#5e492c', fontStyle: 'bold',
    }).setOrigin(0.5).setLetterSpacing(2);
    this.buildDifficulty(cx, layout.difficultyY);

    // Primary + secondary actions, stacked and centered.
    // Phaser queues native input and dispatches it during the game step, so a
    // resume() from a Phaser handler is no longer inside the gesture's call
    // stack. Chrome/Firefox accept that (sticky activation); WebKit does not, so
    // also unlock from a native listener the first time anything is pressed.
    const unlock = () => audio.resume();
    document.addEventListener('pointerdown', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });

    this.button(cx, layout.startY, 240, 56, 'Start', true, () => {
      audio.resume();
      this.scene.start('Game', { difficulty: this.difficulty, devMode: this.devMode });
    });
    this.button(cx, layout.howToPlayY, 240, 46, 'How to Play', false, () => this.scene.start('Instructions'));

    // Dev mode lives out of the way in the bottom-left corner.
    this.buildDevToggle(96, H - 48);
  }

  private drawScene(W: number, H: number, horizon: number) {
    const g = this.add.graphics();
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
    const segW = 150, segH = DIFFICULTY_SEGMENT_HEIGHT, gap = 10, totalW = levels.length * segW + (levels.length - 1) * gap;
    const startX = cx - totalW / 2 + segW / 2;
    const segs: { key: Difficulty; g: Phaser.GameObjects.Graphics; name: Phaser.GameObjects.Text; sub: Phaser.GameObjects.Text }[] = [];
    const refresh = () => {
      for (const s of segs) {
        const active = s.key === this.difficulty;
        s.g.clear();
        s.g.fillStyle(active ? hex('#ffd27f') : hex('#2a2622'), active ? 1 : 0.55)
          .fillRoundedRect(-segW / 2, -segH / 2, segW, segH, 10);
        s.g.lineStyle(1.5, hex('#ffd27f'), active ? 1 : 0.4).strokeRoundedRect(-segW / 2, -segH / 2, segW, segH, 10);
        s.name.setColor(active ? '#3a2f22' : '#f2ede0');
        s.sub.setColor(active ? '#6b5a3a' : '#b7a482');
      }
    };
    levels.forEach((key, i) => {
      const x = startX + i * (segW + gap);
      const cont = this.add.container(x, y);
      const g = this.add.graphics();
      const label = key.charAt(0).toUpperCase() + key.slice(1);
      const name = this.add.text(0, -9, label, { fontSize: '18px', color: '#f2ede0', fontStyle: 'bold' }).setOrigin(0.5);
      const sub = this.add.text(0, 11, DIFFICULTIES[key].subtitle, { fontSize: '11px', color: '#b7a482' }).setOrigin(0.5);
      cont.add([g, name, sub]);
      sizeAndHit(cont, segW, segH);
      cont.on('pointerdown', () => { this.difficulty = key; refresh(); });
      segs.push({ key, g, name, sub });
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
    sizeAndHit(cont, w, h);
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
    sizeAndHit(cont, w, h);
    cont.on('pointerdown', () => { this.devMode = !this.devMode; draw(); });
  }
}
