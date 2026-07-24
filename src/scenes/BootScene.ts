import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  create() {
    this.add.text(20, 20, 'Husky Simulator booting…', { color: '#ffffff' });
  }
}
