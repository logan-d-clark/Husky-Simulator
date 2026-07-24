# Husky Simulator Modernization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-implement the pygame prototype `Husky Simulator` as a modular, GitHub-Pages-deployable Phaser 3 + TypeScript game that retains all V1 gameplay while adding a chihuahua AI adversary, menus/game-over flow, household profile panels, auto-dump, and all-new flat/vector art.

**Architecture:** Pure, framework-agnostic TypeScript modules hold all game logic (world model, resource/affection/heat/movement/AI systems) and are unit-tested with Vitest. Thin Phaser scenes own rendering and input and delegate to those modules. A fixed 10 Hz simulation tick (matching V1 `FPS=10`) drives all accounting; sprites tween smoothly between discrete tile steps.

**Tech Stack:** Phaser 3, TypeScript, Vite, Vitest, GitHub Actions (Pages).

## Global Constraints

- Map layout comes verbatim from V1 `MapBlockIDs.csv` (26 rows × 48 columns) — never alter tile positions, fences, or gaps.
- All gameplay tuning values are ported verbatim from V1 `main.py` into `src/config/constants.ts` (exact values listed in Task 4).
- Simulation logic is tile-discrete and runs on a fixed 10 Hz tick; rendering is decoupled (Phaser 60 fps) via a fixed-timestep accumulator.
- Game logic modules (`src/world`, `src/systems`, `src/entities`, `src/data`) must not import `phaser` — they stay unit-testable in a plain Node/Vitest context.
- Controls: `W/A/S/D` move, `Q` drink, `E` trick, `C` poop, `Z` pee.
- Node 20+. Package manager: npm. TypeScript strict mode on.
- `vite.config.ts` `base` = `/husky-simulator/` for Pages project-site paths.

## Source of Truth Reference Files

- V1 code: `Reference Materials/Husky Simulator v1/main.py`
- V1 map: `Reference Materials/Husky Simulator v1/MapBlockIDs.csv`
- V1 owners: `Reference Materials/Husky Simulator v1/OwnerProperties.csv`

---

## File Structure

```
package.json · tsconfig.json · vite.config.ts · vitest.config.ts · index.html
.github/workflows/deploy.yml
src/
  main.ts                       # Phaser config + scene registration
  types.ts                      # shared types (TileType, Direction, Inventory, etc.)
  config/constants.ts           # all tuning knobs (verbatim from V1)
  config/palette.ts             # warm-summer color palette
  data/map.csv                  # V1 layout, verbatim (imported ?raw)
  data/owners.ts                # owner props (from OwnerProperties.csv) + names
  world/blockParser.ts          # parse block-type strings (V1 parse_block_type)
  world/tiles.ts                # Tile classes/factory (grass/pavement/house/water)
  world/MapParser.ts            # csv text -> GameMap (tiles + fence edges)
  world/Grid.ts                 # tile<->pixel, neighbors, passability
  entities/Husky.ts             # player state + actions
  entities/Chihuahua.ts         # AI adversary state
  entities/Owner.ts             # household affection model
  entities/Food.ts              # treat/bowl/bag
  systems/ResourceSystem.ts     # food/water/poop/pee accounting
  systems/HeatSystem.ts         # water drain by surface
  systems/AffectionSystem.ts    # affection updates + treat dispensing
  systems/MovementSystem.ts     # tile-step decision + queue
  systems/AISystem.ts           # chihuahua BFS pathing + decisions
  scenes/BootScene.ts
  scenes/PreloadScene.ts
  scenes/MenuScene.ts
  scenes/InstructionsScene.ts
  scenes/GameScene.ts           # owns sim tick, entities, map render
  scenes/UIScene.ts             # HUD overlay
  scenes/GameOverScene.ts
  ui/Hud.ts                     # status bars, timer, current-space, score
  ui/HouseholdProfile.ts        # on-map badges + detail panel
  assets/                       # generated SVG art
tests/                          # Vitest specs mirror src/ paths
```

---

## PHASE 0 — Scaffolding

### Task 1: Project scaffold boots an empty Phaser canvas

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.ts`, `src/scenes/BootScene.ts`

**Interfaces:**
- Produces: `BootScene` (Phaser.Scene, key `'Boot'`); the Phaser `Game` instance created in `main.ts`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "husky-simulator",
  "private": true,
  "version": "2.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": { "phaser": "^3.80.1" },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vite": "^5.2.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["vite/client"],
    "lib": ["ES2020", "DOM", "DOM.Iterable"]
  },
  "include": ["src", "tests"]
}
```

- [ ] **Step 3: Create `vite.config.ts`**

```ts
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/husky-simulator/',
  build: { target: 'es2020', outDir: 'dist' },
});
```

- [ ] **Step 4: Create `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Husky Simulator</title>
    <style>
      html, body { margin: 0; height: 100%; background: #1a1a1a; overflow: hidden; }
      #game { width: 100vw; height: 100vh; }
    </style>
  </head>
  <body>
    <div id="game"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 5: Create `src/scenes/BootScene.ts`**

```ts
import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  create() {
    this.add.text(20, 20, 'Husky Simulator booting…', { color: '#ffffff' });
  }
}
```

- [ ] **Step 6: Create `src/main.ts`**

```ts
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';

export const DESIGN_WIDTH = 1344;   // 48 cols * 28px
export const DESIGN_HEIGHT = 728;   // 26 rows * 28px

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#1a1a1a',
  width: DESIGN_WIDTH,
  height: DESIGN_HEIGHT + 140,      // + HUD strip
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  scene: [BootScene],
});
```

- [ ] **Step 7: Install and run**

Run: `npm install && npm run dev`
Expected: dev server starts; browser shows a centered canvas with "Husky Simulator booting…".

- [ ] **Step 8: Commit**

```bash
git add package.json tsconfig.json vite.config.ts index.html src/main.ts src/scenes/BootScene.ts package-lock.json
git commit -m "chore: scaffold Vite + Phaser + TS project"
```

---

### Task 2: Vitest wired up with a passing sanity test

**Files:**
- Create: `vitest.config.ts`, `tests/sanity.test.ts`

- [ ] **Step 1: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
```

- [ ] **Step 2: Write `tests/sanity.test.ts`**

```ts
import { describe, it, expect } from 'vitest';

describe('sanity', () => {
  it('runs', () => { expect(1 + 1).toBe(2); });
});
```

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: 1 passed.

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts tests/sanity.test.ts
git commit -m "test: add vitest config and sanity test"
```

---

### Task 3: GitHub Pages deploy workflow

**Files:**
- Create: `.github/workflows/deploy.yml`

- [ ] **Step 1: Create the workflow**

```yaml
name: Deploy to GitHub Pages
on:
  push: { branches: [main] }
  workflow_dispatch:
permissions: { contents: read, pages: write, id-token: write }
concurrency: { group: pages, cancel-in-progress: true }
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm run build
      - uses: actions/upload-pages-artifact@v3
        with: { path: dist }
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment: { name: github-pages, url: "${{ steps.deployment.outputs.page_url }}" }
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/deploy.yml
git commit -m "ci: add GitHub Pages deploy workflow"
```

Note: after first push, enable Pages → Source: "GitHub Actions" in the repo settings. Documented in Task 31.

---

## PHASE 1 — Data & world model (pure logic, TDD)

### Task 4: Constants and shared types

**Files:**
- Create: `src/config/constants.ts`, `src/types.ts`

**Interfaces:**
- Produces: all constants below; types `TileType = 'grass'|'pavement'|'house'|'water'`, `Direction = 'up'|'down'|'left'|'right'`, `FoodType = 'treat'|'bowl'|'bag'`, `Inventory` interface, `FenceEdges` interface.

- [ ] **Step 1: Create `src/config/constants.ts`** (values verbatim from V1)

```ts
export const GRID = { ROWS: 26, COLS: 48, TILE: 28 } as const;

export const FOOD_RATE = 0.1;
export const WATER_RATE = 0.1;
export const TREAT_VALUE = 10;
export const WATER_VALUE = 10;
export const WATER_MAX = 1000;

export const POOP_RATE = 1;
export const PEE_RATE = 1;
export const POOP_COST = 1;
export const PEE_COST = 1;
export const POOP_MAX = 100;
export const PEE_MAX = 100;

export const CLEAN_RATE = 1;   // ported for completeness; no clean action in V1
export const CLEAN_COST = 1;

export const TRICK_RATE = 1;
export const TRICK_COST = 1;

export const BOWL_LIKELIHOOD = 0.3;
export const BAG_LIKELIHOOD = 0.05;
export const BOWL_MULTIPLIER = 2;
export const BAG_MULTIPLIER = 4;
export const BOWL_THRESHOLD = 50;
export const BAG_THRESHOLD = 90;

export const START_FOOD = 50;
export const START_WATER = 50;

export const HEAT_PAVEMENT = 0.05;
export const HEAT_GRASS = 0.01;

export const SIM_HZ = 10;                    // V1 FPS
export const TICKS_PER_SECOND = SIM_HZ;
export const GAME_SECONDS = 20 * 60;         // V1 TIME_MAX = 20 minutes
export const HUSKY_START_TILE = { col: 22, row: 13 };  // from V1 start x/y
```

- [ ] **Step 2: Create `src/types.ts`**

```ts
export type TileType = 'grass' | 'pavement' | 'house' | 'water';
export type Direction = 'up' | 'down' | 'left' | 'right';
export type FoodType = 'treat' | 'bowl' | 'bag';

export interface Inventory { food: number; water: number; poop: number; pee: number; }
export interface FenceEdges { top: boolean; bottom: boolean; left: boolean; right: boolean; }
export interface TileCoord { col: number; row: number; }
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/config/constants.ts src/types.ts
git commit -m "feat: port V1 constants and shared types"
```

---

### Task 5: Palette

**Files:**
- Create: `src/config/palette.ts`

- [ ] **Step 1: Create palette (warm-summer, cohesive)**

```ts
// Central color source. All art + tint states reference these.
export const PALETTE = {
  grassBase:  '#6aa84f',
  grassDirt1: '#8a9a3c',   // some poop
  grassDirt2: '#b0a536',   // lots of poop
  grassDead1: '#b08d3c',   // some pee (destruction)
  grassDead2: '#c9a24b',   // lots of pee
  pavement:   '#cdbb9a',
  pavementEdge:'#b7a482',
  houseWall:  '#f2ede0',
  houseRoof:  '#c0563a',
  houseShadow:'#00000022',
  fence:      '#8a5a2b',
  water:      '#5fc4d0',
  waterEdge:  '#3fa6b4',
  huskyCoat:  '#5a5a66',
  huskyBelly: '#e8e8ee',
  chihuahua:  '#c9915a',
  treat:      '#d98a3d',
  bowl:       '#c0563a',
  bag:        '#8a5a2b',
  hudBg:      '#2a2622',
  hudText:    '#f2ede0',
  affection:  '#e05a6a',
} as const;
```

- [ ] **Step 2: Commit**

```bash
git add src/config/palette.ts
git commit -m "feat: add shared warm-summer palette"
```

---

### Task 6: Owner data (with names)

**Files:**
- Create: `src/data/owners.ts`

**Interfaces:**
- Produces: `interface OwnerData { id: number; affection: number; sensitivity: number; treatRateBase: number; name: string; }` and `OWNERS: OwnerData[]` (20 entries, ids 0–19).

- [ ] **Step 1: Create `src/data/owners.ts`** (values from `OwnerProperties.csv`; names are placeholders, editable)

```ts
export interface OwnerData {
  id: number;
  affection: number;
  sensitivity: number;
  treatRateBase: number;
  name: string;
}

// affection/sensitivity/treatRateBase are verbatim from V1 OwnerProperties.csv.
// Names are editable placeholders. id 0 = public/streets/water (no household).
export const OWNERS: OwnerData[] = [
  { id: 0,  affection: 1,  sensitivity: 0, treatRateBase: 0.00005, name: 'Public' },
  { id: 1,  affection: 0,  sensitivity: 5, treatRateBase: 0.0005,  name: 'The Grumbles' },
  { id: 2,  affection: 15, sensitivity: 1, treatRateBase: 0.00005, name: 'Ms. Rivera' },
  { id: 3,  affection: 15, sensitivity: 1, treatRateBase: 0.00005, name: 'The Okafors' },
  { id: 4,  affection: 15, sensitivity: 1, treatRateBase: 0.00005, name: 'Old Pete' },
  { id: 5,  affection: 15, sensitivity: 1, treatRateBase: 0.00005, name: 'The Nguyens' },
  { id: 6,  affection: 15, sensitivity: 1, treatRateBase: 0.00005, name: 'Sunny' },
  { id: 7,  affection: 10, sensitivity: 2, treatRateBase: 0.0001,  name: 'The Bakers' },
  { id: 8,  affection: 5,  sensitivity: 4, treatRateBase: 0.00035, name: 'Mr. Frost' },
  { id: 9,  affection: 5,  sensitivity: 3, treatRateBase: 0.0002,  name: 'The Delgados' },
  { id: 10, affection: 15, sensitivity: 2, treatRateBase: 0.00015, name: 'Auntie May' },
  { id: 11, affection: 5,  sensitivity: 3, treatRateBase: 0.0002,  name: 'The Harts' },
  { id: 12, affection: 5,  sensitivity: 3, treatRateBase: 0.00025, name: 'The Wus' },
  { id: 13, affection: 10, sensitivity: 4, treatRateBase: 0.00025, name: 'Coach Bo' },
  { id: 14, affection: 10, sensitivity: 4, treatRateBase: 0.00035, name: 'The Larsons' },
  { id: 15, affection: 15, sensitivity: 1, treatRateBase: 0.0001,  name: 'Grandpa Joe' },
  { id: 16, affection: 10, sensitivity: 3, treatRateBase: 0.00015, name: 'The Pattels' },
  { id: 17, affection: 10, sensitivity: 3, treatRateBase: 0.0002,  name: 'Ms. Cole' },
  { id: 18, affection: 10, sensitivity: 3, treatRateBase: 0.00015, name: 'The Kims' },
  { id: 19, affection: 5,  sensitivity: 4, treatRateBase: 0.00035, name: 'The Volkovs' },
];
```

- [ ] **Step 2: Commit**

```bash
git add src/data/owners.ts
git commit -m "feat: add owner data with editable names"
```

---

### Task 7: Block-string parser (TDD)

Replicates V1 `parse_block_type`. Returns tile class, owner id, and fence metadata.

**Files:**
- Create: `src/world/blockParser.ts`, `tests/world/blockParser.test.ts`

**Interfaces:**
- Produces: `parseBlock(s: string): { cls: 'H'|'G'|'P'|'W'; ownerId: number; fences: string }` where `fences` is `''`, or one/two of `l r t b` (e.g. `'l'`, `'rb'`).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { parseBlock } from '../../src/world/blockParser';

describe('parseBlock', () => {
  it('plain grass G0', () => {
    expect(parseBlock('G0')).toEqual({ cls: 'G', ownerId: 0, fences: '' });
  });
  it('single-digit owner grass G1', () => {
    expect(parseBlock('G1')).toEqual({ cls: 'G', ownerId: 1, fences: '' });
  });
  it('two-digit owner grass G19', () => {
    expect(parseBlock('G19')).toEqual({ cls: 'G', ownerId: 19, fences: '' });
  });
  it('single-digit owner + one fence G3l', () => {
    expect(parseBlock('G3l')).toEqual({ cls: 'G', ownerId: 3, fences: 'l' });
  });
  it('two-digit owner + one fence G14r', () => {
    expect(parseBlock('G14r')).toEqual({ cls: 'G', ownerId: 14, fences: 'r' });
  });
  it('single-digit owner + two fences G9lt', () => {
    expect(parseBlock('G9lt')).toEqual({ cls: 'G', ownerId: 9, fences: 'lt' });
  });
  it('two-digit owner + two fences G10rb', () => {
    expect(parseBlock('G10rb')).toEqual({ cls: 'G', ownerId: 10, fences: 'rb' });
  });
  it('bare G (owner 0)', () => {
    expect(parseBlock('G')).toEqual({ cls: 'G', ownerId: 0, fences: '' });
  });
  it('house H', () => {
    expect(parseBlock('H')).toEqual({ cls: 'H', ownerId: 0, fences: '' });
  });
  it('pavement P0', () => {
    expect(parseBlock('P0')).toEqual({ cls: 'P', ownerId: 0, fences: '' });
  });
  it('water W0', () => {
    expect(parseBlock('W0')).toEqual({ cls: 'W', ownerId: 0, fences: '' });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- blockParser`
Expected: FAIL (parseBlock not defined).

- [ ] **Step 3: Implement `src/world/blockParser.ts`** (mirrors V1 logic)

```ts
export interface ParsedBlock { cls: 'H' | 'G' | 'P' | 'W'; ownerId: number; fences: string; }

export function parseBlock(raw: string): ParsedBlock {
  const s = raw.trim();
  const cls = s[0] as ParsedBlock['cls'];
  const rest = s.slice(1);

  if (rest.length === 0) return { cls, ownerId: 0, fences: '' };

  let ownerId = 0;
  let fences = '';

  if (rest.length === 1) {
    ownerId = parseInt(rest, 10);
  } else if (rest.length === 2) {
    if (isDigit(rest[0]) && isDigit(rest[1])) ownerId = parseInt(rest, 10);
    else { ownerId = parseInt(rest[0], 10); fences = rest[1]; }
  } else if (rest.length === 3) {
    if (isDigit(rest[1])) { ownerId = parseInt(rest.slice(0, 2), 10); fences = rest[2]; }
    else { ownerId = parseInt(rest[0], 10); fences = rest.slice(1, 3); }
  } else if (rest.length === 4) {
    ownerId = parseInt(rest.slice(0, 2), 10);
    fences = rest.slice(2, 4);
  }
  return { cls, ownerId, fences };
}

function isDigit(c: string): boolean { return c >= '0' && c <= '9'; }
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- blockParser`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/world/blockParser.ts tests/world/blockParser.test.ts
git commit -m "feat: block-type string parser with tests"
```

---

### Task 8: Map CSV + MapParser → tile model (TDD)

**Files:**
- Copy: `Reference Materials/Husky Simulator v1/MapBlockIDs.csv` → `src/data/map.csv`
- Create: `src/world/tiles.ts`, `src/world/MapParser.ts`, `tests/world/MapParser.test.ts`

**Interfaces:**
- Produces:
  - `interface Tile { col: number; row: number; type: TileType; ownerId: number; fences: FenceEdges; heat: number; dirt: number; destruction: number; foodPresent: boolean; houseColor?: 'marble'|'clay'; }`
  - `interface GameMap { rows: number; cols: number; tiles: Tile[][]; }` (tiles indexed `[row][col]`)
  - `parseMap(csvText: string): GameMap`

- [ ] **Step 1: Copy the map CSV**

Run: `cp "Reference Materials/Husky Simulator v1/MapBlockIDs.csv" src/data/map.csv`
Expected: `src/data/map.csv` exists with 26 lines.

- [ ] **Step 2: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { parseMap } from '../../src/world/MapParser';

const CSV = `G1,H,P0,W0
G3l,G3,G,G0`;

describe('parseMap', () => {
  it('builds a 2x4 grid', () => {
    const m = parseMap(CSV);
    expect(m.rows).toBe(2);
    expect(m.cols).toBe(4);
  });
  it('maps classes to tile types', () => {
    const m = parseMap(CSV);
    expect(m.tiles[0][0].type).toBe('grass');
    expect(m.tiles[0][1].type).toBe('house');
    expect(m.tiles[0][2].type).toBe('pavement');
    expect(m.tiles[0][3].type).toBe('water');
  });
  it('assigns owner id to grass', () => {
    expect(parseMap(CSV).tiles[0][0].ownerId).toBe(1);
  });
  it('sets fence edges from metadata', () => {
    const t = parseMap(CSV).tiles[1][0]; // G3l
    expect(t.fences.left).toBe(true);
    expect(t.fences.right).toBe(false);
  });
  it('grass heat = HEAT_GRASS, pavement = HEAT_PAVEMENT, water = 0', () => {
    const m = parseMap(CSV);
    expect(m.tiles[0][0].heat).toBeCloseTo(0.01);
    expect(m.tiles[0][2].heat).toBeCloseTo(0.05);
    expect(m.tiles[0][3].heat).toBe(0);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm test -- MapParser`
Expected: FAIL.

- [ ] **Step 4: Implement `src/world/tiles.ts`**

```ts
import type { TileType, FenceEdges } from '../types';

export interface Tile {
  col: number;
  row: number;
  type: TileType;
  ownerId: number;
  fences: FenceEdges;
  heat: number;
  dirt: number;         // poop accumulation
  destruction: number;  // pee accumulation
  foodPresent: boolean;
  houseColor?: 'marble' | 'clay';
}

export function emptyFences(): FenceEdges {
  return { top: false, bottom: false, left: false, right: false };
}
```

- [ ] **Step 5: Implement `src/world/MapParser.ts`**

```ts
import { parseBlock } from './blockParser';
import { emptyFences, type Tile } from './tiles';
import type { TileType } from '../types';
import { HEAT_GRASS, HEAT_PAVEMENT } from '../config/constants';

export interface GameMap { rows: number; cols: number; tiles: Tile[][]; }

const CLASS_TO_TYPE: Record<string, TileType> = {
  G: 'grass', H: 'house', P: 'pavement', W: 'water',
};

export function parseMap(csvText: string): GameMap {
  const lines = csvText.replace(/\r/g, '').split('\n').filter((l) => l.trim().length > 0);
  const tiles: Tile[][] = [];

  lines.forEach((line, row) => {
    const cells = line.split(',');
    const rowTiles: Tile[] = cells.map((cell, col) => {
      const { cls, ownerId, fences } = parseBlock(cell);
      const type = CLASS_TO_TYPE[cls];
      const fenceEdges = emptyFences();
      if (fences.includes('l')) fenceEdges.left = true;
      if (fences.includes('r')) fenceEdges.right = true;
      if (fences.includes('t')) fenceEdges.top = true;
      if (fences.includes('b')) fenceEdges.bottom = true;
      const heat = type === 'grass' ? HEAT_GRASS : type === 'pavement' ? HEAT_PAVEMENT : 0;
      return {
        col, row, type, ownerId, fences: fenceEdges,
        heat, dirt: 0, destruction: 0, foodPresent: false,
        houseColor: type === 'house' ? 'marble' : undefined,
      };
    });
    tiles.push(rowTiles);
  });

  return { rows: tiles.length, cols: tiles[0]?.length ?? 0, tiles };
}
```

- [ ] **Step 6: Run to verify pass**

Run: `npm test -- MapParser`
Expected: all PASS.

- [ ] **Step 7: Add real-map smoke test** (append to `tests/world/MapParser.test.ts`)

```ts
import realCsv from '../../src/data/map.csv?raw';
it('parses the real 26x48 map', () => {
  const m = parseMap(realCsv);
  expect(m.rows).toBe(26);
  expect(m.cols).toBe(48);
});
```

Add to top of `vitest.config.ts` `test` object: `deps: { inline: [] }` is not needed; instead enable `?raw` by adding `assetsInclude: ['**/*.csv']` to a shared vite config. Simplest: in `vitest.config.ts` add `assetsInclude: ['**/*.csv']` at top level of the config object.

- [ ] **Step 8: Run and commit**

Run: `npm test -- MapParser`
Expected: PASS including real map.

```bash
git add src/data/map.csv src/world/tiles.ts src/world/MapParser.ts tests/world/MapParser.test.ts vitest.config.ts
git commit -m "feat: map CSV parser producing tile model with tests"
```

---

### Task 9: Grid — passability, neighbors, coordinates (TDD)

**Files:**
- Create: `src/world/Grid.ts`, `tests/world/Grid.test.ts`

**Interfaces:**
- Consumes: `GameMap`, `Tile` (Task 8); `Direction`, `TileCoord` (Task 4); `GRID` (Task 4).
- Produces: `class Grid` with:
  - `constructor(map: GameMap)`
  - `inBounds(col, row): boolean`
  - `tileAt(col, row): Tile | undefined`
  - `neighbor(coord, dir): TileCoord`
  - `canMove(from: TileCoord, dir: Direction): boolean` — false if target off-grid, target is `house`, or a fence sits on the shared edge (either side's edge flag).
  - `tileToPixel(coord): { x: number; y: number }` — center pixel of the tile.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { parseMap } from '../../src/world/MapParser';
import { Grid } from '../../src/world/Grid';

// row0: grass(G0) | house(H) | grass with right-fence(G0r)
// row1: grass(G0)   grass(G0)   grass with left-fence(G0l)
const CSV = `G0,H,G0r
G0,G0,G0l`;

describe('Grid', () => {
  const grid = new Grid(parseMap(CSV));

  it('blocks moving into a house', () => {
    expect(grid.canMove({ col: 0, row: 0 }, 'right')).toBe(false);
  });
  it('blocks moving off-grid', () => {
    expect(grid.canMove({ col: 0, row: 0 }, 'left')).toBe(false);
    expect(grid.canMove({ col: 0, row: 0 }, 'up')).toBe(false);
  });
  it('allows an open move', () => {
    expect(grid.canMove({ col: 0, row: 0 }, 'down')).toBe(true);
  });
  it('blocks across a fenced edge (right fence on source)', () => {
    // tile (2,0) has right fence; moving right would leave grid anyway,
    // so test the left-fence pair: (2,1) has left fence -> moving left blocked
    expect(grid.canMove({ col: 2, row: 1 }, 'left')).toBe(false);
  });
  it('computes neighbor coord', () => {
    expect(grid.neighbor({ col: 1, row: 1 }, 'up')).toEqual({ col: 1, row: 0 });
  });
  it('tile center pixel', () => {
    expect(grid.tileToPixel({ col: 0, row: 0 })).toEqual({ x: 14, y: 14 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- Grid`
Expected: FAIL.

- [ ] **Step 3: Implement `src/world/Grid.ts`**

```ts
import type { GameMap } from './MapParser';
import type { Tile } from './tiles';
import type { Direction, TileCoord } from '../types';
import { GRID } from '../config/constants';

const DELTA: Record<Direction, { dc: number; dr: number }> = {
  up: { dc: 0, dr: -1 }, down: { dc: 0, dr: 1 },
  left: { dc: -1, dr: 0 }, right: { dc: 1, dr: 0 },
};

export class Grid {
  constructor(public map: GameMap) {}

  inBounds(col: number, row: number): boolean {
    return col >= 0 && row >= 0 && col < this.map.cols && row < this.map.rows;
  }

  tileAt(col: number, row: number): Tile | undefined {
    return this.inBounds(col, row) ? this.map.tiles[row][col] : undefined;
  }

  neighbor(coord: TileCoord, dir: Direction): TileCoord {
    const d = DELTA[dir];
    return { col: coord.col + d.dc, row: coord.row + d.dr };
  }

  canMove(from: TileCoord, dir: Direction): boolean {
    const to = this.neighbor(from, dir);
    const target = this.tileAt(to.col, to.row);
    if (!target) return false;
    if (target.type === 'house') return false;
    const src = this.tileAt(from.col, from.row);
    if (!src) return false;
    // Blocked if a fence sits on the shared edge (check both tiles' edge flags).
    if (dir === 'up' && (src.fences.top || target.fences.bottom)) return false;
    if (dir === 'down' && (src.fences.bottom || target.fences.top)) return false;
    if (dir === 'left' && (src.fences.left || target.fences.right)) return false;
    if (dir === 'right' && (src.fences.right || target.fences.left)) return false;
    return true;
  }

  tileToPixel(coord: TileCoord): { x: number; y: number } {
    return {
      x: coord.col * GRID.TILE + GRID.TILE / 2,
      y: coord.row * GRID.TILE + GRID.TILE / 2,
    };
  }
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- Grid`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add src/world/Grid.ts tests/world/Grid.test.ts
git commit -m "feat: Grid with edge-aware passability and tests"
```

---

## PHASE 2 — Core systems (pure logic, TDD)

### Task 10: Husky entity + ResourceSystem (TDD)

**Files:**
- Create: `src/entities/Husky.ts`, `src/systems/ResourceSystem.ts`, `tests/systems/ResourceSystem.test.ts`

**Interfaces:**
- Consumes: constants (Task 4), `Inventory`, `TileCoord`, `Direction`.
- Produces:
  - `class Husky` with `tile: TileCoord`, `inv: Inventory`, `facing: Direction`, ctor placing it at `HUSKY_START_TILE` with `START_FOOD`/`START_WATER`, poop/pee 0.
  - `ResourceSystem` pure functions:
    - `applyMoveCost(inv): void` — food −FOOD_RATE, poop +FOOD_RATE, water −WATER_RATE, pee +WATER_RATE.
    - `applyHeat(inv, heat): void` — water −heat, pee +heat.
    - `eatFood(inv, value): void` — food += value.
    - `drink(inv): void` — water += WATER_VALUE, capped at `WATER_MAX / 8` display-equivalent → cap raw water at `WATER_MAX/8`? See note.
    - `isGameOver(inv): 'Food'|'Water'|null`.

Note on drink cap: V1 caps water at `WATER_MAX / STATUS_BAR_SCALE` (1000/8 = 125) in raw inventory units. Reproduce: cap raw `water` at `WATER_MAX / 8 = 125`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { ResourceSystem } from '../../src/systems/ResourceSystem';
import type { Inventory } from '../../src/types';

const inv = (): Inventory => ({ food: 50, water: 50, poop: 0, pee: 0 });

describe('ResourceSystem', () => {
  it('move cost converts food->poop and water->pee', () => {
    const i = inv();
    ResourceSystem.applyMoveCost(i);
    expect(i.food).toBeCloseTo(49.9);
    expect(i.poop).toBeCloseTo(0.1);
    expect(i.water).toBeCloseTo(49.9);
    expect(i.pee).toBeCloseTo(0.1);
  });
  it('heat drains water into pee', () => {
    const i = inv();
    ResourceSystem.applyHeat(i, 0.05);
    expect(i.water).toBeCloseTo(49.95);
    expect(i.pee).toBeCloseTo(0.05);
  });
  it('eating adds food', () => {
    const i = inv();
    ResourceSystem.eatFood(i, 20);
    expect(i.food).toBe(70);
  });
  it('drinking adds water but caps at 125', () => {
    const i = inv(); i.water = 120;
    ResourceSystem.drink(i);
    expect(i.water).toBe(125);
  });
  it('game over on food or water <= 0', () => {
    const i = inv(); i.food = 0;
    expect(ResourceSystem.isGameOver(i)).toBe('Food');
    const j = inv(); j.water = -1;
    expect(ResourceSystem.isGameOver(j)).toBe('Water');
    expect(ResourceSystem.isGameOver(inv())).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- ResourceSystem`
Expected: FAIL.

- [ ] **Step 3: Implement `src/entities/Husky.ts`**

```ts
import type { Inventory, TileCoord, Direction } from '../types';
import { START_FOOD, START_WATER, HUSKY_START_TILE } from '../config/constants';

export class Husky {
  tile: TileCoord = { ...HUSKY_START_TILE };
  facing: Direction = 'left';
  inv: Inventory = { food: START_FOOD, water: START_WATER, poop: 0, pee: 0 };
  treatsEaten = 0;
}
```

- [ ] **Step 4: Implement `src/systems/ResourceSystem.ts`**

```ts
import type { Inventory } from '../types';
import { FOOD_RATE, WATER_RATE, WATER_VALUE, WATER_MAX } from '../config/constants';

const WATER_CAP = WATER_MAX / 8; // matches V1 STATUS_BAR_SCALE cap (125)

export const ResourceSystem = {
  applyMoveCost(inv: Inventory): void {
    inv.food -= FOOD_RATE; inv.poop += FOOD_RATE;
    inv.water -= WATER_RATE; inv.pee += WATER_RATE;
  },
  applyHeat(inv: Inventory, heat: number): void {
    inv.water -= heat; inv.pee += heat;
  },
  eatFood(inv: Inventory, value: number): void { inv.food += value; },
  drink(inv: Inventory): void { inv.water = Math.min(inv.water + WATER_VALUE, WATER_CAP); },
  isGameOver(inv: Inventory): 'Food' | 'Water' | null {
    if (inv.food <= 0) return 'Food';
    if (inv.water <= 0) return 'Water';
    return null;
  },
};
```

- [ ] **Step 5: Run to verify pass, then commit**

Run: `npm test -- ResourceSystem`
Expected: all PASS.

```bash
git add src/entities/Husky.ts src/systems/ResourceSystem.ts tests/systems/ResourceSystem.test.ts
git commit -m "feat: Husky entity and ResourceSystem with tests"
```

---

### Task 11: Owner entity + AffectionSystem (TDD)

**Files:**
- Create: `src/entities/Owner.ts`, `src/entities/Food.ts`, `src/systems/AffectionSystem.ts`, `tests/systems/AffectionSystem.test.ts`

**Interfaces:**
- Consumes: `OWNERS`/`OwnerData` (Task 6), constants, `FoodType`, `TileCoord`.
- Produces:
  - `class Owner` built from `OwnerData`, with mutable `affection`, and getters `treatRateActive` = `treatRateBase * (affection / 25)`.
  - `applyAction(owner, action: 'pee'|'poop'|'trick'): void` — pee/poop subtract `cost*sensitivity` floored at 0; trick +TRICK_RATE capped 100.
  - `interface Food { type: FoodType; value: number; tile: TileCoord; }`
  - `rollDispense(owner, rand: () => number): FoodType | null` — bag if `rand ≤ BAG_LIKELIHOOD*p && affection>BAG_THRESHOLD`; else bowl if `rand ≤ BOWL_LIKELIHOOD*p && affection>BOWL_THRESHOLD`; else treat if `rand ≤ p`; else null. `p = owner.treatRateActive`.
  - `foodValue(type): number`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { Owner } from '../../src/entities/Owner';
import { AffectionSystem } from '../../src/systems/AffectionSystem';
import type { OwnerData } from '../../src/data/owners';

const data = (over: Partial<OwnerData> = {}): OwnerData => ({
  id: 5, affection: 50, sensitivity: 2, treatRateBase: 0.5, name: 'Test', ...over,
});

describe('AffectionSystem', () => {
  it('active treat rate scales with affection', () => {
    const o = new Owner(data({ affection: 25, treatRateBase: 0.001 }));
    expect(o.treatRateActive).toBeCloseTo(0.001);
  });
  it('pee reduces affection by cost*sensitivity, floored at 0', () => {
    const o = new Owner(data({ affection: 3, sensitivity: 2 }));
    AffectionSystem.applyAction(o, 'pee');
    expect(o.affection).toBe(1);
    AffectionSystem.applyAction(o, 'pee');
    expect(o.affection).toBe(0); // 1 - 2 floored
  });
  it('trick raises affection capped at 100', () => {
    const o = new Owner(data({ affection: 99.5 }));
    AffectionSystem.applyAction(o, 'trick');
    expect(o.affection).toBe(100);
  });
  it('dispense picks bag above BAG_THRESHOLD with low roll', () => {
    const o = new Owner(data({ affection: 95, treatRateBase: 100 }));
    // p is huge; a very low roll -> bag
    expect(AffectionSystem.rollDispense(o, () => 0.0001)).toBe('bag');
  });
  it('dispense returns null when roll exceeds p', () => {
    const o = new Owner(data({ affection: 10, treatRateBase: 0.0001 }));
    expect(AffectionSystem.rollDispense(o, () => 0.99)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- AffectionSystem`
Expected: FAIL.

- [ ] **Step 3: Implement `src/entities/Owner.ts`**

```ts
import type { OwnerData } from '../data/owners';

export class Owner {
  id: number;
  affection: number;
  sensitivity: number;
  treatRateBase: number;
  name: string;

  constructor(d: OwnerData) {
    this.id = d.id;
    this.affection = d.affection;
    this.sensitivity = d.sensitivity;
    this.treatRateBase = d.treatRateBase;
    this.name = d.name;
  }

  get treatRateActive(): number { return this.treatRateBase * (this.affection / 25); }
}
```

- [ ] **Step 4: Implement `src/entities/Food.ts`**

```ts
import type { FoodType, TileCoord } from '../types';
import { TREAT_VALUE, BOWL_MULTIPLIER, BAG_MULTIPLIER } from '../config/constants';

export interface Food { type: FoodType; value: number; tile: TileCoord; }

export function foodValue(type: FoodType): number {
  if (type === 'bowl') return BOWL_MULTIPLIER * TREAT_VALUE;
  if (type === 'bag') return BAG_MULTIPLIER * TREAT_VALUE;
  return TREAT_VALUE;
}
```

- [ ] **Step 5: Implement `src/systems/AffectionSystem.ts`**

```ts
import type { Owner } from '../entities/Owner';
import type { FoodType } from '../types';
import {
  PEE_COST, POOP_COST, TRICK_RATE,
  BAG_LIKELIHOOD, BOWL_LIKELIHOOD, BAG_THRESHOLD, BOWL_THRESHOLD,
} from '../config/constants';

export const AffectionSystem = {
  applyAction(owner: Owner, action: 'pee' | 'poop' | 'trick'): void {
    if (action === 'pee') owner.affection = Math.max(0, owner.affection - PEE_COST * owner.sensitivity);
    else if (action === 'poop') owner.affection = Math.max(0, owner.affection - POOP_COST * owner.sensitivity);
    else if (action === 'trick') owner.affection = Math.min(100, owner.affection + TRICK_RATE);
  },

  rollDispense(owner: Owner, rand: () => number): FoodType | null {
    const p = owner.treatRateActive;
    const r = rand();
    if (r <= BAG_LIKELIHOOD * p && owner.affection > BAG_THRESHOLD) return 'bag';
    if (r <= BOWL_LIKELIHOOD * p && owner.affection > BOWL_THRESHOLD) return 'bowl';
    if (r <= p) return 'treat';
    return null;
  },
};
```

- [ ] **Step 6: Run to verify pass, then commit**

Run: `npm test -- AffectionSystem`
Expected: all PASS.

```bash
git add src/entities/Owner.ts src/entities/Food.ts src/systems/AffectionSystem.ts tests/systems/AffectionSystem.test.ts
git commit -m "feat: Owner, Food, and AffectionSystem with tests"
```

---

### Task 12: World state container + poop/pee/trick/auto-dump application (TDD)

Bundles per-tick tile mutations so scenes call one clear API.

**Files:**
- Create: `src/systems/WorldActions.ts`, `tests/systems/WorldActions.test.ts`

**Interfaces:**
- Consumes: `Grid`, `Tile`, `Husky`, `Owner`, `AffectionSystem`, constants.
- Produces `WorldActions` functions operating on a `tile`, `husky`, and `owner`:
  - `poop(husky, tile, owner): boolean` — if `husky.inv.poop > 1` and tile is grass and `tile.dirt + POOP_RATE <= POOP_MAX`: `poop -= POOP_RATE` (floored 0), `tile.dirt += POOP_RATE`, `AffectionSystem.applyAction(owner,'poop')`, return true; else false.
  - `pee(...)` — symmetric with `destruction`/`PEE_MAX`/`PEE_RATE`.
  - `trick(husky, tile, owner): boolean` — if grass and `food-TRICK_COST>0 && water-TRICK_COST>0`: subtract both, `applyAction(owner,'trick')`, true.
  - `autoDump(husky, tile, owner): void` — on entering a grass tile: if `poop >= POOP_MAX` release into tile until husky poop below max or tile full (loop applying poop); same for pee. (Deposits capped by tile capacity; affection updated per unit as in `poop`/`pee`.)

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { WorldActions } from '../../src/systems/WorldActions';
import { Husky } from '../../src/entities/Husky';
import { Owner } from '../../src/entities/Owner';
import { emptyFences } from '../../src/world/tiles';
import type { Tile } from '../../src/world/tiles';

const grass = (): Tile => ({
  col: 0, row: 0, type: 'grass', ownerId: 5, fences: emptyFences(),
  heat: 0.01, dirt: 0, destruction: 0, foodPresent: false,
});
const owner = () => new Owner({ id: 5, affection: 50, sensitivity: 1, treatRateBase: 0, name: 'T' });

describe('WorldActions', () => {
  it('poop deposits dirt and lowers affection', () => {
    const h = new Husky(); h.inv.poop = 10;
    const t = grass(); const o = owner();
    expect(WorldActions.poop(h, t, o)).toBe(true);
    expect(t.dirt).toBe(1);
    expect(h.inv.poop).toBe(9);
    expect(o.affection).toBe(49);
  });
  it('poop refused on non-grass', () => {
    const h = new Husky(); h.inv.poop = 10;
    const t = grass(); t.type = 'pavement'; const o = owner();
    expect(WorldActions.poop(h, t, o)).toBe(false);
  });
  it('trick costs food+water and raises affection', () => {
    const h = new Husky(); const t = grass(); const o = owner();
    WorldActions.trick(h, t, o);
    expect(o.affection).toBe(51);
    expect(h.inv.food).toBeCloseTo(49);
    expect(h.inv.water).toBeCloseTo(49);
  });
  it('autoDump empties maxed poop into an empty tile', () => {
    const h = new Husky(); h.inv.poop = 100; // POOP_MAX
    const t = grass(); const o = owner();
    WorldActions.autoDump(h, t, o);
    expect(h.inv.poop).toBeLessThan(100);
    expect(t.dirt).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- WorldActions`
Expected: FAIL.

- [ ] **Step 3: Implement `src/systems/WorldActions.ts`**

```ts
import type { Tile } from '../world/tiles';
import type { Husky } from '../entities/Husky';
import type { Owner } from '../entities/Owner';
import { AffectionSystem } from './AffectionSystem';
import { POOP_RATE, PEE_RATE, POOP_MAX, PEE_MAX, TRICK_COST } from '../config/constants';

export const WorldActions = {
  poop(husky: Husky, tile: Tile, owner: Owner): boolean {
    if (tile.type !== 'grass' || husky.inv.poop <= 1) return false;
    if (tile.dirt + POOP_RATE > POOP_MAX) return false;
    husky.inv.poop = Math.max(0, husky.inv.poop - POOP_RATE);
    tile.dirt += POOP_RATE;
    AffectionSystem.applyAction(owner, 'poop');
    return true;
  },
  pee(husky: Husky, tile: Tile, owner: Owner): boolean {
    if (tile.type !== 'grass' || husky.inv.pee <= 1) return false;
    if (tile.destruction + PEE_RATE > PEE_MAX) return false;
    husky.inv.pee = Math.max(0, husky.inv.pee - PEE_RATE);
    tile.destruction += PEE_RATE;
    AffectionSystem.applyAction(owner, 'pee');
    return true;
  },
  trick(husky: Husky, tile: Tile, owner: Owner): boolean {
    if (tile.type !== 'grass') return false;
    if (husky.inv.food - TRICK_COST <= 0 || husky.inv.water - TRICK_COST <= 0) return false;
    husky.inv.food -= TRICK_COST;
    husky.inv.water -= TRICK_COST;
    AffectionSystem.applyAction(owner, 'trick');
    return true;
  },
  autoDump(husky: Husky, tile: Tile, owner: Owner): void {
    if (tile.type !== 'grass') return;
    while (husky.inv.poop >= POOP_MAX && tile.dirt + POOP_RATE <= POOP_MAX) {
      this.poop(husky, tile, owner);
    }
    while (husky.inv.pee >= PEE_MAX && tile.destruction + PEE_RATE <= PEE_MAX) {
      this.pee(husky, tile, owner);
    }
  },
};
```

- [ ] **Step 4: Run to verify pass, then commit**

Run: `npm test -- WorldActions`
Expected: all PASS.

```bash
git add src/systems/WorldActions.ts tests/systems/WorldActions.test.ts
git commit -m "feat: WorldActions (poop/pee/trick/auto-dump) with tests"
```

---

### Task 13: Chihuahua AI pathfinding (TDD)

**Files:**
- Create: `src/entities/Chihuahua.ts`, `src/systems/AISystem.ts`, `tests/systems/AISystem.test.ts`

**Interfaces:**
- Consumes: `Grid`, `Direction`, `TileCoord`, `Food`.
- Produces:
  - `class Chihuahua` with `tile: TileCoord`, `facing: Direction`, `treatsEaten: number`; ctor takes a start `TileCoord`.
  - `AISystem.nextStep(grid, from: TileCoord, foods: Food[]): Direction | null` — BFS over passable tiles (using `grid.canMove`) to the nearest food tile; returns the first-step direction toward it, or `null` if none reachable.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { parseMap } from '../../src/world/MapParser';
import { Grid } from '../../src/world/Grid';
import { AISystem } from '../../src/systems/AISystem';
import type { Food } from '../../src/entities/Food';

// 1x5 open grass corridor
const grid = new Grid(parseMap('G0,G0,G0,G0,G0'));

describe('AISystem.nextStep', () => {
  it('steps toward the only food to the right', () => {
    const foods: Food[] = [{ type: 'treat', value: 10, tile: { col: 4, row: 0 } }];
    expect(AISystem.nextStep(grid, { col: 0, row: 0 }, foods)).toBe('right');
  });
  it('steps toward the nearer of two foods', () => {
    const foods: Food[] = [
      { type: 'treat', value: 10, tile: { col: 0, row: 0 } },
      { type: 'treat', value: 10, tile: { col: 4, row: 0 } },
    ];
    // starting at col 1, nearest is col 0 -> left
    expect(AISystem.nextStep(grid, { col: 1, row: 0 }, foods)).toBe('left');
  });
  it('returns null when no food', () => {
    expect(AISystem.nextStep(grid, { col: 0, row: 0 }, [])).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- AISystem`
Expected: FAIL.

- [ ] **Step 3: Implement `src/entities/Chihuahua.ts`**

```ts
import type { TileCoord, Direction } from '../types';

export class Chihuahua {
  facing: Direction = 'right';
  treatsEaten = 0;
  constructor(public tile: TileCoord) {}
}
```

- [ ] **Step 4: Implement `src/systems/AISystem.ts`**

```ts
import type { Grid } from '../world/Grid';
import type { Direction, TileCoord } from '../types';
import type { Food } from '../entities/Food';

const DIRS: Direction[] = ['up', 'down', 'left', 'right'];

export const AISystem = {
  nextStep(grid: Grid, from: TileCoord, foods: Food[]): Direction | null {
    if (foods.length === 0) return null;
    const goals = new Set(foods.map((f) => key(f.tile.col, f.tile.row)));

    // BFS storing the first-step direction taken from `from`.
    const visited = new Set<string>([key(from.col, from.row)]);
    const queue: { coord: TileCoord; firstDir: Direction | null }[] = [{ coord: from, firstDir: null }];

    while (queue.length > 0) {
      const node = queue.shift()!;
      if (node.firstDir && goals.has(key(node.coord.col, node.coord.row))) {
        return node.firstDir;
      }
      for (const dir of DIRS) {
        if (!grid.canMove(node.coord, dir)) continue;
        const nxt = grid.neighbor(node.coord, dir);
        const k = key(nxt.col, nxt.row);
        if (visited.has(k)) continue;
        visited.add(k);
        queue.push({ coord: nxt, firstDir: node.firstDir ?? dir });
      }
    }
    return null;
  },
};

function key(col: number, row: number): string { return `${col},${row}`; }
```

- [ ] **Step 5: Run to verify pass, then commit**

Run: `npm test -- AISystem`
Expected: all PASS.

```bash
git add src/entities/Chihuahua.ts src/systems/AISystem.ts tests/systems/AISystem.test.ts
git commit -m "feat: Chihuahua entity and BFS AISystem with tests"
```

---

### Task 14: Owner registry + treat dispensing over the map (TDD)

Ties owners to grass tiles and runs one dispensing pass.

**Files:**
- Create: `src/systems/OwnerRegistry.ts`, `tests/systems/OwnerRegistry.test.ts`

**Interfaces:**
- Consumes: `OWNERS`, `Owner`, `GameMap`, `Grid`, `AffectionSystem`, `Food`, `foodValue`.
- Produces:
  - `class OwnerRegistry` built from `OWNERS`: `get(id): Owner`, `all(): Owner[]`.
  - `yardCentroid(map, ownerId): TileCoord | null` — average col/row of that owner's grass tiles, rounded, snapped to an actual owned tile.
  - `dispenseOverMap(map, registry, rand, emit: (food: Food) => void): void` — for each grass tile with `!foodPresent`, roll `AffectionSystem.rollDispense(owner)`, and on a hit set `foodPresent=true` and `emit({type, value: foodValue(type), tile})`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest';
import { parseMap } from '../../src/world/MapParser';
import { OwnerRegistry, yardCentroid, dispenseOverMap } from '../../src/systems/OwnerRegistry';
import type { Food } from '../../src/entities/Food';

describe('OwnerRegistry', () => {
  it('provides owners by id', () => {
    const reg = new OwnerRegistry();
    expect(reg.get(1).name).toBe('The Grumbles');
  });
  it('computes a yard centroid over owned grass', () => {
    const map = parseMap('G7,G7,H\nG7,G7,H'); // owner 7 occupies a 2x2 block
    const c = yardCentroid(map, 7);
    expect(c).toEqual({ col: 0, row: 0 }); // rounded average of cols {0,1}, rows {0,1} = (0.5,0.5)->round->(1,1)? see note
  });
  it('dispense emits food when roll succeeds', () => {
    const map = parseMap('G2'); // owner 2
    const reg = new OwnerRegistry();
    reg.get(2).affection = 100;
    const emitted: Food[] = [];
    dispenseOverMap(map, reg, () => 0, (f) => emitted.push(f)); // roll 0 always <= p
    expect(emitted.length).toBe(1);
    expect(map.tiles[0][0].foodPresent).toBe(true);
  });
});
```

Note for centroid rounding: use `Math.round`. For cols {0,1} average 0.5 → `Math.round(0.5)=1` in JS is actually 1 (rounds half up). Adjust the expected value in the test to `{ col: 1, row: 1 }` if you use `Math.round`; then snap to nearest owned tile. Keep the test and implementation consistent — pick `Math.round` and expect `{col:1,row:1}` snapped to an owned tile (1,1 is owned).

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- OwnerRegistry`
Expected: FAIL.

- [ ] **Step 3: Implement `src/systems/OwnerRegistry.ts`**

```ts
import { OWNERS } from '../data/owners';
import { Owner } from '../entities/Owner';
import { AffectionSystem } from './AffectionSystem';
import { foodValue, type Food } from '../entities/Food';
import type { GameMap } from '../world/MapParser';
import type { TileCoord } from '../types';

export class OwnerRegistry {
  private byId = new Map<number, Owner>();
  constructor() { for (const d of OWNERS) this.byId.set(d.id, new Owner(d)); }
  get(id: number): Owner {
    const o = this.byId.get(id);
    if (!o) throw new Error(`No owner ${id}`);
    return o;
  }
  all(): Owner[] { return [...this.byId.values()]; }
}

export function yardCentroid(map: GameMap, ownerId: number): TileCoord | null {
  const owned: TileCoord[] = [];
  for (const row of map.tiles) for (const t of row) {
    if (t.type === 'grass' && t.ownerId === ownerId) owned.push({ col: t.col, row: t.row });
  }
  if (owned.length === 0) return null;
  const avgCol = owned.reduce((s, c) => s + c.col, 0) / owned.length;
  const avgRow = owned.reduce((s, c) => s + c.row, 0) / owned.length;
  // snap to the owned tile nearest the average
  let best = owned[0]; let bestD = Infinity;
  for (const c of owned) {
    const d = (c.col - avgCol) ** 2 + (c.row - avgRow) ** 2;
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

export function dispenseOverMap(
  map: GameMap, reg: OwnerRegistry, rand: () => number, emit: (food: Food) => void,
): void {
  for (const row of map.tiles) for (const t of row) {
    if (t.type !== 'grass' || t.foodPresent) continue;
    const owner = reg.get(t.ownerId);
    const type = AffectionSystem.rollDispense(owner, rand);
    if (type) {
      t.foodPresent = true;
      emit({ type, value: foodValue(type), tile: { col: t.col, row: t.row } });
    }
  }
}
```

- [ ] **Step 4: Run to verify pass, then commit**

Run: `npm test -- OwnerRegistry`
Expected: all PASS.

```bash
git add src/systems/OwnerRegistry.ts tests/systems/OwnerRegistry.test.ts
git commit -m "feat: OwnerRegistry, yard centroids, and dispensing with tests"
```

---

## PHASE 3 — Art generation

### Task 15: Generate all-new flat/vector SVG assets

Author cohesive SVG assets referencing `palette.ts` colors. All are simple flat shapes sized to `GRID.TILE` (28) for tiles, or ~24×24 for sprites. Husky needs 4 directional frames × 2 (idle + step) plus action frames.

**Files:**
- Create under `src/assets/`: `grass.svg`, `pavement.svg`, `house.svg`, `water.svg`, `fence-h.svg`, `fence-v.svg`, `treat.svg`, `bowl.svg`, `bag.svg`, and husky/chihuahua frames listed below.

**Interfaces:**
- Produces asset files by exact name; Task 16 (Preload) loads these keys:
  - Tiles: `grass`, `pavement`, `house`, `water`, `fenceH`, `fenceV`
  - Food: `treat`, `bowl`, `bag`
  - Husky frames (each 24×24): `husky-<dir>-0`, `husky-<dir>-1` for `dir in {up,down,left,right}`; `husky-poop`, `husky-pee`, `husky-trick`, `husky-idle`
  - Chihuahua frames: `chi-<dir>-0`, `chi-<dir>-1`

- [ ] **Step 1: Create tile SVGs** (example `src/assets/grass.svg`; author the rest analogously using PALETTE hexes)

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28">
  <rect width="28" height="28" fill="#6aa84f"/>
  <g fill="#5f9a47" opacity="0.6">
    <rect x="4" y="6" width="2" height="4"/>
    <rect x="12" y="14" width="2" height="4"/>
    <rect x="20" y="9" width="2" height="4"/>
    <rect x="8" y="20" width="2" height="4"/>
    <rect x="22" y="21" width="2" height="4"/>
  </g>
</svg>
```

`pavement.svg`: base `#cdbb9a` with a subtle `#b7a482` speckle and a 1px edge. `water.svg`: base `#5fc4d0` with two lighter ripple arcs. `house.svg`: `#f2ede0` wall filling the tile, a `#c0563a` roof band across the top third, and a soft `#00000022` bottom-right shadow. `fence-h.svg`: 28×4 plank strip `#8a5a2b` with 2 vertical post ticks. `fence-v.svg`: 4×28 rotated equivalent.

- [ ] **Step 2: Create food SVGs**

`treat.svg` (16×16): a bone shape in `#d98a3d`. `bowl.svg` (18×18): a `#c0563a` bowl with `#d98a3d` kibble mound. `bag.svg` (18×20): a `#8a5a2b` sack with a folded top and a small paw label.

- [ ] **Step 3: Create husky directional frames** (example `src/assets/husky-right-0.svg`; make `-1` a slight leg/tail shift for the walk cycle)

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
  <ellipse cx="12" cy="20" rx="8" ry="2.5" fill="#00000022"/>
  <rect x="5" y="8" width="14" height="9" rx="4" fill="#5a5a66"/>
  <rect x="6" y="12" width="12" height="5" rx="2.5" fill="#e8e8ee"/>
  <circle cx="18" cy="9" r="4" fill="#5a5a66"/>
  <circle cx="19.5" cy="8.5" r="1" fill="#111"/>
  <rect x="16" y="4.5" width="3" height="3" rx="1" fill="#3f3f4a"/>
  <rect x="6" y="16" width="2.5" height="4" rx="1" fill="#3f3f4a"/>
  <rect x="14" y="16" width="2.5" height="4" rx="1" fill="#3f3f4a"/>
  <rect x="2" y="9" width="4" height="2.5" rx="1.25" fill="#3f3f4a"/> <!-- tail -->
</svg>
```

Create `husky-left-*` (mirror), `husky-up-*` (back view: tail toward viewer, ears up), `husky-down-*` (front view: face + two eyes). `husky-idle` = `husky-down-0`. `husky-poop` = crouched down-view. `husky-pee` = leg-lifted side view. `husky-trick` = belly-up/star pose. Keep all on the same palette and 24×24 canvas.

- [ ] **Step 4: Create chihuahua frames** — same structure, smaller body (18×18 content), coat `#c9915a`, bigger ears, thinner legs. Files `chi-<dir>-0/1`.

- [ ] **Step 5: Visual check** — open a few SVGs in the browser to confirm they render as intended.

- [ ] **Step 6: Commit**

```bash
git add src/assets
git commit -m "art: generate cohesive flat/vector SVG asset set"
```

---

## PHASE 4 — Rendering & gameplay (Phaser)

### Task 16: PreloadScene loads all assets

**Files:**
- Create: `src/scenes/PreloadScene.ts`
- Modify: `src/main.ts` (register scenes; Boot → Preload)

**Interfaces:**
- Consumes: asset files (Task 15).
- Produces: `PreloadScene` (key `'Preload'`) that loads every texture key, then starts `'Menu'`.

- [ ] **Step 1: Implement `src/scenes/PreloadScene.ts`**

```ts
import Phaser from 'phaser';

const DIRS = ['up', 'down', 'left', 'right'] as const;

export class PreloadScene extends Phaser.Scene {
  constructor() { super('Preload'); }

  preload() {
    const svg = (key: string, path: string, w: number, h: number) =>
      this.load.svg(key, path, { width: w, height: h });

    svg('grass', new URL('../assets/grass.svg', import.meta.url).href, 28, 28);
    svg('pavement', new URL('../assets/pavement.svg', import.meta.url).href, 28, 28);
    svg('house', new URL('../assets/house.svg', import.meta.url).href, 28, 28);
    svg('water', new URL('../assets/water.svg', import.meta.url).href, 28, 28);
    svg('fenceH', new URL('../assets/fence-h.svg', import.meta.url).href, 28, 4);
    svg('fenceV', new URL('../assets/fence-v.svg', import.meta.url).href, 4, 28);
    svg('treat', new URL('../assets/treat.svg', import.meta.url).href, 16, 16);
    svg('bowl', new URL('../assets/bowl.svg', import.meta.url).href, 18, 18);
    svg('bag', new URL('../assets/bag.svg', import.meta.url).href, 18, 20);

    for (const d of DIRS) {
      svg(`husky-${d}-0`, new URL(`../assets/husky-${d}-0.svg`, import.meta.url).href, 24, 24);
      svg(`husky-${d}-1`, new URL(`../assets/husky-${d}-1.svg`, import.meta.url).href, 24, 24);
      svg(`chi-${d}-0`, new URL(`../assets/chi-${d}-0.svg`, import.meta.url).href, 20, 20);
      svg(`chi-${d}-1`, new URL(`../assets/chi-${d}-1.svg`, import.meta.url).href, 20, 20);
    }
    for (const a of ['poop', 'pee', 'trick', 'idle']) {
      svg(`husky-${a}`, new URL(`../assets/husky-${a}.svg`, import.meta.url).href, 24, 24);
    }
  }

  create() { this.scene.start('Menu'); }
}
```

- [ ] **Step 2: Update `src/main.ts` scene list**

```ts
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MenuScene } from './scenes/MenuScene';
import { GameScene } from './scenes/GameScene';
import { UIScene } from './scenes/UIScene';
import { GameOverScene } from './scenes/GameOverScene';
import { InstructionsScene } from './scenes/InstructionsScene';
// scene: [BootScene, PreloadScene, MenuScene, InstructionsScene, GameScene, UIScene, GameOverScene]
```

Update `BootScene.create()` to `this.scene.start('Preload');`. (Menu/Game/UI/GameOver/Instructions scenes are created in later tasks; for now create minimal empty placeholder classes so the import list compiles — each a `Phaser.Scene` with its key and an empty `create`. They are fleshed out in Tasks 17–24.)

- [ ] **Step 3: Run**

Run: `npm run dev`
Expected: Boot → Preload → empty Menu placeholder with no console errors; textures loaded.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/PreloadScene.ts src/main.ts src/scenes/BootScene.ts
git commit -m "feat: PreloadScene loads all SVG assets"
```

---

### Task 17: GameScene renders the map + fences

**Files:**
- Create/replace: `src/scenes/GameScene.ts`

**Interfaces:**
- Consumes: `parseMap`, `Grid`, `mapCsv` (`import mapCsv from '../data/map.csv?raw'`), texture keys.
- Produces: `GameScene` (key `'Game'`) with `grid: Grid` and a `render map` that blits one image per tile plus fence overlays. Establishes `this.grassColor(tile)` helper used later for tinting.

- [ ] **Step 1: Implement map rendering**

```ts
import Phaser from 'phaser';
import mapCsv from '../data/map.csv?raw';
import { parseMap, type GameMap } from '../world/MapParser';
import { Grid } from '../world/Grid';
import { GRID } from '../config/constants';
import type { Tile } from '../world/tiles';

export class GameScene extends Phaser.Scene {
  private map!: GameMap;
  grid!: Grid;
  private tileSprites: Phaser.GameObjects.Image[][] = [];

  constructor() { super('Game'); }

  create() {
    this.map = parseMap(mapCsv);
    this.grid = new Grid(this.map);
    this.renderMap();
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
```

- [ ] **Step 2: Run**

Run: `npm run dev` and from Menu placeholder call GameScene (temporarily set `BootScene`/Menu to `this.scene.start('Game')` for this check, then revert).
Expected: the full neighborhood renders — matches the V1 screenshot layout (houses, yards, pavement roads, corner water), with fences on yard edges.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/GameScene.ts
git commit -m "feat: GameScene renders map tiles and fences"
```

---

### Task 18: Husky sprite, input, and tween movement on the sim tick

**Files:**
- Modify: `src/scenes/GameScene.ts`

**Interfaces:**
- Consumes: `Husky`, `ResourceSystem`, `WorldActions`, `OwnerRegistry`, `Grid`, constants (`SIM_HZ`).
- Produces: on `GameScene`: `husky: Husky`, `huskySprite`, a fixed-timestep accumulator calling `simTick()` at `SIM_HZ`, keyboard handlers, and a tween per step.

- [ ] **Step 1: Add husky + input + sim loop to `GameScene`**

```ts
// add imports
import { Husky } from '../entities/Husky';
import { ResourceSystem } from '../systems/ResourceSystem';
import { WorldActions } from '../systems/WorldActions';
import { OwnerRegistry } from '../systems/OwnerRegistry';
import { SIM_HZ } from '../config/constants';
import type { Direction } from '../types';

// fields on GameScene:
//   husky!: Husky; private huskySprite!: Phaser.GameObjects.Image;
//   private registry = new OwnerRegistry();
//   private held: Record<Direction, boolean> = { up:false,down:false,left:false,right:false };
//   private moving = false;
//   private acc = 0; private readonly step = 1000 / SIM_HZ;
//   private action: 'drink'|'poop'|'pee'|'trick'|null = null;

// in create(), after renderMap():
//   this.husky = new Husky();
//   const p = this.grid.tileToPixel(this.husky.tile);
//   this.huskySprite = this.add.image(p.x, p.y, 'husky-left-0').setDepth(10);
//   this.bindInput();

private bindInput() {
  const kb = this.input.keyboard!;
  const map: Record<string, Direction> = { W: 'up', S: 'down', A: 'left', D: 'right' };
  for (const [k, dir] of Object.entries(map)) {
    kb.addKey(k).on('down', () => { this.held[dir] = true; this.husky.facing = dir; });
    kb.addKey(k).on('up', () => { this.held[dir] = false; });
  }
  kb.addKey('Q').on('down', () => { this.action = 'drink'; });
  kb.addKey('Q').on('up', () => { if (this.action==='drink') this.action = null; });
  kb.addKey('C').on('down', () => { this.action = 'poop'; });
  kb.addKey('Z').on('down', () => { this.action = 'pee'; });
  kb.addKey('E').on('down', () => { this.action = 'trick'; });
  for (const k of ['C','Z','E']) kb.addKey(k).on('up', () => { this.action = null; });
}

update(_t: number, delta: number) {
  this.acc += delta;
  while (this.acc >= this.step) { this.acc -= this.step; this.simTick(); }
}

private currentTile() { return this.map.tiles[this.husky.tile.row][this.husky.tile.col]; }

private simTick() {
  // 1) movement
  const dir = (['up','down','left','right'] as Direction[]).find((d) => this.held[d]);
  if (dir && !this.moving && this.grid.canMove(this.husky.tile, dir)) {
    const to = this.grid.neighbor(this.husky.tile, dir);
    this.husky.tile = to;
    ResourceSystem.applyMoveCost(this.husky.inv);
    this.moving = true;
    const p = this.grid.tileToPixel(to);
    this.tweens.add({ targets: this.huskySprite, x: p.x, y: p.y, duration: this.step,
      onComplete: () => { this.moving = false; this.onEnterTile(); } });
  }
  this.huskySprite.setTexture(`husky-${this.husky.facing}-${(Math.floor(performance.now()/120)%2)}`);

  // 2) heat every tick (even standing)
  ResourceSystem.applyHeat(this.husky.inv, this.currentTile().heat);

  // 3) standing actions
  const tile = this.currentTile();
  const owner = this.registry.get(tile.ownerId);
  if (this.action === 'poop') WorldActions.poop(this.husky, tile, owner);
  else if (this.action === 'pee') WorldActions.pee(this.husky, tile, owner);
  else if (this.action === 'trick') WorldActions.trick(this.husky, tile, owner);
  else if (this.action === 'drink' && this.nearWater()) ResourceSystem.drink(this.husky.inv);
}

private onEnterTile() {
  const tile = this.currentTile();
  WorldActions.autoDump(this.husky, tile, this.registry.get(tile.ownerId));
  // food pickup handled in Task 20
}

private nearWater(): boolean {
  const { col, row } = this.husky.tile;
  for (const [dc, dr] of [[0,0],[1,0],[-1,0],[0,1],[0,-1]]) {
    const t = this.grid.tileAt(col+dc, row+dr);
    if (t && t.type === 'water') return true;
  }
  return false;
}
```

- [ ] **Step 2: Run and verify feel**

Run: `npm run dev` (temporarily start Game directly)
Expected: husky glides tile-to-tile on WASD, stops at houses/fences, cannot leave the map. No treats yet.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/GameScene.ts
git commit -m "feat: husky sprite with tweened tile movement and input"
```

---

### Task 19: Food dispensing, rendering, and pickup

**Files:**
- Modify: `src/scenes/GameScene.ts`

**Interfaces:**
- Consumes: `dispenseOverMap`, `Food`, food texture keys.
- Produces: on `GameScene`: `foods: Food[]`, `foodSprites: Map<string, Image>`, dispensing inside `simTick`, and pickup in `onEnterTile`.

- [ ] **Step 1: Add food handling**

```ts
// fields: private foods: Food[] = []; private foodSprites = new Map<string, Phaser.GameObjects.Image>();
import { dispenseOverMap } from '../systems/OwnerRegistry';
import type { Food } from '../entities/Food';

// in simTick(), after actions:
dispenseOverMap(this.map, this.registry, Math.random, (food) => {
  this.foods.push(food);
  const p = this.grid.tileToPixel(food.tile);
  const spr = this.add.image(p.x, p.y, food.type).setDepth(8);
  this.foodSprites.set(this.fkey(food.tile.col, food.tile.row), spr);
});

private fkey(c: number, r: number) { return `${c},${r}`; }

// in onEnterTile(), before autoDump:
const key = this.fkey(this.husky.tile.col, this.husky.tile.row);
const idx = this.foods.findIndex((f) => f.tile.col === this.husky.tile.col && f.tile.row === this.husky.tile.row);
if (idx !== -1) {
  const food = this.foods.splice(idx, 1)[0];
  ResourceSystem.eatFood(this.husky.inv, food.value);
  this.husky.treatsEaten += 1;
  this.currentTile().foodPresent = false;
  this.foodSprites.get(key)?.destroy();
  this.foodSprites.delete(key);
}
```

- [ ] **Step 2: Run**

Expected: treats/bowls/bags appear on yards over time (more on high-affection yards); walking over one removes it and food goes up.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/GameScene.ts
git commit -m "feat: treat dispensing, rendering, and pickup"
```

---

### Task 20: Grass tint updates + chihuahua adversary

**Files:**
- Modify: `src/scenes/GameScene.ts`

**Interfaces:**
- Consumes: `Chihuahua`, `AISystem`, chi texture keys.
- Produces: on `GameScene`: `chihuahua: Chihuahua`, `chiSprite`, chi movement inside `simTick` (own move timer), chi eating, and re-tinting grass on poop/pee.

- [ ] **Step 1: Re-tint grass after mutation** — after the actions block in `simTick`, refresh the current tile's tint if grass:

```ts
if (tile.type === 'grass') this.tileSprites[tile.row][tile.col].setTint(this.grassColor(tile));
```

- [ ] **Step 2: Add chihuahua** (spawns opposite corner, steps every 2 sim ticks)

```ts
// fields: chihuahua!: Chihuahua; private chiSprite!: Phaser.GameObjects.Image;
//         private chiMoving = false; private chiCounter = 0;
import { Chihuahua } from '../entities/Chihuahua';
import { AISystem } from '../systems/AISystem';

// in create(): after husky
this.chihuahua = new Chihuahua({ col: 2, row: 2 });
const cp = this.grid.tileToPixel(this.chihuahua.tile);
this.chiSprite = this.add.image(cp.x, cp.y, 'chi-right-0').setDepth(9);

// in simTick(): chihuahua logic (every 2nd tick)
this.chiCounter = (this.chiCounter + 1) % 2;
if (this.chiCounter === 0 && !this.chiMoving) {
  const dir = AISystem.nextStep(this.grid, this.chihuahua.tile, this.foods);
  if (dir) {
    this.chihuahua.facing = dir;
    const to = this.grid.neighbor(this.chihuahua.tile, dir);
    this.chihuahua.tile = to;
    this.chiMoving = true;
    const p = this.grid.tileToPixel(to);
    this.tweens.add({ targets: this.chiSprite, x: p.x, y: p.y, duration: this.step * 2,
      onComplete: () => { this.chiMoving = false; this.chiEat(); } });
  }
}
this.chiSprite.setTexture(`chi-${this.chihuahua.facing}-${(Math.floor(performance.now()/160)%2)}`);

private chiEat() {
  const idx = this.foods.findIndex((f) => f.tile.col === this.chihuahua.tile.col && f.tile.row === this.chihuahua.tile.row);
  if (idx !== -1) {
    const food = this.foods.splice(idx, 1)[0];
    this.chihuahua.treatsEaten += 1;
    const t = this.map.tiles[food.tile.row][food.tile.col];
    t.foodPresent = false;
    const key = this.fkey(food.tile.col, food.tile.row);
    this.foodSprites.get(key)?.destroy();
    this.foodSprites.delete(key);
  }
}
```

- [ ] **Step 3: Run**

Expected: chihuahua roams toward the nearest treat and snatches it (it vanishes, chihuahua's count rises); grass shifts color as you poop/pee.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/GameScene.ts
git commit -m "feat: chihuahua adversary and live grass tinting"
```

---

### Task 21: Countdown timer, sim-time, and game-over detection

**Files:**
- Modify: `src/scenes/GameScene.ts`

**Interfaces:**
- Consumes: `GAME_SECONDS`, `TICKS_PER_SECOND`, `ResourceSystem.isGameOver`.
- Produces: on `GameScene`: `secondsLeft`, per-second decrement, and a `endGame(reason)` that stops the sim and starts `GameOver` with a payload. Emits HUD data via registry-independent `getHudState()` (Task 22 consumes it).

- [ ] **Step 1: Add timer + game-over**

```ts
// fields: private secondsLeft = GAME_SECONDS; private tickInSecond = 0; private over = false;
import { GAME_SECONDS, TICKS_PER_SECOND } from '../config/constants';

// at TOP of simTick(): if (this.over) return;

// near end of simTick():
this.tickInSecond = (this.tickInSecond + 1) % TICKS_PER_SECOND;
if (this.tickInSecond === 0) {
  this.secondsLeft -= 1;
  if (this.secondsLeft <= 0) return this.endGame('Time');
}
const go = ResourceSystem.isGameOver(this.husky.inv);
if (go) return this.endGame(go);

private endGame(reason: 'Time' | 'Food' | 'Water') {
  this.over = true;
  this.scene.stop('UI');
  this.scene.start('GameOver', {
    reason,
    huskyTreats: this.husky.treatsEaten,
    chiTreats: this.chihuahua.treatsEaten,
  });
}
```

- [ ] **Step 2: Run**

Expected: game ends with a transition when food or water hits 0 (drain by moving/heat) — timer path verified later once HUD shows the clock.

- [ ] **Step 3: Commit**

```bash
git add src/scenes/GameScene.ts
git commit -m "feat: countdown timer and game-over detection"
```

---

## PHASE 5 — HUD & profiles

### Task 22: UIScene with status bars, timer, current-space, score

**Files:**
- Create/replace: `src/scenes/UIScene.ts`
- Modify: `src/scenes/GameScene.ts` (launch UI in parallel; expose `getHudState()`)

**Interfaces:**
- Consumes: from `GameScene` a `getHudState()` returning `{ food, water, poop, pee, secondsLeft, huskyTreats, chiTreats, currentTile: { heat, dirt, destruction } }`.
- Produces: `UIScene` (key `'UI'`) drawing the HUD strip below the map each frame.

- [ ] **Step 1: Add `getHudState()` to `GameScene` and launch UI**

```ts
// in create(): this.scene.launch('UI');
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
```

- [ ] **Step 2: Implement `src/scenes/UIScene.ts`**

```ts
import Phaser from 'phaser';
import { PALETTE } from '../config/palette';
import { DESIGN_HEIGHT } from '../main';
import { GRID, WATER_MAX } from '../config/constants';
import type { GameScene } from './GameScene';

export class UIScene extends Phaser.Scene {
  private g!: Phaser.GameObjects.Graphics;
  private texts: Record<string, Phaser.GameObjects.Text> = {};
  constructor() { super('UI'); }

  create() {
    const y0 = DESIGN_HEIGHT;
    this.add.rectangle(0, y0, GRID.COLS * GRID.TILE, 140, 0x000000).setOrigin(0, 0)
      .setFillStyle(Phaser.Display.Color.HexStringToColor(PALETTE.hudBg).color);
    this.g = this.add.graphics();
    const mk = (k: string, x: number, y: number) => {
      this.texts[k] = this.add.text(x, y, '', { color: PALETTE.hudText, fontSize: '14px' });
    };
    mk('timer', 16, y0 + 10); mk('foodL', 120, y0 + 10); mk('waterL', 120, y0 + 34);
    mk('poopL', 120, y0 + 58); mk('peeL', 120, y0 + 82);
    mk('space', 16, y0 + 40); mk('score', 16, y0 + 100);
  }

  update() {
    const gs = this.scene.get('Game') as GameScene;
    if (!gs || !(gs as any).getHudState) return;
    const s = gs.getHudState();
    const y0 = DESIGN_HEIGHT;
    this.g.clear();
    const bar = (y: number, val: number, max: number, color: string) => {
      const w = 220;
      this.g.fillStyle(0x000000, 0.4).fillRect(340, y, w, 16);
      this.g.fillStyle(Phaser.Display.Color.HexStringToColor(color).color, 1)
        .fillRect(340, y, Math.max(0, Math.min(1, val / max)) * w, 16);
    };
    bar(y0 + 12, s.food, 100, PALETTE.treat);
    bar(y0 + 36, s.water, WATER_MAX / 8, PALETTE.water);
    bar(y0 + 60, s.poop, 100, PALETTE.fence);
    bar(y0 + 84, s.pee, 100, PALETTE.affection);
    this.texts.foodL.setText(`🍖 Food ${s.food.toFixed(0)}`);
    this.texts.waterL.setText(`💧 Water ${s.water.toFixed(0)}`);
    this.texts.poopL.setText(`💩 Poop ${s.poop.toFixed(0)}`);
    this.texts.peeL.setText(`🟡 Pee ${s.pee.toFixed(0)}`);
    const mm = Math.floor(s.secondsLeft / 60), ss = s.secondsLeft % 60;
    this.texts.timer.setText(`⏰ ${mm}:${ss.toString().padStart(2, '0')}`);
    this.texts.space.setText(`Heat ${s.currentTile.heat}  Poop ${s.currentTile.dirt}  Pee ${s.currentTile.destruction}`);
    this.texts.score.setText(`🐺 You ${s.huskyTreats}   🐕 Rival ${s.chiTreats}`);
  }
}
```

- [ ] **Step 3: Run**

Expected: HUD strip shows live status bars with icons, mm:ss timer counting down, current-space readout, and the you-vs-rival score.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/UIScene.ts src/scenes/GameScene.ts
git commit -m "feat: UIScene HUD with status bars, timer, and score"
```

---

### Task 23: Household profile badges + contextual detail panel

**Files:**
- Create: `src/ui/HouseholdProfile.ts`
- Modify: `src/scenes/GameScene.ts` (spawn badges), `src/scenes/UIScene.ts` (detail panel)

**Interfaces:**
- Consumes: `yardCentroid`, `OwnerRegistry`, `Grid`.
- Produces: `createBadges(scene, map, registry, grid)` placing a small name + affection-heart meter at each owner's centroid (owners 1–19); `updateBadges()` refreshing the meters. UIScene detail panel reads `getHudState().currentTile.ownerId`.

- [ ] **Step 1: Implement `src/ui/HouseholdProfile.ts`**

```ts
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
```

- [ ] **Step 2: Wire into GameScene** — in `create()` after entities: `this.badges = createBadges(this, this.map, this.registry, this.grid);` and in `simTick()` (throttled, every 5 ticks) `updateBadges(this.badges, this.registry);`

- [ ] **Step 3: Detail panel in UIScene** — add a text object; each `update()` set it to the current yard's `name / tolerance (sensitivity) / affection` via a `getOwnerInfo(ownerId)` helper added to GameScene returning `{ name, sensitivity, affection }` from `this.registry`.

```ts
// GameScene:
getOwnerInfo(id: number) {
  const o = this.registry.get(id);
  return { name: o.name, sensitivity: o.sensitivity, affection: o.affection };
}
// UIScene.update(): const info = gs.getOwnerInfo(s.currentTile.ownerId);
// this.texts.profile.setText(`${info.name}  •  tolerance ${info.sensitivity}  •  likes you ${info.affection.toFixed(0)}`);
```

- [ ] **Step 4: Run**

Expected: each yard shows the occupant name + a heart-colored affection meter that shifts as you trick/poop/pee; the HUD names the yard you're standing on with its tolerance and current like level.

- [ ] **Step 5: Commit**

```bash
git add src/ui/HouseholdProfile.ts src/scenes/GameScene.ts src/scenes/UIScene.ts
git commit -m "feat: household profile badges and contextual detail panel"
```

---

## PHASE 6 — Menus & flow

### Task 24: MenuScene and InstructionsScene

**Files:**
- Create/replace: `src/scenes/MenuScene.ts`, `src/scenes/InstructionsScene.ts`

**Interfaces:**
- Produces: `MenuScene` (key `'Menu'`) with Start / How to Play / Credits; `InstructionsScene` (key `'Instructions'`) showing controls + goal, returning to Menu.

- [ ] **Step 1: Implement `src/scenes/MenuScene.ts`**

```ts
import Phaser from 'phaser';
import { PALETTE } from '../config/palette';

export class MenuScene extends Phaser.Scene {
  constructor() { super('Menu'); }
  create() {
    const cx = this.scale.width / 2;
    this.cameras.main.setBackgroundColor(PALETTE.grassBase);
    this.add.text(cx, 120, 'Husky Simulator', { fontSize: '48px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(cx, 180, 'Escape the yard. Gather treats. Beat the rival.', { fontSize: '18px', color: '#ffffff' }).setOrigin(0.5);
    const btn = (y: number, label: string, fn: () => void) => {
      const t = this.add.text(cx, y, label, { fontSize: '28px', color: PALETTE.hudText, backgroundColor: PALETTE.hudBg, padding: { x: 20, y: 10 } })
        .setOrigin(0.5).setInteractive({ useHandCursor: true });
      t.on('pointerover', () => t.setColor('#ffd27f'));
      t.on('pointerout', () => t.setColor(PALETTE.hudText));
      t.on('pointerdown', fn);
    };
    btn(300, 'Start', () => { this.scene.start('Game'); });
    btn(370, 'How to Play', () => { this.scene.start('Instructions'); });
    btn(440, 'Credits', () => { this.scene.start('Instructions'); }); // credits shown on instructions page footer
  }
}
```

- [ ] **Step 2: Implement `src/scenes/InstructionsScene.ts`**

```ts
import Phaser from 'phaser';
import { PALETTE } from '../config/palette';

export class InstructionsScene extends Phaser.Scene {
  constructor() { super('Instructions'); }
  create() {
    const cx = this.scale.width / 2;
    this.cameras.main.setBackgroundColor(PALETTE.hudBg);
    this.add.text(cx, 80, 'How to Play', { fontSize: '40px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
    const lines = [
      'You are a husky loose in the neighborhood on a hot day.',
      'Gather as many treats as you can before your owner gets home (timer).',
      '',
      'WASD — move (burns food + water; pavement bakes off water fastest)',
      'Q — drink at water tiles     E — do a trick (raises a yard\'s affection)',
      'C — poop     Z — pee   (lowers affection; sensitive yards drop faster)',
      '',
      'High-affection yards drop more — and bowls/bags, not just treats.',
      'Watch out: a rival chihuahua is snatching treats too!',
      '',
      'Credits: Original game by Logan. Modernized 2026.',
    ];
    this.add.text(cx, 300, lines.join('\n'), { fontSize: '18px', color: '#ffffff', align: 'center', lineSpacing: 6 }).setOrigin(0.5);
    const back = this.add.text(cx, 620, 'Back', { fontSize: '26px', color: PALETTE.hudText, backgroundColor: PALETTE.grassBase, padding: { x: 18, y: 8 } })
      .setOrigin(0.5).setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this.scene.start('Menu'));
  }
}
```

- [ ] **Step 3: Run**

Expected: Menu with working buttons; Instructions page readable; Back returns to Menu; Start launches the game.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/MenuScene.ts src/scenes/InstructionsScene.ts
git commit -m "feat: menu and instructions scenes"
```

---

### Task 25: GameOverScene with score and play-again

**Files:**
- Create/replace: `src/scenes/GameOverScene.ts`

**Interfaces:**
- Consumes: init payload `{ reason, huskyTreats, chiTreats }` from `GameScene.endGame`.
- Produces: `GameOverScene` (key `'GameOver'`) showing reason + scores; "Play Again" restarts a fresh `Game` (+ `UI`); "Main Menu" returns to Menu.

- [ ] **Step 1: Implement `src/scenes/GameOverScene.ts`**

```ts
import Phaser from 'phaser';
import { PALETTE } from '../config/palette';

interface Gmeta { reason: 'Time' | 'Food' | 'Water'; huskyTreats: number; chiTreats: number; }

export class GameOverScene extends Phaser.Scene {
  private meta!: Gmeta;
  constructor() { super('GameOver'); }
  init(data: Gmeta) { this.meta = data; }
  create() {
    const cx = this.scale.width / 2;
    this.cameras.main.setBackgroundColor(PALETTE.hudBg);
    const reasonText: Record<Gmeta['reason'], string> = {
      Time: 'Your owner came home!', Food: 'You ran out of food!', Water: 'You ran out of water!',
    };
    this.add.text(cx, 140, 'Game Over', { fontSize: '48px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
    this.add.text(cx, 210, reasonText[this.meta.reason], { fontSize: '24px', color: '#ffffff' }).setOrigin(0.5);
    const won = this.meta.huskyTreats >= this.meta.chiTreats;
    this.add.text(cx, 290, `You gathered ${this.meta.huskyTreats} treats`, { fontSize: '26px', color: '#ffffff' }).setOrigin(0.5);
    this.add.text(cx, 330, `The rival chihuahua got ${this.meta.chiTreats}`, { fontSize: '20px', color: '#dddddd' }).setOrigin(0.5);
    this.add.text(cx, 380, won ? 'You win! 🏆' : 'The rival won this time…', { fontSize: '28px', color: won ? '#ffd27f' : '#ff8a8a' }).setOrigin(0.5);
    const btn = (y: number, label: string, fn: () => void) => {
      const t = this.add.text(cx, y, label, { fontSize: '26px', color: PALETTE.hudText, backgroundColor: PALETTE.grassBase, padding: { x: 18, y: 8 } })
        .setOrigin(0.5).setInteractive({ useHandCursor: true });
      t.on('pointerdown', fn);
    };
    btn(460, 'Play Again', () => { this.scene.start('Game'); });
    btn(520, 'Main Menu', () => { this.scene.start('Menu'); });
  }
}
```

- [ ] **Step 2: Ensure clean restart** — In `GameScene.create()`, reset all per-run fields (arrays, maps, flags, `secondsLeft`, `over=false`) at the top so "Play Again" starts fresh. Verify `this.scene.launch('UI')` runs on each start and old UI is stopped in `endGame`.

- [ ] **Step 3: Run**

Expected: reaching a game-over shows the summary; Play Again resets cleanly (fresh map, full resources, timer reset); Main Menu returns to title.

- [ ] **Step 4: Commit**

```bash
git add src/scenes/GameOverScene.ts src/scenes/GameScene.ts
git commit -m "feat: game-over scene with score and play-again"
```

---

## PHASE 7 — Ship

### Task 26: Production build, README, and Pages verification

**Files:**
- Create: `README.md`
- Verify: `.github/workflows/deploy.yml` (Task 3)

- [ ] **Step 1: Production build**

Run: `npm run build`
Expected: `tsc --noEmit` passes with zero type errors; `dist/` produced.

- [ ] **Step 2: Preview the built bundle**

Run: `npm run preview`
Expected: full game playable from the built output at the previewed URL.

- [ ] **Step 3: Write `README.md`**

```markdown
# Husky Simulator

A top-down neighborhood treat-gathering game. Play as a husky loose on a hot
summer day — gather treats before your owner comes home, manage food/water
(and the poop/pee they become), win over households, and beat the rival
chihuahua.

## Develop
- `npm install`
- `npm run dev` — local dev server
- `npm test` — unit tests
- `npm run build` — production build to `dist/`

## Controls
WASD move · Q drink · E trick · C poop · Z pee

## Deploy (GitHub Pages)
Pushing to `main` runs `.github/workflows/deploy.yml`, which builds and
publishes `dist/` to Pages. One-time: repo Settings → Pages → Source = "GitHub
Actions". The site serves under `/husky-simulator/` (set by `vite.config.ts`
`base`); rename there if the repo name differs.
```

- [ ] **Step 4: Full unit-test run**

Run: `npm test`
Expected: all suites pass.

- [ ] **Step 5: Commit and push**

```bash
git add README.md
git commit -m "docs: add README with dev and deploy instructions"
git push -u origin main
```

- [ ] **Step 6: Enable Pages** — in the GitHub repo: Settings → Pages → Source = "GitHub Actions". Confirm the deploy workflow runs green and the site loads and is playable.

---

## Self-Review Notes (author checklist — completed)

- **Spec coverage:** map verbatim (T8) · block parsing (T7) · tile-discrete 10 Hz sim + smooth tween (T18) · edge-aware collision (T9) · resources/heat/game-over (T10, T21) · affection + dispensing + thresholds (T11, T14) · auto-dump (T12) · chihuahua BFS AI + score (T13, T20, T22) · menus/instructions/game-over/play-again (T24, T25) · household badges + detail panel + centroids (T23, T14) · all-new SVG art + grass tint (T15, T17, T20) · status bars w/ icons (T22) · Pages deploy (T3, T26). All spec sections map to a task.
- **Placeholders:** none — every code step carries full code.
- **Type consistency:** `Tile`, `GameMap`, `Grid`, `Husky.inv`, `Owner.affection`, `Food{type,value,tile}`, `AISystem.nextStep`, `getHudState()` shape, and `endGame` payload are used consistently across producing/consuming tasks.
