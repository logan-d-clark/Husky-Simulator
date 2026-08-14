import { describe, it, expect, afterEach } from 'vitest';
import {
  emptyCounts,
  itemDropChance,
  milestoneCount,
  randomItemType,
  grant,
  consume,
  repellerBlocks,
  milestonesToGrant,
  nextTutorial,
  tickRepellers,
  type Repeller,
} from '../../src/systems/ItemSystem';
import { ITEM_TYPES, ITEMS, itemForKey, type ItemType } from '../../src/entities/Item';
import { config, resetConfig } from '../../src/config/gameConfig';
import { TICKS_PER_SECOND } from '../../src/config/constants';

afterEach(() => resetConfig());

describe('the item table', () => {
  it('binds keys 1-4 in deployment order', () => {
    expect(ITEM_TYPES.map((t) => ITEMS[t].key)).toEqual(['1', '2', '3', '4']);
  });
  it('maps each number key back to its item', () => {
    for (const t of ITEM_TYPES) expect(itemForKey(ITEMS[t].key)).toBe(t);
  });
  it('ignores any other key', () => {
    for (const k of ['5', '0', 'W', '']) expect(itemForKey(k)).toBeNull();
  });
  it('gives every item a name and an explanation for the tutorial', () => {
    for (const t of ITEM_TYPES) {
      expect(ITEMS[t].name.length).toBeGreaterThan(0);
      expect(ITEMS[t].blurb.length).toBeGreaterThan(20);
    }
  });
});

describe('itemDropChance', () => {
  it('rises with the food being carried', () => {
    expect(itemDropChance(1000)).toBeGreaterThan(itemDropChance(0));
    expect(itemDropChance(3000)).toBeGreaterThan(itemDropChance(1000));
  });

  it('doubles for every ITEM_DROP_FOOD_SCALE held', () => {
    expect(itemDropChance(config.ITEM_DROP_FOOD_SCALE)).toBeCloseTo(2 * itemDropChance(0));
  });

  it('never inverts on a transiently negative food value', () => {
    expect(itemDropChance(-500)).toBe(itemDropChance(0));
    expect(itemDropChance(-500)).toBeGreaterThan(0);
  });

  it('hands out enough items over a round to meet the design goal', () => {
    // The stated target is "at least 5 in an average 20-minute game, with the
    // potential for more". Expected drops = chance x ticks, and food ramps
    // through the round, so this brackets the realistic range rather than
    // pinning one number — a retune that breaks the goal fails here.
    const ticks = 20 * 60 * TICKS_PER_SECOND;
    const expected = (food: number) => itemDropChance(food) * ticks;
    expect(expected(50)).toBeGreaterThan(2); // even a poor round contributes
    expect(expected(800)).toBeGreaterThan(5); // a normal one clears the bar alone
    expect(expected(2400)).toBeLessThan(15); // ...without becoming a firehose
  });
});

describe('milestoneCount', () => {
  it('counts each full milestone of food reached', () => {
    const m = config.ITEM_MILESTONE_FOOD;
    expect(milestoneCount(0)).toBe(0);
    expect(milestoneCount(m - 1)).toBe(0);
    expect(milestoneCount(m)).toBe(1);
    expect(milestoneCount(m * 3 + 10)).toBe(3);
  });

  it('is never negative, however hungry he gets', () => {
    expect(milestoneCount(-5000)).toBe(0);
  });

  it('does not pay twice for a dip and a recovery', () => {
    // The caller grants on the *increase* in this count, so a round trip below
    // and back above a milestone yields no new grant.
    const m = config.ITEM_MILESTONE_FOOD;
    const peak = milestoneCount(m + 50);
    expect(milestoneCount(m - 100)).toBeLessThan(peak);
    expect(milestoneCount(m + 50)).toBe(peak); // same count as before — nothing new to grant
  });
});

describe('randomItemType', () => {
  it('can produce every item', () => {
    const seen = new Set(ITEM_TYPES.map((_, i) => randomItemType(() => i / ITEM_TYPES.length)));
    expect(seen.size).toBe(ITEM_TYPES.length);
  });
  it('stays in range at the very edges of the rng', () => {
    expect(ITEM_TYPES).toContain(randomItemType(() => 0));
    expect(ITEM_TYPES).toContain(randomItemType(() => 0.999999));
    expect(ITEM_TYPES).toContain(randomItemType(() => 1)); // defensive: rand() should never return 1
  });
});

describe('counts', () => {
  it('starts empty', () => {
    expect(Object.values(emptyCounts()).every((n) => n === 0)).toBe(true);
  });
  it('grants and spends', () => {
    const c = emptyCounts();
    grant(c, 'rawhide');
    grant(c, 'rawhide');
    expect(c.rawhide).toBe(2);
    expect(consume(c, 'rawhide')).toBe(true);
    expect(c.rawhide).toBe(1);
  });
  it('refuses to spend what he does not have', () => {
    const c = emptyCounts();
    expect(consume(c, 'zoomies')).toBe(false);
    expect(c.zoomies).toBe(0);
  });
  it('never lets a count go negative through repeated presses', () => {
    const c = emptyCounts();
    for (let i = 0; i < 5; i++) consume(c, 'diaper');
    expect(c.diaper).toBe(0);
  });
});

describe('repellerBlocks', () => {
  const at = (col: number, row: number) => ({ col, row });
  const rep = (col: number, row: number): Repeller => ({ tile: at(col, row), secondsLeft: 10 });
  const far = at(40, 20); // well outside anything below

  it('blocks nothing when none are deployed', () => {
    expect(repellerBlocks([], far)(at(5, 5))).toBe(false);
  });

  it('blocks tiles inside the radius', () => {
    const blocked = repellerBlocks([rep(10, 10)], far);
    expect(blocked(at(10, 10))).toBe(true);
    expect(blocked(at(10, 10 + config.REPELLER_RADIUS))).toBe(true); // on the edge
  });

  it('leaves tiles outside the radius alone', () => {
    const blocked = repellerBlocks([rep(10, 10)], far);
    expect(blocked(at(10, 10 + config.REPELLER_RADIUS + 1))).toBe(false);
  });

  it('stops applying to a repeller Bandit is standing inside', () => {
    // Otherwise one dropped on his head makes every neighbouring tile illegal
    // and freezes him where he stands. It keeps him out; it does not cage him.
    const onHisHead = repellerBlocks([rep(10, 10)], at(10, 10));
    expect(onHisHead(at(10, 10))).toBe(false);
    expect(onHisHead(at(11, 10))).toBe(false);
  });

  it('still honours the OTHER repellers while he stands in one', () => {
    const blocked = repellerBlocks([rep(10, 10), rep(30, 10)], at(10, 10));
    expect(blocked(at(11, 10))).toBe(false); // the one he is in
    expect(blocked(at(30, 10))).toBe(true); // the distant one still bites
  });

  it('follows a dev-panel radius change', () => {
    const outer = at(10, 10 + config.REPELLER_RADIUS + 2);
    expect(repellerBlocks([rep(10, 10)], far)(outer)).toBe(false);
    config.REPELLER_RADIUS += 4;
    expect(repellerBlocks([rep(10, 10)], far)(outer)).toBe(true);
  });
});

describe('milestonesToGrant', () => {
  const M = () => config.ITEM_MILESTONE_FOOD;
  it('owes nothing before the first milestone', () => {
    expect(milestonesToGrant(0, M() - 1)).toBe(0);
  });
  it('owes one on crossing', () => {
    expect(milestonesToGrant(0, M())).toBe(1);
  });
  it('owes several when one pickup vaults past more than one', () => {
    // A pup cup is worth 12 treats, so a single pickup really can skip a band.
    expect(milestonesToGrant(0, M() * 3)).toBe(3);
    expect(milestonesToGrant(2, M() * 5)).toBe(3);
  });
  it('owes nothing once paid, however long he stays above it', () => {
    expect(milestonesToGrant(3, M() * 3 + 900)).toBe(0);
  });
  it('never goes negative when he spends back below a paid milestone', () => {
    expect(milestonesToGrant(3, 0)).toBe(0);
    expect(milestonesToGrant(3, -500)).toBe(0);
  });
});

describe('nextTutorial', () => {
  it('is nothing when the queue is empty', () => {
    expect(nextTutorial(new Set(), [])).toBeNull();
  });
  it('picks the first item still unseen', () => {
    expect(nextTutorial(new Set(['rawhide']), ['rawhide', 'diaper'])).toBe('diaper');
  });
  it('is nothing when everything queued has already been shown', () => {
    expect(nextTutorial(new Set(['rawhide', 'diaper']), ['rawhide', 'diaper'])).toBeNull();
  });
  it('preserves queue order so a burst is shown one at a time', () => {
    const queue: ItemType[] = ['zoomies', 'repeller'];
    expect(nextTutorial(new Set(), queue)).toBe('zoomies');
    expect(nextTutorial(new Set(['zoomies']), queue)).toBe('repeller');
  });
});

describe('tickRepellers', () => {
  const rep = (secondsLeft: number): Repeller => ({ tile: { col: 0, row: 0 }, secondsLeft });
  it('counts survivors down', () => {
    const { alive, expired } = tickRepellers([rep(5)]);
    expect(alive).toHaveLength(1);
    expect(alive[0].secondsLeft).toBe(4);
    expect(expired).toEqual([]);
  });
  it('retires one that reaches zero, so its sprites can be torn down', () => {
    const { alive, expired } = tickRepellers([rep(1)]);
    expect(alive).toEqual([]);
    expect(expired).toHaveLength(1);
  });
  it('sorts a mixed batch', () => {
    const { alive, expired } = tickRepellers([rep(1), rep(9), rep(1)]);
    expect(alive).toHaveLength(1);
    expect(expired).toHaveLength(2);
  });
  it('handles an empty field', () => {
    expect(tickRepellers([])).toEqual({ alive: [], expired: [] });
  });
});
