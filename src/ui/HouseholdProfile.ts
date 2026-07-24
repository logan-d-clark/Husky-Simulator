import Phaser from 'phaser';
import { PALETTE } from '../config/palette';
import { yardCentroid, type OwnerRegistry } from '../systems/OwnerRegistry';
import type { GameMap } from '../world/MapParser';
import type { Grid } from '../world/Grid';

export interface Badge { ownerId: number; label: Phaser.GameObjects.Text; meter: Phaser.GameObjects.Graphics; x: number; y: number; }

export function createBadges(scene: Phaser.Scene, map: GameMap, reg: OwnerRegistry, grid: Grid): Badge[] {
  const badges: Badge[] = [];
  for (const owner of reg.all()) {
    if (owner.id === 0) continue;
    const c = yardCentroid(map, owner.id);
    if (!c) continue;
    const p = grid.tileToPixel(c);
    const label = scene.add.text(p.x, p.y - 8, owner.name, { color: '#ffffff', fontSize: '10px' })
      .setOrigin(0.5).setDepth(15);
    const meter = scene.add.graphics().setDepth(15);
    badges.push({ ownerId: owner.id, label, meter, x: p.x, y: p.y + 6 });
  }
  return badges;
}

export function updateBadges(badges: Badge[], reg: OwnerRegistry): void {
  for (const b of badges) {
    const a = reg.get(b.ownerId).affection;
    b.meter.clear();
    b.meter.fillStyle(0x000000, 0.4).fillRect(b.x - 16, b.y, 32, 4);
    b.meter.fillStyle(Phaser.Display.Color.HexStringToColor(PALETTE.affection).color, 1)
      .fillRect(b.x - 16, b.y, Math.max(0, Math.min(1, a / 100)) * 32, 4);
  }
}
