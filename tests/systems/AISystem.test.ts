import { describe, it, expect, afterEach } from 'vitest';
import { parseMap } from '../../src/world/MapParser';
import { Grid } from '../../src/world/Grid';
import {
  nextBanditMove,
  bestSmelledFood,
  bestFoodAnywhere,
  smellRadius,
  isThirsty,
  patrolStep,
  banditTweenDuration,
  rankRelieveTargets,
  canFoulTile,
  banditGoalLabel,
  firstReachableRelieveTarget,
  bfsFirstStep,
  type Bandit,
  type RelieveTarget,
} from '../../src/systems/AISystem';
import { emptyFences, type Tile } from '../../src/world/tiles';
import { config, resetConfig } from '../../src/config/gameConfig';
import { banditSettings, resetBanditSettings } from '../../src/config/banditMode';
import type { Food } from '../../src/entities/Food';
import type { Inventory, TileCoord } from '../../src/types';

afterEach(() => {
  resetConfig();
  resetBanditSettings();
});

const fullInv = (): Inventory => ({ food: 50, water: 50, poop: 0, pee: 0 });
const bandit = (col: number, over: Partial<Bandit> = {}): Bandit => ({
  tile: { col, row: 0 },
  inv: fullInv(),
  facing: 'right',
  ...over,
});

// 1x13 open grass corridor.
const grid = new Grid(parseMap(Array(13).fill('G0').join(',')));
// A pavement street (col 1) flanked by grass yards, 3 rows tall.
const streetGrid = new Grid(parseMap(['G0,P0,G0', 'G0,P0,G0', 'G0,P0,G0'].join('\n')));

describe('smellRadius', () => {
  it('pupcup > bag > bowl > treat', () => {
    expect(smellRadius('pupcup')).toBe(config.SMELL_PUPCUP);
    expect(smellRadius('bag')).toBe(config.SMELL_BAG);
    expect(smellRadius('bowl')).toBe(config.SMELL_BOWL);
    expect(smellRadius('treat')).toBe(config.SMELL_TREAT);
    expect(config.SMELL_PUPCUP).toBeGreaterThan(config.SMELL_BAG);
    expect(config.SMELL_BAG).toBeGreaterThan(config.SMELL_BOWL);
    expect(config.SMELL_BOWL).toBeGreaterThan(config.SMELL_TREAT);
  });
});

describe('bestSmelledFood', () => {
  it('ignores food beyond its smell radius', () => {
    const foods: Food[] = [{ type: 'treat', value: 10, tile: { col: 10, row: 0 } }]; // dist 10 > SMELL_TREAT(5)
    expect(bestSmelledFood({ col: 0, row: 0 }, foods)).toBeNull();
  });
  it('prefers a distant high-value bag over a near treat by value/distance', () => {
    const treat: Food = { type: 'treat', value: 10, tile: { col: 3, row: 0 } }; // 10/4 = 2.5
    const bag: Food = { type: 'bag', value: 40, tile: { col: 10, row: 0 } }; // 40/11 = 3.6, within SMELL_BAG(12)
    expect(bestSmelledFood({ col: 0, row: 0 }, [treat, bag])).toBe(bag);
  });
});

describe('bestFoodAnywhere', () => {
  it('finds food far beyond any smell radius', () => {
    const foods: Food[] = [{ type: 'treat', value: 10, tile: { col: 40, row: 0 } }];
    expect(bestSmelledFood({ col: 0, row: 0 }, foods)).toBeNull();
    expect(bestFoodAnywhere({ col: 0, row: 0 }, foods)).toBe(foods[0]);
  });
  it('still ranks by value/distance', () => {
    const near: Food = { type: 'treat', value: 10, tile: { col: 2, row: 0 } }; // 10/3 = 3.3
    const farBig: Food = { type: 'bag', value: 100, tile: { col: 30, row: 0 } }; // 100/31 = 3.2
    expect(bestFoodAnywhere({ col: 0, row: 0 }, [near, farBig])).toBe(near);
  });
  it('returns null only when there is no food at all', () => {
    expect(bestFoodAnywhere({ col: 0, row: 0 }, [])).toBeNull();
  });
});

describe('patrolStep (street-biased)', () => {
  const rng = (v: number) => () => v;

  it('continues straight along the street when pavement lies ahead', () => {
    const line = new Grid(parseMap('P0,P0,P0'));
    expect(patrolStep(line, { col: 1, row: 0 }, 'right', rng(0.9))).toBe('right');
  });

  it('prefers pavement over an adjacent yard (pavement-preferring rng)', () => {
    // On pavement (1,1) facing up: pavement up/down, grass left/right.
    expect(patrolStep(streetGrid, { col: 1, row: 1 }, 'up', rng(0.9))).toBe('up');
  });

  it('may dip into a yard, then biases back toward the street (yard-exploring rng)', () => {
    const intoYard = patrolStep(streetGrid, { col: 1, row: 1 }, 'up', rng(0.05));
    expect(['left', 'right']).toContain(intoYard); // stepped off the street into a yard
    // From the yard tile (0,1), the next step heads back to the pavement column.
    expect(patrolStep(streetGrid, { col: 0, row: 1 }, intoYard!, rng(0.05))).toBe('right');
  });

  it('still moves when no pavement neighbour is open', () => {
    expect(['left', 'right']).toContain(patrolStep(grid, { col: 5, row: 0 }, 'right', rng(0.9)));
  });

  it('returns null when boxed in with no open neighbour', () => {
    const cell = new Grid(parseMap('G0'));
    expect(patrolStep(cell, { col: 0, row: 0 }, 'right', rng(0.5))).toBeNull();
  });
});

describe('nextBanditMove', () => {
  const rng = () => 0;

  it('chases the only smelled food (advanced mode)', () => {
    banditSettings.omniscient = false;
    const foods: Food[] = [{ type: 'treat', value: 10, tile: { col: 4, row: 0 } }];
    expect(nextBanditMove(grid, bandit(0), foods, rng)).toEqual({ dir: 'right', mode: 'chase' });
  });

  it('patrols at half speed when nothing is smelled and not thirsty', () => {
    const move = nextBanditMove(grid, bandit(5), [], rng);
    expect(move?.mode).toBe('patrol');
    expect(['left', 'right']).toContain(move?.dir);
  });

  it('chases water at full speed in water mode', () => {
    const waterGrid = new Grid(parseMap('P0,P0,W0'));
    expect(nextBanditMove(waterGrid, bandit(0), [], rng, { goal: 'water' })).toEqual({
      dir: 'right',
      mode: 'chase',
    });
  });

  describe('water mode beelines — no opportunistic treat grab', () => {
    // Row0 is grass (treats), row1 is a pavement corridor ending in water at (4,1).
    // A treat sits directly above him at (0,0); the water is four tiles RIGHT. He
    // must ignore the adjacent treat entirely and take the shortest path to water.
    const wgrid = new Grid(parseMap(['G0,G0,G0,G0,G0', 'P0,P0,P0,P0,W0'].join('\n')));
    const at = (): Bandit => ({
      tile: { col: 0, row: 1 },
      inv: { food: 50, water: 5, poop: 0, pee: 0 },
      facing: 'right',
    });

    it('walks past a treat one tile away and heads RIGHT to water', () => {
      const foods: Food[] = [{ type: 'treat', value: 10, tile: { col: 0, row: 0 } }];
      expect(nextBanditMove(wgrid, at(), foods, rng, { goal: 'water' })).toEqual({
        dir: 'right',
        mode: 'chase',
      });
    });

    it('ignores even a high-value bag adjacent to him', () => {
      const foods: Food[] = [{ type: 'bag', value: 40, tile: { col: 0, row: 0 } }];
      expect(nextBanditMove(wgrid, at(), foods, rng, { goal: 'water' })).toEqual({
        dir: 'right',
        mode: 'chase',
      });
    });

    it('falls back to the treat chain when no water is reachable', () => {
      const dry = new Grid(parseMap(['G0,G0', 'P0,P0'].join('\n')));
      const foods: Food[] = [{ type: 'treat', value: 10, tile: { col: 0, row: 0 } }];
      banditSettings.omniscient = true;
      expect(nextBanditMove(dry, at(), foods, rng, { goal: 'water' })).toEqual({ dir: 'up', mode: 'chase' });
    });
  });

  it('detects food exactly at the smell-range boundary (advanced mode)', () => {
    banditSettings.omniscient = false;
    const foods: Food[] = [{ type: 'treat', value: 10, tile: { col: config.SMELL_TREAT, row: 0 } }];
    expect(nextBanditMove(grid, bandit(0), foods, rng)?.mode).toBe('chase');
  });

  it('ignores food one tile beyond the smell-range boundary (advanced mode)', () => {
    banditSettings.omniscient = false;
    const foods: Food[] = [{ type: 'treat', value: 10, tile: { col: config.SMELL_TREAT + 1, row: 0 } }];
    expect(nextBanditMove(grid, bandit(0), foods, rng)?.mode).toBe('patrol');
  });

  describe('omniscient mode', () => {
    it('chases the globally best food, ignoring smell range', () => {
      banditSettings.omniscient = true;
      const foods: Food[] = [{ type: 'treat', value: 10, tile: { col: 12, row: 0 } }]; // dist 12 >> SMELL_TREAT
      expect(nextBanditMove(grid, bandit(0), foods, rng)).toEqual({ dir: 'right', mode: 'chase' });
    });
    it('patrols when no food exists anywhere', () => {
      banditSettings.omniscient = true;
      expect(nextBanditMove(grid, bandit(5), [], rng)?.mode).toBe('patrol');
    });
  });
});

describe('relieve targeting', () => {
  const rng = () => 0;
  const line = new Grid(parseMap('P0,P0,P0,P0,P0')); // 5 open pavement tiles
  const bandit = (col: number): Bandit => ({
    tile: { col, row: 0 },
    inv: { food: 50, water: 50, poop: config.POOP_MAX, pee: 0 },
    facing: 'right',
  });
  // One owner per column by default, so a committed-yard filter is unambiguous.
  const target = (col: number, affection: number, ownerId = col + 1): RelieveTarget => ({
    tile: { col, row: 0 },
    ownerId,
    affection,
  });

  it('heads toward a reachable yard in relief mode', () => {
    expect(
      nextBanditMove(line, bandit(2), [], rng, { goal: 'relief', relieveTargets: [target(0, 50)] }),
    ).toEqual({ dir: 'left', mode: 'chase' });
  });

  it('picks the highest-affection yard', () => {
    expect(
      nextBanditMove(line, bandit(2), [], rng, {
        goal: 'relief',
        relieveTargets: [target(0, 20), target(4, 80)],
      })?.dir,
    ).toBe('right');
  });

  it('breaks an affection tie by nearest', () => {
    expect(
      nextBanditMove(line, bandit(2), [], rng, {
        goal: 'relief',
        relieveTargets: [target(1, 50), target(4, 50)],
      })?.dir,
    ).toBe('left');
  });

  it('skips an unreachable top yard for the next-best reachable one', () => {
    const grid = new Grid(parseMap('P0,P0,H0')); // col 2 is a house — unreachable
    expect(
      nextBanditMove(grid, bandit(0), [], rng, {
        goal: 'relief',
        relieveTargets: [target(2, 90), target(1, 50)],
      }),
    ).toEqual({ dir: 'right', mode: 'chase' });
  });

  it('falls through to the treat chain when no yard is reachable', () => {
    const grid = new Grid(parseMap('P0,P0,H0'));
    expect(
      nextBanditMove(grid, bandit(0), [], rng, { goal: 'relief', relieveTargets: [target(2, 90)] })?.mode,
    ).toBe('patrol');
  });

  it('does not pursue a yard outside relief mode, however full he is', () => {
    expect(
      nextBanditMove(line, bandit(2), [], rng, { goal: 'treat', relieveTargets: [target(0, 80)] })?.mode,
    ).toBe('patrol');
  });

  // The reported bug: his own fouling drops the yard's affection, so a fresh
  // per-tick ranking hands the crown to a neighbour and walks him off half-full.
  describe('yard commitment', () => {
    const COMMITTED = 1;
    it('stays on the committed yard even when a rival now out-ranks it', () => {
      const targets = [target(0, 10, COMMITTED), target(4, 90, 2)]; // committed yard is now the LEAST liked
      expect(
        nextBanditMove(line, bandit(2), [], rng, {
          goal: 'relief',
          relieveTargets: targets,
          committedOwnerId: COMMITTED,
        })?.dir,
      ).toBe('left');
      // ...and without the commitment he would indeed have gone the other way.
      expect(
        nextBanditMove(line, bandit(2), [], rng, {
          goal: 'relief',
          relieveTargets: targets,
          committedOwnerId: null,
        })?.dir,
      ).toBe('right');
    });

    it('spreads across the committed yard, nearest tile first', () => {
      const targets = [target(0, 10, COMMITTED), target(3, 10, COMMITTED), target(4, 90, 2)];
      expect(
        nextBanditMove(line, bandit(2), [], rng, {
          goal: 'relief',
          relieveTargets: targets,
          committedOwnerId: COMMITTED,
        })?.dir,
      ).toBe('right'); // col 3, dist 1
    });

    it('hands off to the next-best yard once the committed one has no room left', () => {
      // No targets remain for the committed owner — its lawn saturated.
      const targets = [target(0, 20, 2), target(4, 90, 3)];
      expect(
        nextBanditMove(line, bandit(2), [], rng, {
          goal: 'relief',
          relieveTargets: targets,
          committedOwnerId: COMMITTED,
        })?.dir,
      ).toBe('right');
    });

    it('keeps the commitment when the last foulable tile is the one under his paws', () => {
      // Regression: bfsFirstStep can never return its own start tile, so the
      // self-tile used to read as unreachable — dropping him through to the
      // global ranking, re-committing him to a rival yard, and walking him off
      // a tile he could still foul. He must stay put on his own yard instead.
      const here = { col: 2, row: 0 };
      const targets = [{ tile: here, ownerId: COMMITTED, affection: 10 }, target(4, 90, 2)];
      const hit = firstReachableRelieveTarget(line, here, targets, COMMITTED);
      expect(hit).toEqual({ tile: here, ownerId: COMMITTED, dir: null });
      expect(
        nextBanditMove(line, bandit(2), [], rng, {
          goal: 'relief',
          relieveTargets: targets,
          committedOwnerId: COMMITTED,
        }),
      ).toBeNull(); // stays to foul
    });

    it('firstReachableRelieveTarget reports the yard it settled on', () => {
      const hit = firstReachableRelieveTarget(line, { col: 2, row: 0 }, [target(0, 20, 7), target(4, 90, 9)]);
      expect(hit).toEqual({ tile: { col: 4, row: 0 }, ownerId: 9, dir: 'right' });
    });
  });

  describe('rankRelieveTargets', () => {
    const from = { col: 0, row: 0 };
    it('orders by affection descending', () => {
      const ranked = rankRelieveTargets(from, [target(1, 20), target(2, 80), target(3, 50)]);
      expect(ranked.map((t) => t.affection)).toEqual([80, 50, 20]);
    });
    it('breaks affection ties by nearest', () => {
      const ranked = rankRelieveTargets(from, [target(3, 50), target(1, 50)]);
      expect(ranked.map((t) => t.tile.col)).toEqual([1, 3]);
    });
    it('resolves a full affection+distance tie by stable original order', () => {
      const a = target(1, 50);
      const b = { tile: { col: 1, row: 2 }, ownerId: 9, affection: 50 }; // same dist from (0,0)
      expect(rankRelieveTargets(from, [a, b])).toEqual([a, b]);
    });
  });
});

describe('canFoulTile', () => {
  const gtile = (over: Partial<Tile> = {}): Tile => ({
    col: 0,
    row: 0,
    type: 'grass',
    ownerId: 2,
    fences: emptyFences(),
    heat: 0,
    dirt: 0,
    destruction: 0,
    foodPresent: false,
    ...over,
  });
  const inv = (poop: number, pee: number) => ({ food: 0, water: 0, poop, pee });

  it('true on a grass tile with a held-waste channel that has room', () => {
    expect(canFoulTile(inv(40, 0), gtile())).toBe(true);
  });
  it('false when the held-waste (poop) channel is maxed even if the other has room', () => {
    expect(canFoulTile(inv(40, 0), gtile({ dirt: config.POOP_MAX }))).toBe(false);
  });
  it('false when the held-waste (pee) channel is maxed even if the other has room', () => {
    expect(canFoulTile(inv(0, 40), gtile({ destruction: config.PEE_MAX }))).toBe(false);
  });
  it('false when he holds no drainable waste (tile has room)', () => {
    expect(canFoulTile(inv(1, 0), gtile())).toBe(false);
  });
  it('false on a non-grass tile', () => {
    expect(canFoulTile(inv(40, 40), gtile({ type: 'pavement' }))).toBe(false);
  });
  it('boundary: room for exactly one more is foulable, at the cap is not', () => {
    expect(canFoulTile(inv(40, 0), gtile({ dirt: config.POOP_MAX - config.POOP_RATE }))).toBe(true);
    expect(canFoulTile(inv(40, 0), gtile({ dirt: config.POOP_MAX }))).toBe(false);
  });

  describe('narrowed to one channel', () => {
    // A tile with pee room is no use to a Bandit draining poop onto maxed dirt.
    const dirtMaxed = gtile({ dirt: config.POOP_MAX });
    it('asks only about the named channel', () => {
      expect(canFoulTile(inv(40, 40), dirtMaxed, 'poop')).toBe(false);
      expect(canFoulTile(inv(40, 40), dirtMaxed, 'pee')).toBe(true);
    });
    it('still answers either-channel when none is named', () => {
      expect(canFoulTile(inv(40, 40), dirtMaxed)).toBe(true);
      expect(canFoulTile(inv(40, 40), dirtMaxed, null)).toBe(true);
    });
    it('needs held waste on that channel specifically', () => {
      expect(canFoulTile(inv(1, 40), gtile(), 'poop')).toBe(false); // holds no poop
      expect(canFoulTile(inv(1, 40), gtile(), 'pee')).toBe(true);
    });
  });
});

describe('isThirsty', () => {
  const at = (water: number) => ({ food: 50, water, poop: 0, pee: 0 });
  it('is true at or below the thirst fraction of WATER_CAP', () => {
    const edge = config.WATER_CAP * config.BANDIT_THIRST_FRACTION;
    expect(isThirsty(at(edge))).toBe(true);
    expect(isThirsty(at(edge - 0.01))).toBe(true);
  });
  it('is false just above it', () => {
    expect(isThirsty(at(config.WATER_CAP * config.BANDIT_THIRST_FRACTION + 0.01))).toBe(false);
  });
  it('is false at 20% — the old 30% trigger no longer fires', () => {
    expect(isThirsty(at(config.WATER_CAP * 0.2))).toBe(false);
  });
});

describe('banditGoalLabel', () => {
  it('names treat seeking', () => {
    expect(banditGoalLabel('treat', null)).toBe('Looking for Treats');
  });
  it('names thirst', () => {
    expect(banditGoalLabel('water', null)).toBe('Needs Water!');
  });
  it('names the channel he is draining', () => {
    expect(banditGoalLabel('relief', 'poop')).toBe('Need to Poop!');
    expect(banditGoalLabel('relief', 'pee')).toBe('Need to Pee!');
  });
  it('ignores the mode when he is not relieving', () => {
    // A leftover channel must never leak a waste label into another mode.
    expect(banditGoalLabel('treat', 'pee')).toBe('Looking for Treats');
    expect(banditGoalLabel('water', 'poop')).toBe('Needs Water!');
  });
});

describe('banditTweenDuration', () => {
  it('leaves a chase step at the base duration', () => {
    expect(banditTweenDuration(100, 'chase', 2)).toBe(100);
  });
  it('slows a patrol step by the multiplier (half speed at 2x)', () => {
    expect(banditTweenDuration(100, 'patrol', 2)).toBe(200);
  });
});

describe('repeller exclusion in pathfinding', () => {
  const rng = () => 0;
  const line = new Grid(parseMap('P0,P0,P0,P0,P0'));
  const twoRows = new Grid(parseMap(['P0,P0,P0,P0,P0', 'P0,P0,P0,P0,P0'].join('\n')));
  const goalAt =
    (col: number, row = 0) =>
    (t: TileCoord) =>
      t.col === col && t.row === row;
  const at = (col: number, row = 0): Bandit => ({
    tile: { col, row },
    inv: { food: 50, water: 50, poop: 0, pee: 0 },
    facing: 'right',
  });

  it('refuses to path through a blocked tile', () => {
    // Single corridor, the only route walled off.
    expect(bfsFirstStep(line, { col: 0, row: 0 }, goalAt(4))).toBe('right');
    expect(bfsFirstStep(line, { col: 0, row: 0 }, goalAt(4), (t) => t.col === 2)).toBeNull();
  });

  it('routes around it when another way exists', () => {
    const blocked = (t: TileCoord) => t.col === 2 && t.row === 0;
    const dir = bfsFirstStep(twoRows, { col: 0, row: 0 }, goalAt(4), blocked);
    expect(dir).not.toBeNull();
    // Whatever it picks, the first step is never INTO the zone.
    const next = twoRows.neighbor({ col: 0, row: 0 }, dir!);
    expect(blocked(next)).toBe(false);
  });

  it('lets a bandit standing inside a zone walk out of it', () => {
    // `blocked` is never applied to the start tile, so being inside is not a cage.
    const insideHisColumn = (t: TileCoord) => t.col === 0;
    expect(bfsFirstStep(twoRows, { col: 0, row: 0 }, goalAt(4), insideHisColumn)).toBe('right');
  });

  it('keeps the patrol out of the zone too', () => {
    // Otherwise he'd stroll into a zone his pathfinding carefully avoids.
    expect(patrolStep(line, { col: 2, row: 0 }, 'right', rng, (t) => t.col === 3)).toBe('left');
  });

  it('falls through to patrol when a repeller walls off the food', () => {
    banditSettings.omniscient = true;
    const foods: Food[] = [{ type: 'treat', value: 10, tile: { col: 4, row: 0 } }];
    const move = nextBanditMove(line, at(0), foods, rng, { blocked: (t) => t.col === 2 });
    expect(move?.mode).toBe('patrol');
  });

  it('still chases the food when nothing is in the way', () => {
    banditSettings.omniscient = true;
    const foods: Food[] = [{ type: 'treat', value: 10, tile: { col: 4, row: 0 } }];
    expect(nextBanditMove(line, at(0), foods, rng, {})).toEqual({ dir: 'right', mode: 'chase' });
  });
});

describe('nextBanditMove — rawhide goal', () => {
  const rng = () => 0;
  const line = new Grid(parseMap('P0,P0,P0,P0,P0'));
  const at = (col: number): Bandit => ({
    tile: { col, row: 0 },
    inv: { food: 50, water: 50, poop: 0, pee: 0 },
    facing: 'right',
  });

  it('beelines for the rawhide, ignoring food in the other direction', () => {
    banditSettings.omniscient = true;
    const foods: Food[] = [{ type: 'bag', value: 40, tile: { col: 0, row: 0 } }];
    const move = nextBanditMove(line, at(2), foods, rng, {
      goal: 'rawhide',
      rawhideTile: { col: 4, row: 0 },
    });
    expect(move).toEqual({ dir: 'right', mode: 'chase' });
  });

  it('stays put once he is standing on it', () => {
    const move = nextBanditMove(line, at(4), [], rng, { goal: 'rawhide', rawhideTile: { col: 4, row: 0 } });
    expect(move).toBeNull();
  });

  it('carries on normally when the rawhide cannot be reached', () => {
    banditSettings.omniscient = true;
    const foods: Food[] = [{ type: 'treat', value: 10, tile: { col: 0, row: 0 } }];
    const move = nextBanditMove(line, at(2), foods, rng, {
      goal: 'rawhide',
      rawhideTile: { col: 4, row: 0 },
      blocked: (t) => t.col === 3,
    });
    expect(move).toEqual({ dir: 'left', mode: 'chase' }); // goes for the treat instead
  });
});
