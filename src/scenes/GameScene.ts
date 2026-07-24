import Phaser from 'phaser';
import mapCsv from '../data/map.csv?raw';
import { parseMap, type GameMap } from '../world/MapParser';
import { Grid } from '../world/Grid';
import { GRID, SIM_HZ } from '../config/constants';
import type { Tile } from '../world/tiles';
import { Husky } from '../entities/Husky';
import { ResourceSystem } from '../systems/ResourceSystem';
import { WorldActions } from '../systems/WorldActions';
import { OwnerRegistry, dispenseOverMap } from '../systems/OwnerRegistry';
import type { Direction } from '../types';
import type { Food } from '../entities/Food';

export class GameScene extends Phaser.Scene {
  private map!: GameMap;
  grid!: Grid;
  private tileSprites: Phaser.GameObjects.Image[][] = [];

  husky!: Husky;
  private huskySprite!: Phaser.GameObjects.Image;
  private ownerRegistry = new OwnerRegistry();
  private held: Record<Direction, boolean> = { up: false, down: false, left: false, right: false };
  private moving = false;
  private acc = 0;
  private readonly step = 1000 / SIM_HZ;
  private action: 'drink' | 'poop' | 'pee' | 'trick' | null = null;
  private foods: Food[] = [];
  private foodSprites = new Map<string, Phaser.GameObjects.Image>();

  constructor() { super('Game'); }

  create() {
    this.map = parseMap(mapCsv);
    this.grid = new Grid(this.map);
    this.renderMap();

    this.husky = new Husky();
    const p = this.grid.tileToPixel(this.husky.tile);
    this.huskySprite = this.add.image(p.x, p.y, 'husky-left-0').setDepth(10);
    this.bindInput();
  }

  private bindInput() {
    const kb = this.input.keyboard!;
    const map: Record<string, Direction> = { W: 'up', S: 'down', A: 'left', D: 'right' };
    for (const [k, dir] of Object.entries(map)) {
      kb.addKey(k).on('down', () => { this.held[dir] = true; this.husky.facing = dir; });
      kb.addKey(k).on('up', () => { this.held[dir] = false; });
    }
    kb.addKey('Q').on('down', () => { this.action = 'drink'; });
    kb.addKey('Q').on('up', () => { if (this.action === 'drink') this.action = null; });
    kb.addKey('C').on('down', () => { this.action = 'poop'; });
    kb.addKey('Z').on('down', () => { this.action = 'pee'; });
    kb.addKey('E').on('down', () => { this.action = 'trick'; });
    for (const k of ['C', 'Z', 'E']) kb.addKey(k).on('up', () => { this.action = null; });
  }

  update(_t: number, delta: number) {
    this.acc += delta;
    while (this.acc >= this.step) { this.acc -= this.step; this.simTick(); }
  }

  private currentTile() { return this.map.tiles[this.husky.tile.row][this.husky.tile.col]; }

  private simTick() {
    // 1) movement
    const dir = (['up', 'down', 'left', 'right'] as Direction[]).find((d) => this.held[d]);
    if (dir && !this.moving && this.grid.canMove(this.husky.tile, dir)) {
      const to = this.grid.neighbor(this.husky.tile, dir);
      this.husky.tile = to;
      ResourceSystem.applyMoveCost(this.husky.inv);
      this.moving = true;
      const p = this.grid.tileToPixel(to);
      this.tweens.add({
        targets: this.huskySprite, x: p.x, y: p.y, duration: this.step,
        onComplete: () => { this.moving = false; this.onEnterTile(); },
      });
    }
    this.huskySprite.setTexture(`husky-${this.husky.facing}-${Math.floor(performance.now() / 120) % 2}`);

    // 2) heat every tick (even standing)
    ResourceSystem.applyHeat(this.husky.inv, this.currentTile().heat);

    // 3) standing actions
    const tile = this.currentTile();
    const owner = this.ownerRegistry.get(tile.ownerId);
    if (this.action === 'poop') WorldActions.poop(this.husky, tile, owner);
    else if (this.action === 'pee') WorldActions.pee(this.husky, tile, owner);
    else if (this.action === 'trick') WorldActions.trick(this.husky, tile, owner);
    else if (this.action === 'drink' && this.nearWater()) ResourceSystem.drink(this.husky.inv);

    // 4) food dispensing
    dispenseOverMap(this.map, this.ownerRegistry, Math.random, (food) => {
      this.foods.push(food);
      const p = this.grid.tileToPixel(food.tile);
      const spr = this.add.image(p.x, p.y, food.type).setDepth(8);
      this.foodSprites.set(this.fkey(food.tile.col, food.tile.row), spr);
    });
  }

  private fkey(c: number, r: number) { return `${c},${r}`; }

  private onEnterTile() {
    const tile = this.currentTile();

    // food pickup
    const key = this.fkey(this.husky.tile.col, this.husky.tile.row);
    const idx = this.foods.findIndex(
      (f) => f.tile.col === this.husky.tile.col && f.tile.row === this.husky.tile.row,
    );
    if (idx !== -1) {
      const food = this.foods.splice(idx, 1)[0];
      ResourceSystem.eatFood(this.husky.inv, food.value);
      this.husky.treatsEaten += 1;
      this.currentTile().foodPresent = false;
      this.foodSprites.get(key)?.destroy();
      this.foodSprites.delete(key);
    }

    WorldActions.autoDump(this.husky, tile, this.ownerRegistry.get(tile.ownerId));
  }

  private nearWater(): boolean {
    const { col, row } = this.husky.tile;
    for (const [dc, dr] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const t = this.grid.tileAt(col + dc, row + dr);
      if (t && t.type === 'water') return true;
    }
    return false;
  }

  private renderMap() {
    const T = GRID.TILE;
    for (let r = 0; r < this.map.rows; r++) {
      this.tileSprites[r] = [];
      for (let c = 0; c < this.map.cols; c++) {
        const tile = this.map.tiles[r][c];
        const key = tile.type; // 'grass'|'pavement'|'house'|'water' match texture keys
        const img = this.add.image(c * T, r * T, key).setOrigin(0, 0);
        if (tile.type === 'grass') img.setTint(this.grassColor(tile));
        this.tileSprites[r][c] = img;
        this.drawFences(tile);
      }
    }
  }

  private drawFences(tile: Tile) {
    const T = GRID.TILE;
    const x = tile.col * T, y = tile.row * T;
    if (tile.fences.top) this.add.image(x, y, 'fenceH').setOrigin(0, 0).setDepth(5);
    if (tile.fences.bottom) this.add.image(x, y + T - 4, 'fenceH').setOrigin(0, 0).setDepth(5);
    if (tile.fences.left) this.add.image(x, y, 'fenceV').setOrigin(0, 0).setDepth(5);
    if (tile.fences.right) this.add.image(x + T - 4, y, 'fenceV').setOrigin(0, 0).setDepth(5);
  }

  // Maps dirt (poop) + destruction (pee) to a tint, reproducing V1's GRASS_COLORS matrix intent.
  grassColor(tile: Tile): number {
    const dirt = tile.dirt, dest = tile.destruction;
    const destLevel = dest === 0 ? 0 : dest < 50 ? 1 : 2;
    const dirtLevel = dirt === 0 ? 0 : dirt < 50 ? 1 : 2;
    const MATRIX = [
      [0x6aa84f, 0x8a9a3c, 0xb0a536],
      [0x9a8d3c, 0x8f8a2e, 0x9c8a2e],
      [0xb08d3c, 0xa9922b, 0xc9a24b],
    ];
    return MATRIX[destLevel][dirtLevel];
  }
}
