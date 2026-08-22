import Phaser from 'phaser';
import { drawPanel } from '../ui/panel';

interface PanelData {
  title: string;
  body: string;
  footer?: string;
  resume: () => void;
}

// The tutorial's modals: a coaching panel when the player makes a mistake worth
// explaining, and the closing summary. Same card and same dismissal rules as the
// item explainer, via ui/panel.ts.
//
// Like ItemInfoScene it never resumes Game/UI itself — the caller hands it a
// `resume` closure, so exactly one place knows which scenes were paused.
export class TutorialPanelScene extends Phaser.Scene {
  private info!: PanelData;
  constructor() {
    super('TutorialPanel');
  }
  init(data: PanelData) {
    this.info = data;
  }

  create() {
    drawPanel(this, {
      kicker: 'TUTORIAL',
      title: this.info.title,
      body: this.info.body,
      hint: this.info.footer ?? 'click or press any key to continue',
      onDismiss: this.info.resume,
    });
  }
}
