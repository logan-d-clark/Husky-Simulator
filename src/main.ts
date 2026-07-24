import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { GameOverScene } from './scenes/GameOverScene';
import { InstructionsScene } from './scenes/InstructionsScene';

export const DESIGN_WIDTH = 1344;   // 48 cols * 28px
export const DESIGN_HEIGHT = 728;   // 26 rows * 28px

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1a1a1a',
  width: DESIGN_WIDTH,
  height: DESIGN_HEIGHT + 140,      // + HUD strip
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, PreloadScene, MenuScene, InstructionsScene, GameScene, UIScene, GameOverScene],
});
