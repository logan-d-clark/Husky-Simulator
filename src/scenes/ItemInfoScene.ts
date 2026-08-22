import Phaser from 'phaser';
import { ITEMS, type ItemType } from '../entities/Item';
import { drawPanel } from '../ui/panel';

interface InfoData {
  type: ItemType;
  resume: () => void;
}

// The first time Blizzard picks up each item, the round stops and this explains
// it. A Phaser overlay rather than a DOM panel: the canvas is Scale.FIT, so a
// DOM panel would have to track the canvas transform to stay put.
//
// It owns the resume callback rather than resuming Game/UI itself, so there is
// exactly one place that knows which scenes were paused — a half-resume here
// would soft-lock the round. The panel's drawing and its (subtle) dismissal
// rules live in ui/panel.ts, shared with the tutorial's panels.
export class ItemInfoScene extends Phaser.Scene {
  private info!: InfoData; // not `data` — Phaser.Scene already owns that name
  constructor() {
    super('ItemInfo');
  }
  init(data: InfoData) {
    this.info = data;
  }

  create() {
    const item = ITEMS[this.info.type];
    drawPanel(this, {
      kicker: 'NEW ITEM',
      iconKey: this.info.type,
      title: item.name,
      body: item.blurb,
      footer: `Press  ${item.key}  to use it`,
      hint: 'click or press any key to continue',
      onDismiss: this.info.resume,
    });
  }
}
