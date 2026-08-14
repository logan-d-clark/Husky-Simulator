# Husky Simulator — Modernization Design

**Date:** 2026-07-23
**Status:** Approved (pending spec review)

## 1. Summary

Husky Simulator is a top-down neighborhood resource-management game. The player
is a husky who escaped their yard and roams a suburban neighborhood on a hot
summer day, gathering as many treats as possible before the owner comes home
(the countdown timer). Movement burns **food** (treats) and **water**; food
turns into **poop** and water into **pee**, which must be dropped off somewhere.
Every household has an **affection** level toward the dog that governs how often
(and how generously) it drops treats; pooping/peeing on a yard lowers affection
(scaled by that household's **sensitivity**/tolerance), while doing **tricks**
raises it. Water refills at water tiles placed in the corners, far from the
best treat areas, to force strategic trade-offs.

This project is a ground-up modernization of the original single-file pygame
prototype (`Reference Materials/Husky Simulator v1/main.py`) into a modular,
web-deployable TypeScript game, preserving all existing gameplay while adding
polish and several wishlist features.

### Goals

1. Faithful, modular re-implementation retaining **all** V1 functionality and
   the exact map layout.
2. A modernized visual + UI coat of paint (all-new cohesive art, better status
   bars, per-household profiles).
3. Implementation of the V1 "TODO" wishlist features, especially the AI-driven
   chihuahua adversary.

### Non-goals (this build)

- Mobile/touch controls (noted as a clean future extension).
- Sound/music and an options/settings menu (deferred to a later pass).

## 2. Decisions (locked)

| Topic             | Decision                                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Engine            | **Phaser 3** + **TypeScript**, bundled with **Vite**                                                                            |
| Movement feel     | **Smooth tween between tiles**, but logic stays **tile-discrete** (per-tile resource accounting preserved)                      |
| Art               | **All-new cohesive art**, authored as **flat/vector SVG** on a shared **warm-summer palette**                                   |
| First-build scope | Faithful port **+** chihuahua AI **+** menus/game-over/play-again **+** household profile panels **+** auto-dump & polish TODOs |
| Testing           | **Vitest** unit tests on pure game-logic modules (TDD)                                                                          |
| Deployment        | Static site to **GitHub Pages** via **GitHub Actions**                                                                          |

## 3. Architecture

Gameplay logic lives in **framework-agnostic TypeScript modules** (plain data +
pure functions/classes, unit-testable without Phaser). Phaser **scenes** own
rendering and input and delegate to those modules. This boundary is the core
"max extensibility" investment: rules can change without touching render code,
and logic is testable in isolation.

```
husky-simulator/
  index.html
  package.json
  tsconfig.json
  vite.config.ts
  vitest.config.ts
  .github/workflows/deploy.yml
  src/
    main.ts                  # Phaser game config + scene registration
    config/
      constants.ts           # ALL gameplay tuning knobs (from V1 constants)
      palette.ts             # Shared warm-summer color palette
    data/
      map.csv                # The V1 layout, imported verbatim (?raw)
      owners.ts              # Owner properties (from OwnerProperties.csv) + names
    world/
      blockParser.ts         # parse block-type strings (V1 parse_block_type)
      MapParser.ts           # CSV -> Tile model + fence/collision model
      Grid.ts                # tile<->pixel, neighbor queries, passability
      tiles.ts               # Tile type definitions (grass/pavement/house/water)
    entities/
      Husky.ts               # player state + actions
      Chihuahua.ts           # AI adversary state
      Owner.ts               # household affection model
      Food.ts                # treat/bowl/bag
    systems/
      ResourceSystem.ts      # food/water/poop/pee accounting
      HeatSystem.ts          # water drain by surface
      AffectionSystem.ts     # affection updates + treat dispensing
      MovementSystem.ts      # tile-step decisions + passability
      AISystem.ts            # chihuahua pathfinding + decisions
    scenes/
      BootScene.ts           # minimal setup
      PreloadScene.ts        # load generated SVG assets
      MenuScene.ts           # title + Start / How to Play / Credits
      InstructionsScene.ts   # controls + goal
      GameScene.ts           # main gameplay: owns sim tick, entities, map render
      UIScene.ts             # HUD overlay (runs parallel to GameScene)
      GameOverScene.ts       # reason + score + play again
    ui/
      Hud.ts                 # status bars (icons), timer, current-space, score
      HouseholdProfile.ts    # on-map badges + contextual detail panel
    assets/                  # generated SVG art (tiles, husky frames, chihuahua, food)
    types.ts                 # shared TS types
  docs/superpowers/specs/    # this design doc
```

## 4. Simulation Model (faithful core)

### 4.1 Map & grid

- Grid is **26 rows × 48 columns** (unchanged).
- `MapBlockIDs.csv` is copied to `src/data/map.csv` and **imported verbatim**
  (Vite `?raw`), then parsed. The layout the user carefully designed —
  house/yard positions, fences, and the gaps in them — is preserved exactly.
- **Block-string parsing** replicates V1's `parse_block_type`: first char is the
  class (`H` house, `G` grass, `P` pavement, `W` water); remaining chars encode
  `owner_id` (int) and fence metadata (`l`/`r`/`t`/`b` or two-letter combos).
- **Tile size** is fixed at the design resolution (e.g. 28 px). Phaser
  `Scale.FIT` scales the whole canvas responsively to any screen while
  preserving aspect ratio, so the exact layout is never distorted.

### 4.2 Fixed sim tick

A **fixed 10 Hz simulation tick** (matching V1 `FPS = 10`) drives all game logic
via a fixed-timestep accumulator (decoupled from Phaser's 60 fps render). Each
tick:

1. If a move is queued and the target tile is passable: **step** to the next
   tile; apply move cost (food −`FOOD_RATE`, water −`WATER_RATE`; poop +`FOOD_RATE`, pee +`WATER_RATE`).
2. Apply **heat** of the current tile (water −heat; pee +heat). Applies even when
   standing still — preserving V1 behavior (pavement drains water while idle).
3. If drinking and on/adjacent to water: water +`WATER_VALUE` (capped).
4. If pooping/peeing/tricking and valid: apply the corresponding rate and update
   the owner's affection.
5. **Auto-dump:** on entering a valid grass tile, if poop or pee is at max,
   release automatically (subject to yard capacity).
6. **Treat dispensing:** for each food-eligible block with no food present, roll
   against its owner's active treat rate (bag/bowl/treat thresholds preserved).
7. **Countdown timer** decrements one second every 10 ticks.

Timer resolution and all rates come from `config/constants.ts`, carried over
from V1 unchanged (`FOOD_RATE`, `WATER_RATE`, `TREAT_VALUE`, `WATER_VALUE`,
`WATER_MAX`, `POOP_RATE`, `PEE_RATE`, `POOP_COST`, `PEE_COST`, `POOP_MAX`,
`PEE_MAX`, `CLEAN_RATE`, `CLEAN_COST`, `TRICK_RATE`, `TRICK_COST`,
`BOWL_LIKELIHOOD`, `BAG_LIKELIHOOD`, `BOWL_MULTIPLIER`, `BAG_MULTIPLIER`,
`BOWL_THRESHOLD`, `BAG_THRESHOLD`, `START_FOOD`, `START_WATER`, `HEAT_PAVEMENT`,
`HEAT_GRASS`, `TIME_MAX`).

### 4.3 Movement & collision

- Holding a direction queues continuous tile steps. On each sim tick, if the
  next tile in the facing direction is passable, the logic advances one tile and
  the sprite **tweens** across the gap over ~one tick interval, with the walk
  animation playing. Releasing the key stops queueing further steps.
- **Passability** is edge-aware: a move from tile A into neighbor B is blocked if
  B is a house or off-grid, or if a **fence** exists on the shared edge between A
  and B. (Cleaner and more correct than V1's 20×20 collision rects.) Fences are
  modeled as edges on the grid, derived from grass-block fence metadata.

### 4.4 Resources & game-over

- Inventory: `food`, `water`, `poop`, `pee` (+ `dirt` retained if needed).
- Food pickup: entering a tile that has a food object adds its value and removes
  the object.
- **Game-over conditions** (from V1): timer reaches 0 (reason "Time"), food ≤ 0
  (reason "Food"), or water ≤ 0 (reason "Water").

## 5. Owners & Affection

- 20 owners loaded from V1 `OwnerProperties.csv` into `data/owners.ts`
  (`owner_id`, `affection`, `sensitivity`, `treat_rate_base`), each extended with
  an **editable placeholder occupant name**.
- `treat_rate_active = treat_rate_base * (affection / 25)` (V1 formula; affection
  multiplier ranges 0–4).
- **Affection updates** (V1 `Owner.update`): `pee` and `poop` decrease affection
  by `PEE_COST * sensitivity` / `POOP_COST * sensitivity` (floored at 0); `trick`
  increases by `TRICK_RATE` (capped at 100).
- **Dispensing** (V1 `dispense_food`): roll `random()`; a **bag** if
  `≤ BAG_LIKELIHOOD * p` and affection `> BAG_THRESHOLD`; else a **bowl** if
  `≤ BOWL_LIKELIHOOD * p` and affection `> BOWL_THRESHOLD`; else a **treat** if
  `≤ p`. Food values: treat `TREAT_VALUE`, bowl `BOWL_MULTIPLIER×`, bag
  `BAG_MULTIPLIER×`.

## 6. Chihuahua Adversary (new)

- Uses the **same tile+tween movement model** as the husky.
- **Decision loop:** find the nearest reachable food object via BFS over passable
  tiles; path toward it and **eat it** (removes it from the board so the husky
  can't get it). When no food is reachable/visible, wander or patrol.
- The chihuahua is deliberately **simple and readable** — a greedy nearest-treat
  seeker — with clear hooks to extend later (avoid water, contest specific
  yards, difficulty tuning).
- A **score line tracks husky treats vs. chihuahua treats**, surfaced in the HUD
  and on the game-over screen.

## 7. UI

Rendered by a parallel **UIScene** overlay so HUD updates don't disturb the map.

- **Status bars** for food, water, poop, pee — each with an **icon** and showing
  true underlying values (fixes V1's `STATUS_BAR_SCALE` display quirk).
- **Countdown timer** (mm:ss).
- **Current-space panel:** heat / poop (dirt) / pee (destruction) of the tile the
  husky occupies.
- **Score:** treats collected, husky vs. chihuahua.
- **Household profiles:**
  - a compact **on-map badge** per yard (occupant name + heart/affection meter),
    positioned at each owner's **computed yard centroid** (replacing V1's
    hardcoded `affection_counter_block_ids`);
  - a **detailed profile panel** in the HUD for the yard the husky currently
    stands on (name, pee/poop tolerance, current affection).

## 8. Art Pipeline

All-new **flat/vector SVG** assets sharing a warm-summer palette defined in
`palette.ts`:

- **Tiles:** rounded houses with soft shadows, sandy pavement, teal water, plank
  fences.
- **Grass:** a base grass tile with a **color-overlay tint** driven by `dirt`
  (poop) and `destruction` (pee), reproducing the color-shift states V1 encoded
  in its 3×3 `GRASS_COLORS` matrix.
- **Husky:** clean vector dog with 4-direction walk cycles + idle and
  poop/pee/trick frames.
- **Chihuahua:** a distinct smaller variant on the same palette.
- **Food:** treat, bowl, bag.

SVGs are authored in `src/assets/` and loaded in `PreloadScene`
(`this.load.svg`). Grass state uses Phaser tint / overlay rather than baking
separate images per state.

## 9. Controls (preserved)

`W`/`A`/`S`/`D` move · `Q` drink · `E` trick · `C` poop · `Z` pee.

## 10. Testing (TDD)

Vitest unit tests target the pure logic modules:

- `blockParser` — block-string → (class, owner_id, fence metadata) across all V1
  string shapes.
- `MapParser` / `Grid` — tile model + edge-aware passability + fence edges.
- `ResourceSystem` / `HeatSystem` — per-tick accounting matches V1 math.
- `AffectionSystem` — affection updates + dispensing probabilities/thresholds.
- `AISystem` — BFS nearest-food targeting on sample grids.

Scenes remain thin wrappers so the logic beneath is exercised without a running
Phaser/browser context.

## 11. Deployment

- `vite build` outputs a static `dist/`.
- `vite.config.ts` `base` set to `/husky-simulator/` (repo name) so asset URLs
  resolve under GitHub Pages' project-site path.
- `.github/workflows/deploy.yml` builds on push to the default branch and
  publishes `dist/` to Pages.
- Project is a git repo from the start.

## 12. Two self-made decisions (approved)

1. **Responsive scaling** via Phaser `Scale.FIT` on a fixed design resolution, so
   the exact V1 layout fits any screen without distortion.
2. **Auto-computed yard centroids** for profile-badge placement, replacing V1's
   hardcoded affection-counter block IDs.
