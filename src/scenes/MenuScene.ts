import Phaser from 'phaser';
import { PALETTE } from '../config/palette';
import { DEFAULT_DIFFICULTY, DIFFICULTIES, type Difficulty } from '../config/difficulty';

export class MenuScene extends Phaser.Scene {
  private difficulty: Difficulty = DEFAULT_DIFFICULTY;
  constructor() { super('Menu'); }
  create() {
    this.difficulty = DEFAULT_DIFFICULTY;
    const cx = this.scale.width / 2;
    this.cameras.main.setBackgroundColor(PALETTE.grassBase);
    this.add.text(cx, 110, 'Husky Simulator', { fontSize: '48px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(cx, 170, 'Escape the yard. Gather treats. Beat the rival.', { fontSize: '18px', color: '#ffffff' }).setOrigin(0.5);

    // Difficulty selector — highlighted option is the active choice, passed to
    // the Game scene on Start. Driven off the difficulty registry so new levels
    // appear here automatically.
    this.add.text(cx, 250, 'Difficulty', { fontSize: '20px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
    const levels = Object.keys(DIFFICULTIES) as Difficulty[];
    const cells = new Map<Difficulty, Phaser.GameObjects.Text>();
    const refresh = () => {
      for (const [key, t] of cells) {
        const active = key === this.difficulty;
        t.setColor(active ? '#3a2f22' : PALETTE.hudText);
        t.setBackgroundColor(active ? '#ffd27f' : PALETTE.hudBg);
      }
    };
    const span = 150;
    const startX = cx - ((levels.length - 1) * span) / 2;
    levels.forEach((key, i) => {
      const label = key.charAt(0).toUpperCase() + key.slice(1);
      const t = this.add.text(startX + i * span, 292, label, {
        fontSize: '22px', color: PALETTE.hudText, backgroundColor: PALETTE.hudBg,
        padding: { x: 22, y: 8 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true });
      t.on('pointerover', () => { if (key !== this.difficulty) t.setColor('#ffd27f'); });
      t.on('pointerout', () => refresh());
      t.on('pointerdown', () => { this.difficulty = key; refresh(); });
      cells.set(key, t);
    });
    refresh();

    const btn = (y: number, label: string, fn: () => void) => {
      const t = this.add.text(cx, y, label, { fontSize: '28px', color: PALETTE.hudText, backgroundColor: PALETTE.hudBg, padding: { x: 20, y: 10 } })
        .setOrigin(0.5).setInteractive({ useHandCursor: true });
      t.on('pointerover', () => t.setColor('#ffd27f'));
      t.on('pointerout', () => t.setColor(PALETTE.hudText));
      t.on('pointerdown', fn);
    };
    btn(370, 'Start', () => { this.scene.start('Game', { difficulty: this.difficulty }); });
    btn(440, 'How to Play', () => { this.scene.start('Instructions'); });
    btn(510, 'Credits', () => { this.scene.start('Instructions'); }); // credits shown on instructions page footer
  }
}
