import Phaser from 'phaser';
import mapCsv from '../data/map.csv?raw';
import { parseMap, type GameMap } from '../world/MapParser';
import { Grid } from '../world/Grid';
import { GRID, SIM_HZ, GAME_SECONDS, TICKS_PER_SECOND } from '../config/constants';
import type { Tile } from '../world/tiles';
import { Husky } from '../entities/Husky';
import { Chihuahua } from '../entities/Chihuahua';
import { ResourceSystem } from '../systems/ResourceSystem';
import { WorldActions } from '../systems/WorldActions';
import { AISystem } from '../systems/AISystem';
import { OwnerRegistry, dispenseOverMap } from '../systems/OwnerRegistry';
import { createBadges, updateBadges, type Badge } from '../ui/HouseholdProfile';
import type { Direction } from '../types';
import type { Food } from '../entities/Food';

export class GameScene extends Phaser.Scene {
  private map!: GameMap;
  grid!: Grid;
  private tileSprites: Phaser.GameObjects.Image[][] = [];

  husky!: Husky;
  private huskySprite!: Phaser.GameObjects.Image;
  chihuahua!: Chihuahua;
  private chiSprite!: Phaser.GameObjects.Image;
  private chiMoving = false;
  private chiCounter = 0;
  private ownerRegistry!: OwnerRegistry;
  private held: Record<Direction, boolean> = { up: false, down: false, left: false, right: false };
  private moving = false;
  private acc = 0;
  private readonly step = 1000 / SIM_HZ;
  private action: 'drink' | 'poop' | 'pee' | 'trick' | null = null;
  private foods: Food[] = [];
  private foodSprites = new Map<string, Phaser.GameObjects.Image>();
  private secondsLeft = GAME_SECONDS;
  private tickInSecond = 0;
  private over = false;
  private badges: Badge[] = [];
  private badgeTickCounter = 0;

  constructor() { super('Game'); }

  create() {
    // Reset ALL per-run state up front. Phaser's scene.start() re-runs create()
    // but does NOT reset class fields to their declared initial values, so every
    // mutable field touched during a run must be explicitly reassigned here.
    this.ownerRegistry = new OwnerRegistry();
    this.held = { up: false, down: false, left: false, right: false };
    this.moving = false;
    this.chiMoving = false;
    this.chiCounter = 0;
    this.acc = 0;
    this.action = null;
    this.foods = [];
    this.foodSprites = new Map();
    this.secondsLeft = GAME_SECONDS;
    this.tickInSecond = 0;
    this.over = false;
    this.badges = [];
    this.badgeTickCounter = 0;
    this.tileSprites = [];

    this.map = parseMap(mapCsv);
    this.grid = new Grid(this.map);
    this.renderMap();

    this.husky = new Husky();
    const p = this.grid.tileToPixel(this.husky.tile);
    this.huskySprite = this.add.image(p.x, p.y, 'husky-left-0').setDepth(10);

    this.chihuahua = new Chihuahua({ col: 2, row: 2 });
    const cp = this.grid.tileToPixel(this.chihuahua.tile);
    this.chiSprite = this.add.image(cp.x, cp.y, 'chi-right-0').setDepth(9);

    this.bindInput();

    this.badges = createBadges(this, this.map, this.ownerRegistry, this.grid);

    this.scene.launch('UI');
  }

  getHudState() {
    const t = this.currentTile();
    return {
      food: this.husky.inv.food, water: this.husky.inv.water,
      poop: this.husky.inv.poop, pee: this.husky.inv.pee,
      secondsLeft: this.secondsLeft,
      huskyTreats: this.husky.treatsEaten, chiTreats: this.chihuahua.treatsEaten,
      currentTile: { heat: t.heat, dirt: t.dirt, destruction: t.destruction, ownerId: t.ownerId },
    };
  }

  getOwnerInfo(id: number) {
    const o = this.ownerRegistry.get(id);
    return { name: o.name, sensitivity: o.sensitivity, affection: o.affection };
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
    if (this.over) return;

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

    if (tile.type === 'grass') this.tileSprites[tile.row][tile.col].setTint(this.grassColor(tile));

    this.badgeTickCounter = (this.badgeTickCounter + 1) % 5;
    if (this.badgeTickCounter === 0) updateBadges(this.badges, this.ownerRegistry);

    // 4) food dispensing
    dispenseOverMap(this.map, this.ownerRegistry, Math.random, (food) => {
      this.foods.push(food);
      const p = this.grid.tileToPixel(food.tile);
      const spr = this.add.image(p.x, p.y, food.type).setDepth(8);
      this.foodSprites.set(this.fkey(food.tile.col, food.tile.row), spr);
    });

    // 5) chihuahua AI (steps every 2nd sim tick)
    this.chiCounter = (this.chiCounter + 1) % 2;
    if (this.chiCounter === 0 && !this.chiMoving) {
      const dir = AISystem.nextStep(this.grid, this.chihuahua.tile, this.foods);
      if (dir) {
        this.chihuahua.facing = dir;
        const to = this.grid.neighbor(this.chihuahua.tile, dir);
        this.chihuahua.tile = to;
        this.chiMoving = true;
        const cp = this.grid.tileToPixel(to);
        this.tweens.add({
          targets: this.chiSprite, x: cp.x, y: cp.y, duration: this.step * 2,
          onComplete: () => { this.chiMoving = false; this.chiEat(); },
        });
      }
    }
    this.chiSprite.setTexture(`chi-${this.chihuahua.facing}-${Math.floor(performance.now() / 160) % 2}`);

    // 6) sim-time / game-over
    this.tickInSecond = (this.tickInSecond + 1) % TICKS_PER_SECOND;
    if (this.tickInSecond === 0) {
      this.secondsLeft -= 1;
      if (this.secondsLeft <= 0) { this.endGame('Time'); return; }
    }
    const go = ResourceSystem.isGameOver(this.husky.inv);
    if (go) { this.endGame(go); return; }
  }

  private endGame(reason: 'Time' | 'Food' | 'Water') {
    this.over = true;
    this.scene.stop('UI');
    this.scene.start('GameOver', {
      reason,
      huskyTreats: this.husky.treatsEaten,
      chiTreats: this.chihuahua.treatsEaten,
    });
  }

  private chiEat() {
    const idx = this.foods.findIndex(
      (f) => f.tile.col === this.chihuahua.tile.col && f.tile.row === this.chihuahua.tile.row,
    );
    if (idx !== -1) {
      const food = this.foods.splice(idx, 1)[0];
      this.chihuahua.treatsEaten += 1;
      this.map.tiles[food.tile.row][food.tile.col].foodPresent = false;
      const key = this.fkey(food.tile.col, food.tile.row);
      this.foodSprites.get(key)?.destroy();
      this.foodSprites.delete(key);
    }
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
