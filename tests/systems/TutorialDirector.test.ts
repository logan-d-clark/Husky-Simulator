import { describe, it, expect } from 'vitest';
import { TutorialDirector, WARNINGS, type DirectorState } from '../../src/systems/TutorialDirector';
import { TUTORIAL_STAGES, itemsTaught, type TutorialEvent } from '../../src/systems/TutorialScript';
import { ITEM_TYPES } from '../../src/entities/Item';
import { emptyCounts } from '../../src/systems/ItemSystem';
import { config } from '../../src/config/gameConfig';
import type { Inventory } from '../../src/types';

const inv = (over: Partial<Inventory> = {}): Inventory => ({
  food: 50,
  water: 50,
  poop: 0,
  pee: 0,
  ...over,
});

const state = (over: Partial<DirectorState> = {}): DirectorState => ({
  inv: inv(),
  onFamilyYard: false,
  yardAffection: 0,
  items: emptyCounts(),
  banditPenned: true,
  ...over,
});

// Whatever it takes to satisfy each stage, so the whole walkthrough can be
// driven without Phaser. Keyed by stage id: a new stage with no entry here makes
// the end-to-end test fail loudly rather than silently skipping it.
const SOLVE: Record<string, { events?: [TutorialEvent, number][]; state?: Partial<DirectorState> }> = {
  move: { events: [['ate', 3]] },
  hud: { events: [['stepped', 15]] },
  drink: { events: [['drank', 8]] },
  relieve: { events: [['pooped', 8]] },
  yard: { state: { onFamilyYard: true } },
  trick: { events: [['tricked', 5]] },
  thresholds: { state: { yardAffection: config.BOWL_THRESHOLD } },
  bandit: { state: { banditPenned: false } },
  rawhide: { events: [['used:rawhide', 1]] },
  repeller: { events: [['used:repeller', 1]] },
  diaper: { events: [['used:diaper', 1]] },
  zoomies: { events: [['used:zoomies', 1]] },
};

const solveStage = (d: TutorialDirector, id: string) => {
  const solve = SOLVE[id];
  for (const [event, times] of solve?.events ?? []) {
    for (let i = 0; i < times; i++) d.bump(event);
  }
  return solve;
};

describe('the tutorial script', () => {
  it('gives every stage a unique id', () => {
    const ids = TUTORIAL_STAGES.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every stage something to read and something to do', () => {
    for (const s of TUTORIAL_STAGES) {
      expect(s.title.length, s.id).toBeGreaterThan(0);
      expect(s.body.length, s.id).toBeGreaterThan(20);
      expect(typeof s.done, s.id).toBe('function');
    }
  });

  it('teaches every item that exists', () => {
    // Adding a fifth item without writing it a stage fails here.
    expect(itemsTaught().sort()).toEqual([...ITEM_TYPES].sort());
  });

  it('stays inside the 5-10 minute budget at a realistic pace', () => {
    // ~30s a stage is the design assumption; this brackets it rather than
    // pinning a number, so trimming or adding a stage is fine but doubling the
    // walkthrough is not.
    const minutes = (TUTORIAL_STAGES.length * 30) / 60;
    expect(minutes).toBeGreaterThanOrEqual(4);
    expect(minutes).toBeLessThanOrEqual(10);
  });
});

describe('TutorialDirector', () => {
  it('starts on the first stage', () => {
    const d = new TutorialDirector();
    expect(d.stage()?.id).toBe(TUTORIAL_STAGES[0].id);
    expect(d.stageNumber()).toBe(1);
    expect(d.isFinished()).toBe(false);
  });

  it('does not advance until the objective is met', () => {
    const d = new TutorialDirector();
    d.bump('ate');
    d.bump('ate'); // two of the three
    expect(d.update(state()).advanced).toBe(false);
    expect(d.stage()?.id).toBe('move');
    d.bump('ate');
    expect(d.update(state()).advanced).toBe(true);
    expect(d.stage()?.id).toBe('hud');
  });

  it('counts each stage from its own zero', () => {
    // 15 steps taken during the move stage must not pre-satisfy the walk stage.
    const d = new TutorialDirector();
    for (let i = 0; i < 15; i++) d.bump('stepped');
    for (let i = 0; i < 3; i++) d.bump('ate');
    d.update(state());
    expect(d.stage()?.id).toBe('hud');
    expect(d.update(state()).advanced).toBe(false); // the earlier steps are gone
  });

  it('reports progress for the stages that have it', () => {
    const d = new TutorialDirector();
    expect(d.progressText(state())).toBe('0 / 3');
    d.bump('ate');
    expect(d.progressText(state())).toBe('1 / 3');
  });

  it('never reports progress past the target', () => {
    const d = new TutorialDirector();
    for (let i = 0; i < 9; i++) d.bump('ate');
    expect(d.progressText(state())).toBe('3 / 3');
  });

  it('walks the WHOLE walkthrough to completion', () => {
    const d = new TutorialDirector();
    const seen: string[] = [];
    for (let guard = 0; guard < TUTORIAL_STAGES.length + 5; guard++) {
      const stage = d.stage();
      if (!stage) break;
      seen.push(stage.id);
      const solve = solveStage(d, stage.id);
      expect(solve, `stage ${stage.id} has no solution in the test table`).toBeDefined();
      const res = d.update(state(solve?.state));
      expect(res.advanced, `stage ${stage.id} did not advance when solved`).toBe(true);
    }
    expect(seen).toEqual(TUTORIAL_STAGES.map((s) => s.id));
    expect(d.isFinished()).toBe(true);
  });

  it('reports finished exactly once, on the last stage', () => {
    const d = new TutorialDirector();
    let finishes = 0;
    for (const stage of TUTORIAL_STAGES) {
      const solve = solveStage(d, stage.id);
      if (d.update(state(solve?.state)).finished) finishes += 1;
    }
    expect(finishes).toBe(1);
  });

  it('is inert once finished', () => {
    const d = new TutorialDirector();
    for (const stage of TUTORIAL_STAGES) {
      const solve = solveStage(d, stage.id);
      d.update(state(solve?.state));
    }
    expect(d.stage()).toBeNull();
    expect(d.update(state()).advanced).toBe(false);
    expect(d.progressText(state())).toBe('');
    expect(d.stageNumber()).toBe(TUTORIAL_STAGES.length); // not one past the end
  });
});

describe('coaching warnings', () => {
  it('says nothing while he is healthy', () => {
    expect(new TutorialDirector().warningFor(inv())).toBeNull();
  });

  it('coaches an empty water bar', () => {
    expect(new TutorialDirector().warningFor(inv({ water: 0 }))).toBe('water');
  });

  it('coaches an empty food bar', () => {
    expect(new TutorialDirector().warningFor(inv({ food: 0 }))).toBe('food');
  });

  it('fires once, however long the stat sits at zero', () => {
    // The point is to teach the lesson, not to nag every tick.
    const d = new TutorialDirector();
    expect(d.warningFor(inv({ water: 0 }))).toBe('water');
    for (let i = 0; i < 50; i++) expect(d.warningFor(inv({ water: 0 }))).toBeNull();
  });

  it('still coaches the other one after the first has fired', () => {
    const d = new TutorialDirector();
    expect(d.warningFor(inv({ water: 0 }))).toBe('water');
    expect(d.warningFor(inv({ food: 0, water: 0 }))).toBe('food');
  });

  it('has copy for every warning it can raise', () => {
    for (const id of ['food', 'water'] as const) {
      expect(WARNINGS[id].title.length).toBeGreaterThan(0);
      expect(WARNINGS[id].body.length).toBeGreaterThan(20);
    }
  });
});
