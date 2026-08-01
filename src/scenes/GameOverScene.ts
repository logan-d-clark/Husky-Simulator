import Phaser from 'phaser';
import { PALETTE } from '../config/palette';
import { HUSKY_NAME, CHI_NAME } from '../config/names';

interface Gmeta { reason: 'Time' | 'Food' | 'Water'; huskyTreats: number; chiTreats: number; }

export class GameOverScene extends Phaser.Scene {
  private meta!: Gmeta;
  constructor() { super('GameOver'); }
  init(data: Gmeta) { this.meta = data; }
  create() {
    const cx = this.scale.width / 2;
    this.cameras.main.setBackgroundColor(PALETTE.hudBg);
    const reasonText: Record<Gmeta['reason'], string> = {
      Time: 'Your owner came home!', Food: 'You ran out of food!', Water: 'You ran out of water!',
    };
    this.add.text(cx, 140, 'Game Over', { fontSize: '48px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(cx, 210, reasonText[this.meta.reason], { fontSize: '24px', color: '#ffffff' }).setOrigin(0.5);
    const won = this.meta.huskyTreats >= this.meta.chiTreats;
    this.add.text(cx, 290, `${HUSKY_NAME} gathered ${this.meta.huskyTreats} treats`, { fontSize: '26px', color: '#ffffff' }).setOrigin(0.5);
    this.add.text(cx, 330, `${CHI_NAME} got ${this.meta.chiTreats}`, { fontSize: '20px', color: '#dddddd' }).setOrigin(0.5);
    this.add.text(cx, 380, won ? `${HUSKY_NAME} wins! 🏆` : `${CHI_NAME} won this time…`, { fontSize: '28px', color: won ? '#ffd27f' : '#ff8a8a' }).setOrigin(0.5);
    const btn = (y: number, label: string, fn: () => void) => {
      const t = this.add.text(cx, y, label, { fontSize: '26px', color: PALETTE.hudText, backgroundColor: PALETTE.grassBase, padding: { x: 18, y: 8 } })
        .setOrigin(0.5).setInteractive({ useHandCursor: true });
      t.on('pointerdown', fn);
    };
    btn(460, 'Play Again', () => { this.scene.start('Game'); });
    btn(520, 'Main Menu', () => { this.scene.start('Menu'); });
  }
}
