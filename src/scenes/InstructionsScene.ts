import Phaser from 'phaser';
import { PALETTE } from '../config/palette';

export class InstructionsScene extends Phaser.Scene {
  constructor() {
    super('Instructions');
  }
  create() {
    const cx = this.scale.width / 2;
    this.cameras.main.setBackgroundColor(PALETTE.hudBg);
    this.add
      .text(cx, 80, 'How to Play', { fontSize: '40px', color: '#ffffff', fontStyle: 'bold' })
      .setOrigin(0.5);
    const lines = [
      'You are a husky loose in the neighborhood on a hot day.',
      'Gather as many treats as you can before your owner gets home (timer).',
      '',
      'WASD — move (burns food + water; pavement bakes off water fastest)',
      "Q — drink at water tiles (Q for quench)     E — do a trick (raises a yard's affection)",
      'C — poop (crap)     Z — pee (the noise it makes)   (lowers affection; sensitive yards drop faster)',
      '',
      'High-affection yards drop more — and bowls/bags, not just treats.',
      'Watch out: a rival chihuahua is snatching treats too!',
      '',
      'Credits: Original game by Logan. Modernized 2026.',
    ];
    this.add
      .text(cx, 300, lines.join('\n'), {
        fontSize: '18px',
        color: '#ffffff',
        align: 'center',
        lineSpacing: 6,
      })
      .setOrigin(0.5);
    const back = this.add
      .text(cx, 620, 'Back', {
        fontSize: '26px',
        color: PALETTE.hudText,
        backgroundColor: PALETTE.grassBase,
        padding: { x: 18, y: 8 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.start('Menu'));
  }
}
