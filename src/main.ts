import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { GameOverScene } from './scenes/GameOverScene';
import { ItemInfoScene } from './scenes/ItemInfoScene';
import { TutorialPanelScene } from './scenes/TutorialPanelScene';
import { InstructionsScene } from './scenes/InstructionsScene';
import { DESIGN_WIDTH, DESIGN_HEIGHT } from './config/constants';
import { audio } from './audio/AudioEngine';
import { HUD_H } from './scenes/UIScene';

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1a1a1a',
  width: DESIGN_WIDTH,
  height: DESIGN_HEIGHT + HUD_H, // + HUD strip
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [
    BootScene,
    PreloadScene,
    MenuScene,
    InstructionsScene,
    GameScene,
    UIScene,
    GameOverScene,
    ItemInfoScene,
    TutorialPanelScene,
  ],
});

// Debug handles: expose the running game and audio engine for console/automation
// inspection.
(window as unknown as { game: Phaser.Game }).game = game;
(window as unknown as { audio: typeof audio }).audio = audio;
