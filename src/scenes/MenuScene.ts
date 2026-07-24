import Phaser from 'phaser';
import { PALETTE } from '../config/palette';

export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }
  create() {
    const cx = this.scale.width / 2;
    this.cameras.main.setBackgroundColor(PALETTE.grassBase);
    this.add.text(cx, 120, 'Husky Simulator', { fontSize: '48px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(cx, 180, 'Escape the yard. Gather treats. Beat the rival.', { fontSize: '18px', color: '#ffffff' }).setOrigin(0.5);
    const btn = (y: number, label: string, fn: () => void) => {
      const t = this.add.text(cx, y, label, { fontSize: '28px', color: PALETTE.hudText, backgroundColor: PALETTE.hudBg, padding: { x: 20, y: 10 } })
        .setOrigin(0.5).setInteractive({ useHandCursor: true });
      t.on('pointerover', () => t.setColor('#ffd27f'));
      t.on('pointerout', () => t.setColor(PALETTE.hudText));
      t.on('pointerdown', fn);
    };
    btn(300, 'Start', () => { this.scene.start('Game'); });
    btn(370, 'How to Play', () => { this.scene.start('Instructions'); });
    btn(440, 'Credits', () => { this.scene.start('Instructions'); }); // credits shown on instructions page footer
  }
}
