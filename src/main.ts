import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { GameOverScene } from './scenes/GameOverScene';
import { InstructionsScene } from './scenes/InstructionsScene';
import { DESIGN_WIDTH, DESIGN_HEIGHT } from './config/constants';
import { HUD_H } from './scenes/UIScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1a1a1a',
  width: DESIGN_WIDTH,
  height: DESIGN_HEIGHT + HUD_H,      // + HUD strip
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene, PreloadScene, MenuScene, InstructionsScene, GameScene, UIScene, GameOverScene],
});
