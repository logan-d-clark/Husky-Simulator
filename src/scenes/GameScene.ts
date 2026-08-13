import Phaser from 'phaser';
import mapCsv from '../data/map.csv?raw';
import { parseMap, type GameMap } from '../world/MapParser';
import { Grid } from '../world/Grid';
import { GRID, SIM_HZ, TICKS_PER_SECOND, GATE_TILES, CHI_START_TILE } from '../config/constants';
import { setGate, advanceGateSeconds } from '../world/gate';
import { ITEMS, ITEM_TYPES, type ItemType } from '../entities/Item';
import {
  emptyCounts, itemDropChance, randomItemType,
  grant, consume, repellerBlocks, milestonesToGrant, nextTutorial, tickRepellers,
  type ItemCounts, type Repeller,
} from '../systems/ItemSystem';
import { config } from '../config/gameConfig';
import type { Tile } from '../world/tiles';
import { Husky } from '../entities/Husky';
import { Chihuahua } from '../entities/Chihuahua';
import { ResourceSystem } from '../systems/ResourceSystem';
import { WorldActions } from '../systems/WorldActions';
import { nextBanditMove, banditTweenDuration, isWaterAdjacent, firstReachableRelieveTarget, banditGoalLabel, bestFoodAnywhere, bfsFirstStep, type RelieveTarget } from '../systems/AISystem';
import { OwnerRegistry, dispenseOverMap, buildRelieveTargets } from '../systems/OwnerRegistry';
import { BanditController, type BanditTickInput } from '../systems/BanditController';
import { createBadges, updateBadges, type Badge } from '../ui/HouseholdProfile';
import type { Direction, TileCoord } from '../types';
import { takeFoodAt, type Food } from '../entities/Food';
import { getDifficultySettings, banditDelaySeconds, DEFAULT_DIFFICULTY, type Difficulty } from '../config/difficulty';
import { attachDevPanel } from '../ui/DevPanel';
import { assignHouseFaces } from '../world/houseFacades';
import { audio } from '../audio/AudioEngine';
import { eatCue, cueForBanditGoal } from '../audio/cues';
import { WarningTracker, risingEdges } from '../audio/triggers';
import type { BanditGoal } from '../systems/AISystem';
import { computeFov } from '../world/fov';

export class GameScene extends Phaser.Scene {
  private map!: GameMap;
  grid!: Grid;
  private tileSprites: Phaser.GameObjects.Image[][] = [];

  husky!: Husky;
  private huskySprite!: Phaser.GameObjects.Image;
  chihuahua!: Chihuahua;
  private chiSprite!: Phaser.GameObjects.Image;
  private chiMoving = false;
  private chiSpeedMultiplier = getDifficultySettings(DEFAULT_DIFFICULTY).chiSpeedMultiplier;
  private banditController = new BanditController();
  private devMode = false;
  private difficulty: Difficulty = DEFAULT_DIFFICULTY;
  private fogOfWar = false;
  private fovSet: Set<string> | null = null; // Blizzlord field-of-view; null = full visibility
  private ownerRegistry!: OwnerRegistry;
  private held: Record<Direction, boolean> = { up: false, down: false, left: false, right: false };
  private moving = false;
  private acc = 0;
  private readonly step = 1000 / SIM_HZ;
  private action: 'drink' | 'poop' | 'pee' | 'trick' | null = null;
  // Audio state. Action cues fire on the rising edge of an action *applying*, so
  // holding a key gives one sound rather than ten a second; Bandit's cue fires
  // on a mode change, not per tick.
  private warnings = new WarningTracker();
  private actionsApplied: Record<'poop' | 'pee' | 'trick' | 'drink', boolean> =
    { poop: false, pee: false, trick: false, drink: false };
  private lastBanditGoal: BanditGoal = 'treat';
  // Bandit starts the round penned behind the Grumbles' driveway gate. Tinted
  // apart from the ordinary fences so the player reads it as a thing that opens.
  private static readonly GATE_TINT = 0xd98a3d;
  private gateSprites: Phaser.GameObjects.Image[] = [];
  private gateSecondsLeft = 0;
  private gateTickInSecond = 0;

  // --- items ---------------------------------------------------------------
  private items: ItemCounts = emptyCounts();
  private itemPickups: { type: ItemType; tile: TileCoord; sprite: Phaser.GameObjects.Image }[] = [];
  private seenItems = new Set<ItemType>();       // which tutorials have shown this round
  private tutorialQueue: ItemType[] = [];
  private tutorialShowing = false;
  private milestonesPaid = 0;                    // highest 1000-food milestone already granted
  private rawhide: { tile: TileCoord; secondsLeft: number; sprite: Phaser.GameObjects.Image } | null = null;
  private repellers: (Repeller & { sprite: Phaser.GameObjects.Image; ring: Phaser.GameObjects.Graphics; label: Phaser.GameObjects.Text })[] = [];
  private zoomSecondsLeft = 0;
  private itemTickInSecond = 0;
  private foods: Food[] = [];
  private foodSprites = new Map<string, Phaser.GameObjects.Image>();
  private secondsLeft = config.GAME_SECONDS;
  private tickInSecond = 0;
  private over = false;
  private badges: Badge[] = [];
  private badgeTickCounter = 0;

  constructor() { super('Game'); }

  // Phaser runs init(data) before create() on every scene.start, so the
  // difficulty chosen on the menu is resolved here (default Normal if absent).
  init(data?: { difficulty?: Difficulty; devMode?: boolean }) {
    this.difficulty = data?.difficulty ?? DEFAULT_DIFFICULTY;
    const settings = getDifficultySettings(this.difficulty);
    this.chiSpeedMultiplier = settings.chiSpeedMultiplier;
    this.fogOfWar = settings.fogOfWar;
    this.devMode = data?.devMode ?? false;
  }

  // Dev "Restart Game": reboot the round from scratch (fresh map, scores, and
  // positions), keeping the current difficulty and dev mode. Tuned config and
  // saved profiles persist (they live outside the scene).
  private restartGame() {
    this.scene.stop('UI');
    this.scene.restart({ difficulty: this.difficulty, devMode: true });
  }

  create() {
    // Reset ALL per-run state up front. Phaser's scene.start() re-runs create()
    // but does NOT reset class fields to their declared initial values, so every
    // mutable field touched during a run must be explicitly reassigned here.
    this.ownerRegistry = new OwnerRegistry();
    this.held = { up: false, down: false, left: false, right: false };
    this.moving = false;
    this.chiMoving = false;
    this.acc = 0;
    this.action = null;
    this.warnings = new WarningTracker();          // a fresh round re-arms every warning
    this.actionsApplied = { poop: false, pee: false, trick: false, drink: false };
    // Bandit's brain is per-run state too. Without this, "Play Again" after a
    // round that ended mid-relief resumes that episode — still committed to a
    // yard id from the previous round's registry — and immediately fires the
    // relief cue for a transition that never happened.
    this.banditController = new BanditController();
    this.lastBanditGoal = 'treat';
    this.foods = [];
    this.foodSprites = new Map();
    this.secondsLeft = config.GAME_SECONDS;
    this.tickInSecond = 0;
    this.over = false;
    this.badges = [];
    this.badgeTickCounter = 0;
    this.tileSprites = [];
    this.fovSet = null;
    this.gateSprites = [];
    this.gateSecondsLeft = banditDelaySeconds(this.difficulty);
    this.gateTickInSecond = 0;
    // Items are per-run state too — Phaser does not reset class fields.
    this.items = emptyCounts();
    this.itemPickups = [];
    this.seenItems = new Set();
    this.tutorialQueue = [];
    this.tutorialShowing = false;
    this.milestonesPaid = 0;
    this.rawhide = null;
    this.repellers = [];
    this.zoomSecondsLeft = 0;
    this.itemTickInSecond = 0;

    this.map = parseMap(mapCsv);
    this.grid = new Grid(this.map);
    this.renderMap();
    // Shut the gate AFTER renderMap: drawFences runs once and keeps no
    // references, so a gate drawn by it could never be removed.
    this.shutGate();

    this.husky = new Husky();
    const p = this.grid.tileToPixel(this.husky.tile);
    this.huskySprite = this.add.image(p.x, p.y, 'husky-left-0').setDepth(10);

    this.chihuahua = new Chihuahua({ ...CHI_START_TILE });
    const cp = this.grid.tileToPixel(this.chihuahua.tile);
    this.chiSprite = this.add.image(cp.x, cp.y, 'chi-right-0').setDepth(9);

    this.bindInput();

    this.badges = createBadges(this, this.map, this.ownerRegistry, this.grid);

    this.scene.launch('UI');

    // Blizzlord: reveal only Blizzard's field of view.
    if (this.fogOfWar) this.applyFov();

    // Dev mode: live config panel (backtick-toggled, self-teardown on shutdown).
    if (this.devMode) attachDevPanel(this, { onRestart: () => this.restartGame() });

    // Phaser resets its keys on scene pause WITHOUT emitting keyup, and drops
    // any real keyup that arrives while paused. Both of this scene's input
    // latches would survive a tutorial pause — so releasing the key you walked
    // in on would leave Blizzard sprinting, or fouling, after the panel closes.
    this.events.on(Phaser.Scenes.Events.RESUME, () => {
      this.held = { up: false, down: false, left: false, right: false };
      this.action = null;
    });

    // The context was already unlocked by the menu's Start click; resume() here
    // is a no-op safety net for entering the scene by any other route.
    audio.resume();
    audio.startMusic();
  }

  // Recompute Blizzard's field of view and reflect it: grey out-of-sight tiles,
  // and hide any food/Bandit standing in the dark. Blizzlord only.
  private applyFov() {
    const fov = computeFov(this.map, this.husky.tile);
    this.fovSet = fov;
    for (let r = 0; r < this.map.rows; r++) {
      for (let c = 0; c < this.map.cols; c++) {
        const t = this.map.tiles[r][c];
        const spr = this.tileSprites[r][c];
        if (fov.has(`${c},${r}`)) spr.setTint(t.type === 'grass' ? this.grassColor(t) : 0xffffff);
        else spr.setTint(0x3a3a3a);
      }
    }
    for (const [key, spr] of this.foodSprites) spr.setVisible(fov.has(key));
    // Item pickups hide in the dark like food does. Without this an item dropped
    // out of sight stays invisible forever (granted from nowhere when he walks
    // over it), and one dropped in sight shows through the fog for the rest of
    // the round.
    for (const i of this.itemPickups) i.sprite.setVisible(fov.has(this.fkey(i.tile.col, i.tile.row)));
    this.chiSprite.setVisible(fov.has(`${this.chihuahua.tile.col},${this.chihuahua.tile.row}`));
  }

  getHudState() {
    const t = this.currentTile();
    return {
      food: this.husky.inv.food, water: this.husky.inv.water,
      poop: this.husky.inv.poop, pee: this.husky.inv.pee,
      secondsLeft: this.secondsLeft,
      huskyFood: this.husky.inv.food, chiFood: this.chihuahua.inv.food,
      chiWater: this.chihuahua.inv.water, chiPoop: this.chihuahua.inv.poop, chiPee: this.chihuahua.inv.pee,
      chiGoalLabel: banditGoalLabel(this.banditController.currentGoal(), this.banditController.activeChannel()),
      items: { ...this.items },
      currentTile: { heat: t.heat, dirt: t.dirt, destruction: t.destruction, ownerId: t.ownerId },
    };
  }

  getOwnerInfo(id: number) {
    const o = this.ownerRegistry.get(id);
    return { name: o.name, sensitivity: o.sensitivity, affection: o.affection };
  }

  private bindInput() {
    const kb = this.input.keyboard!;
    kb.removeAllKeys(true);
    const map: Record<string, Direction> = { W: 'up', S: 'down', A: 'left', D: 'right' };
    for (const [k, dir] of Object.entries(map)) {
      kb.addKey(k).on('down', () => { this.held[dir] = true; this.husky.facing = dir; this.tryStep(); });
      kb.addKey(k).on('up', () => { this.held[dir] = false; });
    }
    kb.addKey('Q').on('down', () => { this.action = 'drink'; });
    kb.addKey('Q').on('up', () => { if (this.action === 'drink') this.action = null; });
    kb.addKey('C').on('down', () => { this.action = 'poop'; });
    kb.addKey('C').on('up', () => { if (this.action === 'poop') this.action = null; });
    kb.addKey('Z').on('down', () => { this.action = 'pee'; });
    kb.addKey('Z').on('up', () => { if (this.action === 'pee') this.action = null; });
    kb.addKey('E').on('down', () => { this.action = 'trick'; });
    kb.addKey('E').on('up', () => { if (this.action === 'trick') this.action = null; });
    kb.addKey('M').on('down', () => { audio.toggleMute(); });
    // Bind by key CODE. Phaser's addKey resolves a string through KeyCodes, and
    // KeyCodes has no '1' — the digits are ONE..FOUR — so addKey('1') silently
    // registers a key that can never fire.
    for (const type of ITEM_TYPES) {
      kb.addKey(ITEMS[type].keyCode).on('down', () => this.deployItem(type));
    }
  }

  update(_t: number, delta: number) {
    this.acc += Math.min(delta, 250);
    while (this.acc >= this.step) { this.acc -= this.step; this.simTick(); }
  }

  private currentTile() { return this.map.tiles[this.husky.tile.row][this.husky.tile.col]; }

  // Advance one tile if a direction key is held and the path is clear. Called
  // on keydown (immediate start from rest), from each sim tick (safety-net
  // kick), and from each tween's onComplete (to chain steps into continuous
  // motion while the key stays held). The `moving` guard makes overlapping
  // calls no-ops, so a tile's move cost is applied exactly once per step.
  private tryStep() {
    if (this.over || this.moving) return;
    const zooming = this.zoomSecondsLeft > 0;
    // Zoomies: the player is off the wheel. He drives himself with the SAME
    // omniscient chain Bandit uses — reused, not reimplemented — so there is
    // only one "find the best food and head for it" to keep correct.
    const dir = zooming
      ? this.zoomDirection()
      : (['up', 'down', 'left', 'right'] as Direction[]).find((d) => this.held[d]);
    if (!dir || !this.grid.canMove(this.husky.tile, dir)) return;
    this.husky.facing = dir;
    const to = this.grid.neighbor(this.husky.tile, dir);
    this.husky.tile = to;
    if (!zooming) ResourceSystem.applyMoveCost(this.husky.inv); // the chew is free while it lasts
    this.moving = true;
    this.advanceEntity(this.huskySprite, to, zooming ? this.step / config.ZOOM_SPEED_MULTIPLIER : this.step, () => {
      this.moving = false; this.onEnterTile(); this.tryStep();
    });
  }

  private zoomDirection(): Direction | undefined {
    const food = bestFoodAnywhere(this.husky.tile, this.foods);
    if (!food) { this.zoomSecondsLeft = 0; return undefined; } // map is bare: hand control back early
    return bfsFirstStep(this.grid, this.husky.tile, (t) => t.col === food.tile.col && t.row === food.tile.row) ?? undefined;
  }

  // Chihuahua step: pathfind one tile toward the nearest treat and glide there,
  // chaining on arrival for continuous smooth motion (mirrors the husky). Speed
  // is difficulty-driven via chiSpeedMultiplier. Called from each sim tick as a
  // safety-net kick when idle (e.g. once new food appears), and from its own
  // onArrive to sustain the glide.
  // Per-tick Bandit update: run his commitment state machine; while committed he
  // holds still (static frame) and any yard he fouls is re-tinted so the mess is
  // visible even when Blizzard isn't there; otherwise he glides via tryChiStep.
  private banditInput(): BanditTickInput {
    const tile = this.map.tiles[this.chihuahua.tile.row][this.chihuahua.tile.col];
    return {
      inv: this.chihuahua.inv,
      tile,
      owner: this.ownerRegistry.get(tile.ownerId),
      waterAdjacent: isWaterAdjacent(this.grid, this.chihuahua.tile),
      rawhide: this.rawhideState(),
    };
  }

  // Bandit's relieve context this tick: the available relieve-target tiles and
  // whether he's standing on the yard this episode is committed to. Empty/false
  // outside relief mode. Also records the yard the AI settled on, so the episode
  // stays on it even as his own fouling drops that owner's affection.
  private chiRelieveContext(): { relieveTargets: RelieveTarget[]; onTargetYard: boolean } {
    if (this.banditController.currentGoal() !== 'relief') return { relieveTargets: [], onTargetYard: false };
    const relieveTargets = buildRelieveTargets(
      this.map, this.ownerRegistry, this.chihuahua.inv, this.banditController.activeChannel(),
    );
    const target = firstReachableRelieveTarget(
      this.grid, this.chihuahua.tile, relieveTargets, this.banditController.committedYard(),
    );
    if (!target) return { relieveTargets, onTargetYard: false };
    this.banditController.commitYard(target.ownerId);
    const here = this.map.tiles[this.chihuahua.tile.row][this.chihuahua.tile.col];
    return { relieveTargets, onTargetYard: here.ownerId === target.ownerId };
  }

  private updateBandit() {
    const input = this.banditInput();
    // Context is pulled lazily, from inside tick, so it reflects the mode tick
    // just transitioned into rather than the one he was in a moment ago.
    const { suppressMove } = this.banditController.tick(input, () => this.chiRelieveContext().onTargetYard);

    // Announce a mode change once, on the transition — this is the player's only
    // warning that the rival has switched to hunting their best yard.
    const goal = this.banditController.currentGoal();
    if (goal !== this.lastBanditGoal) {
      audio.play(cueForBanditGoal(goal));
      this.lastBanditGoal = goal;
    }

    if (suppressMove) {
      this.chiSprite.setTexture(`chi-${this.chihuahua.facing}-0`); // hold a still frame
      this.retintFouledTile(input.tile);
    } else {
      this.chiSprite.setTexture(`chi-${this.chihuahua.facing}-${Math.floor(performance.now() / 160) % 2}`);
    }
    // Penned at home, his owners feed and water him: no drain while the gate is
    // shut. The pen has no water tile and the Grumbles sit at affection 0, so
    // nothing spawns there either — without this he would drain to empty and
    // latch permanently into water-seeking with nowhere to drink.
    if (!this.gateShut()) ResourceSystem.applyHeat(this.chihuahua.inv, input.tile.heat);
    if (!suppressMove) this.tryChiStep(); // held this tick? don't also re-decide movement (avoids a 1-frame still→glide)
    if (this.fovSet) {
      this.chiSprite.setVisible(this.fovSet.has(this.fkey(this.chihuahua.tile.col, this.chihuahua.tile.row)));
    }
  }

  private retintFouledTile(tile: Tile) {
    if (tile.type !== 'grass') return;
    if (this.fogOfWar && this.fovSet && !this.fovSet.has(this.fkey(tile.col, tile.row))) return;
    this.tileSprites[tile.row][tile.col].setTint(this.grassColor(tile));
  }

  private tryChiStep() {
    if (this.over || this.chiMoving) return;
    const { relieveTargets, onTargetYard } = this.chiRelieveContext();
    if (this.banditController.shouldHold(this.banditInput(), onTargetYard)) return; // committed: hold position
    const move = nextBanditMove(this.grid, this.chihuahua, this.foods, Math.random, {
      goal: this.banditController.currentGoal(),
      relieveTargets,
      committedOwnerId: this.banditController.committedYard(),
      rawhideTile: this.rawhide?.tile ?? null,
      blocked: this.banditBlocked(),
    });
    if (!move) return;
    this.chihuahua.facing = move.dir;
    const to = this.grid.neighbor(this.chihuahua.tile, move.dir);
    this.chihuahua.tile = to;
    if (!this.gateShut()) { // see updateBandit: no drain while he's penned at home
      ResourceSystem.applyMoveCost(this.chihuahua.inv); // food/water down, poop/pee up (min 0 food is fine — no death)
      this.chihuahua.inv.food = Math.max(0, this.chihuahua.inv.food);
    }
    this.chiMoving = true;
    // Patrol steps glide at half speed (2x duration); a scent/water chase runs full speed.
    const base = this.step * this.chiSpeedMultiplier;
    const dur = banditTweenDuration(base, move.mode, config.PATROL_SPEED_MULTIPLIER);
    this.advanceEntity(this.chiSprite, to, dur, () => {
      this.chiMoving = false; this.onChiEnterTile(); this.tryChiStep();
    });
  }

  // Shared per-tile movement mechanics for both entities: tween the sprite to a
  // tile's pixel center over `duration`, then fire `onArrive`. Callers own their
  // own moving-flag, direction resolution, and per-tile side effects.
  private advanceEntity(
    sprite: Phaser.GameObjects.Image,
    to: TileCoord,
    duration: number,
    onArrive: () => void,
  ) {
    const p = this.grid.tileToPixel(to);
    this.tweens.add({
      targets: sprite, x: p.x, y: p.y, duration, ease: 'Linear', onComplete: onArrive,
    });
  }

  private simTick() {
    if (this.over) return;

    // 1) movement — kick from rest; continuous tile-to-tile gliding is driven
    //    by each tween's onComplete (see tryStep), so there is no per-tile pause.
    this.tryStep();

    // 2) heat every tick (even standing)
    ResourceSystem.applyHeat(this.husky.inv, this.currentTile().heat);

    // 3) standing actions
    const tile = this.currentTile();
    const owner = this.ownerRegistry.get(tile.ownerId);
    // Standing actions, and now actually gated on standing. `action` is a latch
    // cleared only by keyup, so a missed keyup (alt-tab) — or simply holding the
    // key while running — used to foul every grass tile he crossed, at any
    // level. Only autoDump drops waste while he's on the move.
    const standing = !this.moving;
    const poopApplied = standing && this.action === 'poop' && WorldActions.poop(this.husky, tile, owner);
    const peeApplied = standing && this.action === 'pee' && WorldActions.pee(this.husky, tile, owner);
    const trickApplied = standing && this.action === 'trick' && WorldActions.trick(this.husky, tile, owner);
    const drinkApplied = standing && this.action === 'drink' && this.nearWater();
    if (drinkApplied) ResourceSystem.drink(this.husky.inv);

    // One cue per action START, then silence until he lets go and begins again.
    const applied = { poop: poopApplied, pee: peeApplied, trick: trickApplied, drink: drinkApplied };
    for (const started of risingEdges(this.actionsApplied, applied)) audio.play(started);
    this.actionsApplied = applied;
    for (const warning of this.warnings.check(this.husky.inv)) audio.play(warning);

    // texture: action pose > walk cycle (moving) > idle
    if (poopApplied) this.huskySprite.setTexture('husky-poop');
    else if (peeApplied) this.huskySprite.setTexture('husky-pee');
    else if (trickApplied) this.huskySprite.setTexture('husky-trick');
    else if (drinkApplied) this.huskySprite.setTexture('husky-idle');
    else if (this.moving) {
      this.huskySprite.setTexture(`husky-${this.husky.facing}-${Math.floor(performance.now() / 120) % 2}`);
    } else {
      this.huskySprite.setTexture('husky-idle');
    }

    if (tile.type === 'grass') this.tileSprites[tile.row][tile.col].setTint(this.grassColor(tile));

    this.badgeTickCounter = (this.badgeTickCounter + 1) % 5;
    if (this.badgeTickCounter === 0) updateBadges(this.badges, this.ownerRegistry);

    // 4) food dispensing
    dispenseOverMap(this.map, this.ownerRegistry, Math.random, (food) => {
      this.foods.push(food);
      const p = this.grid.tileToPixel(food.tile);
      const spr = this.add.image(p.x, p.y, food.type).setDepth(8);
      const fk = this.fkey(food.tile.col, food.tile.row);
      this.foodSprites.set(fk, spr);
      if (this.fovSet && !this.fovSet.has(fk)) spr.setVisible(false); // dropped out of sight
    });

    // 5) chihuahua (Bandit) AI. The controller runs his stay-put commitments
    //    (full water refill, fouling a yard); while committed he holds position
    //    and a static frame instead of gliding.
    this.updateBandit();

    // 6) sim-time / game-over. Dev mode freezes the clock and is invincible.
    // Item drops and the milestone payout run every tick.
    this.itemDropTick();
    // Item countdowns run on their own second, independent of the round clock so
    // they keep working in dev mode (the trap the gate fell into in #29).
    this.itemTickInSecond = (this.itemTickInSecond + 1) % TICKS_PER_SECOND;
    if (this.itemTickInSecond === 0) this.itemSecondTick();

    // Bandit works out the latch. The gate runs on its OWN clock, deliberately
    // outside the dev-mode freeze: dev mode stops the round timer, and nesting
    // the gate inside that would leave it shut for the whole session — killing
    // every Bandit knob the dev panel exists to tune, in the only mode that has
    // a dev panel.
    if (this.gateShut()) {
      this.gateTickInSecond = (this.gateTickInSecond + 1) % TICKS_PER_SECOND;
      if (this.gateTickInSecond === 0) {
        const next = advanceGateSeconds(this.gateSecondsLeft);
        this.gateSecondsLeft = next.secondsLeft;
        if (next.open) this.openGate();
      }
    }

    if (!this.devMode) {
      this.tickInSecond = (this.tickInSecond + 1) % TICKS_PER_SECOND;
      if (this.tickInSecond === 0) this.secondsLeft -= 1;
    }
    const end = this.devMode ? null : ResourceSystem.shouldEndGame(this.husky.inv, this.secondsLeft);
    if (end) { this.endGame(end); return; }
  }

  private endGame(reason: 'Time' | 'Food' | 'Water') {
    this.over = true;
    audio.stopMusic();
    this.scene.stop('UI');
    this.scene.start('GameOver', {
      reason,
      huskyFood: this.husky.inv.food,
      chiFood: this.chihuahua.inv.food,
      difficulty: this.difficulty, // so "Play Again" replays the same round
      devMode: this.devMode,
    });
  }

  private onChiEnterTile() {
    // Eat any food on this tile. Relieving is handled entirely by BanditController
    // (targeted at the highest-affection yard) — no autoDump, which would foul any
    // tile he passes through and bypass that targeting.
    const food = takeFoodAt(this.foods, this.chihuahua.tile.col, this.chihuahua.tile.row);
    if (food) {
      ResourceSystem.eatFood(this.chihuahua.inv, food.value);
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
    const food = takeFoodAt(this.foods, this.husky.tile.col, this.husky.tile.row);
    if (food) {
      ResourceSystem.eatFood(this.husky.inv, food.value);
      audio.playSteps(eatCue(food.value, config.TREAT_VALUE)); // richer pickup, higher pitch
      this.currentTile().foodPresent = false;
      const key = this.fkey(food.tile.col, food.tile.row);
      this.foodSprites.get(key)?.destroy();
      this.foodSprites.delete(key);
    }

    this.takeItemPickupAt(this.husky.tile); // Bandit's onChiEnterTile deliberately doesn't
    WorldActions.autoDump(this.husky, tile, this.ownerRegistry.get(tile.ownerId));

    if (this.fogOfWar) this.applyFov(); // Blizzard moved — recompute what he sees
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
    // Per-house facade assignment: roof for interior, one door per house (none
    // for bottom-of-map houses), remaining facade tiles bare/windowed.
    const faces = assignHouseFaces(this.map);
    const FACE_TEXTURE: Record<string, string> = {
      roof: 'house-roof', door: 'house-front-door', window: 'house-front-window', bare: 'house-front-bare',
    };
    for (let r = 0; r < this.map.rows; r++) {
      this.tileSprites[r] = [];
      for (let c = 0; c < this.map.cols; c++) {
        const tile = this.map.tiles[r][c];
        // Grass/pavement/water keys match their tile type directly.
        let key: string = tile.type;
        if (tile.type === 'house') {
          key = FACE_TEXTURE[faces.get(`${c},${r}`) ?? 'roof'];
        }
        const img = this.add.image(c * T, r * T, key).setOrigin(0, 0);
        if (tile.type === 'grass') img.setTint(this.grassColor(tile));
        this.tileSprites[r][c] = img;
        this.drawFences(tile);
      }
    }
  }

  // The gate IS a fence. Toggling the same `fences.right` flag the map format
  // already uses means Grid.canMove, both dogs' BFS, and every other consumer
  // of the fence rules need to know nothing about gates at all.
  private shutGate() {
    const T = GRID.TILE;
    setGate(this.map, true);
    for (const g of GATE_TILES) {
      const spr = this.add.image(g.col * T + T - 4, g.row * T, 'fenceV')
        .setOrigin(0, 0).setDepth(6).setTint(GameScene.GATE_TINT);
      this.gateSprites.push(spr);
    }
  }

  private openGate() {
    setGate(this.map, false);
    for (const s of this.gateSprites) s.destroy();
    this.gateSprites = [];
    audio.play('banditTreat'); // he's out — announce the mode he leaves home in
  }

  /** True while Bandit is still penned in the Grumbles' yard. */
  private gateShut(): boolean { return this.gateSprites.length > 0; }

  // ---------------------------------------------------------------- items ---

  /** Tiles Bandit refuses to enter right now. Blizzard is never passed this. */
  private banditBlocked(): (t: TileCoord) => boolean {
    return repellerBlocks(this.repellers, this.chihuahua.tile);
  }

  /** What the controller needs to know about a deployed rawhide, or null. */
  private rawhideState(): { reachable: boolean; onIt: boolean } | null {
    if (!this.rawhide) return null;
    const t = this.rawhide.tile;
    const onIt = this.chihuahua.tile.col === t.col && this.chihuahua.tile.row === t.row;
    // Reachability comes from the same BFS that moves him, so he can never
    // commit to a rawhide he cannot actually walk to (penned behind the gate,
    // or fenced off by his own repeller aversion).
    const reachable = onIt
      || bfsFirstStep(this.grid, this.chihuahua.tile, (c) => c.col === t.col && c.row === t.row, this.banditBlocked()) !== null;
    return { reachable, onIt };
  }

  private deployItem(type: ItemType) {
    if (this.over || this.zoomSecondsLeft > 0) return; // no deploying mid-zoomies
    if (!consume(this.items, type)) return;            // pressed a key for one he hasn't got
    const tile = { ...this.husky.tile };
    const p = this.grid.tileToPixel(tile);
    if (type === 'rawhide') {
      this.rawhide?.sprite.destroy();                  // only one at a time; the newest wins
      this.rawhide = {
        tile, secondsLeft: config.RAWHIDE_EAT_SECONDS,
        sprite: this.add.image(p.x, p.y, 'rawhide').setDepth(8),
      };
    } else if (type === 'repeller') {
      const radius = config.REPELLER_RADIUS * GRID.TILE;
      const ring = this.add.graphics().setDepth(4);
      ring.lineStyle(2, 0x7fbfe0, 0.8).strokeCircle(p.x, p.y, radius);
      ring.fillStyle(0x7fbfe0, 0.08).fillCircle(p.x, p.y, radius);
      this.repellers.push({
        tile, secondsLeft: config.REPELLER_SECONDS,
        sprite: this.add.image(p.x, p.y, 'repeller').setDepth(8),
        ring,
        label: this.add.text(p.x + 10, p.y - 18, `${config.REPELLER_SECONDS}`, { fontSize: '12px', color: '#eaf6ff' }).setDepth(9),
      });
    } else if (type === 'diaper') {
      // Deliberately NOT via WorldActions: every path there deposits into the
      // tile, and leaving the lawn clean is the whole point of the item.
      this.husky.inv.poop = 0;
      this.husky.inv.pee = 0;
    } else {
      this.zoomSecondsLeft = config.ZOOM_SECONDS;
    }
    audio.play('trick');
  }

  /** One second of item upkeep: countdowns, expiry, zoomies. */
  private itemSecondTick() {
    if (this.rawhide) {
      // Only counts down while he is actually chewing it.
      const onIt = this.rawhideState()?.onIt;
      if (onIt && --this.rawhide.secondsLeft <= 0) {
        this.rawhide.sprite.destroy();
        this.rawhide = null;   // controller hands his interrupted mode back
      }
    }
    const { alive, expired } = tickRepellers(this.repellers);
    for (const r of expired) { r.sprite.destroy(); r.ring.destroy(); r.label.destroy(); }
    for (const r of alive) r.label.setText(`${r.secondsLeft}`);
    this.repellers = alive;
    if (this.zoomSecondsLeft > 0) this.zoomSecondsLeft -= 1;
  }

  /** Random drops (scaled by held food) plus the 1000-food milestone grants. */
  private itemDropTick() {
    if (Math.random() < itemDropChance(this.husky.inv.food)) this.dropItemSomewhere();
    // A single big pickup can vault more than one milestone, so this is a count.
    const owed = milestonesToGrant(this.milestonesPaid, this.husky.inv.food);
    for (let i = 0; i < owed; i++) {
      this.milestonesPaid += 1;
      this.giveItem(randomItemType(Math.random));
    }
  }

  private dropItemSomewhere() {
    const free = this.map.tiles.flat().filter((t) =>
      t.type !== 'house' && t.type !== 'water' && !t.foodPresent
      && !this.itemPickups.some((i) => i.tile.col === t.col && i.tile.row === t.row));
    if (free.length === 0) return;
    const tile = free[Math.floor(Math.random() * free.length)];
    const type = randomItemType(Math.random);
    const p = this.grid.tileToPixel(tile);
    const sprite = this.add.image(p.x, p.y, type).setDepth(8);
    if (this.fovSet && !this.fovSet.has(this.fkey(tile.col, tile.row))) sprite.setVisible(false);
    this.itemPickups.push({ type, tile: { col: tile.col, row: tile.row }, sprite });
  }

  private giveItem(type: ItemType) {
    grant(this.items, type);
    audio.play('eat');
    // First one of its kind this round earns a tutorial. Two grants can land in
    // one frame (a pickup inside a tween, plus a milestone in the same tick), and
    // launching the overlay twice would replace the first panel unseen — so they
    // queue and are shown one at a time.
    if (!this.seenItems.has(type) && !this.tutorialQueue.includes(type)) {
      this.tutorialQueue.push(type);
      this.showNextTutorial();
    }
  }

  private showNextTutorial() {
    if (this.over || this.tutorialShowing) return;
    const type = nextTutorial(this.seenItems, this.tutorialQueue);
    if (!type) { this.tutorialQueue = []; return; }
    this.tutorialQueue = this.tutorialQueue.filter((t) => t !== type);
    this.seenItems.add(type);
    this.tutorialShowing = true;
    this.scene.pause();
    this.scene.pause('UI');
    this.scene.launch('ItemInfo', {
      type,
      resume: () => {
        this.tutorialShowing = false;
        this.scene.resume();
        this.scene.resume('UI');
        this.showNextTutorial(); // anything else that landed in the same frame
      },
    });
  }

  private takeItemPickupAt(tile: TileCoord) {
    const idx = this.itemPickups.findIndex((i) => i.tile.col === tile.col && i.tile.row === tile.row);
    if (idx === -1) return;
    const [picked] = this.itemPickups.splice(idx, 1);
    picked.sprite.destroy();
    this.giveItem(picked.type);
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
