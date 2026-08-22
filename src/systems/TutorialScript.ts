import type { Inventory } from '../types';
import type { ItemType } from '../entities/Item';
import { ITEM_TYPES, ITEMS } from '../entities/Item';
import type { ItemCounts } from './ItemSystem';
import { config } from '../config/gameConfig';

// The walkthrough, as pure data. Keeping the script and its objectives free of
// Phaser is what makes a thirteen-stage tutorial testable at all: the entire
// progression can be driven in a unit test instead of played thirteen times.

/** What an objective is allowed to look at. */
export interface TutorialState {
  inv: Inventory;
  onFamilyYard: boolean;
  /** Affection of the yard he is standing on; 0 on public land. */
  yardAffection: number;
  items: ItemCounts;
  banditPenned: boolean;
  /** Reset to zero on every stage change, so "3 treats" means three THIS stage. */
  counters: Readonly<Record<string, number>>;
}

/** Events GameScene reports as they really happen. */
export type TutorialEvent = 'ate' | 'drank' | 'pooped' | 'tricked' | 'stepped' | `used:${ItemType}`;

/**
 * Declarative world setup. The script says WHAT a stage needs; GameScene decides
 * how — which is what keeps this module pure.
 */
export interface TutorialSetup {
  /** Scatter this many treats within easy reach of the player. */
  spawnTreats?: number;
  grantItem?: ItemType;
  fillPoop?: boolean;
  fillPee?: boolean;
  /** Knock water down so drinking it back up is visible on the bar. */
  drainWater?: boolean;
  /**
   * Keep whichever family yard he is standing on at AT LEAST this affection,
   * for the whole stage. Applied continuously rather than once: a one-shot
   * boost would land on pavement if he happened to be on the street, and the
   * lesson would then need ~40 tricks to reach.
   */
  boostAffection?: number;
  /**
   * Put this many seconds on the Grumbles' gate. Deliberately a countdown and
   * not an instant release — the stage would otherwise satisfy its own
   * objective on the tick it set up and flash past unread, and watching the
   * clock run down is itself the lesson about his penned HUD card.
   */
  banditCountdown?: number;
}

export interface TutorialStage {
  id: string;
  title: string;
  body: string;
  setup?: TutorialSetup;
  done: (s: TutorialState) => boolean;
  /** Shown beside the instruction, e.g. "2 / 3". */
  progress?: (s: TutorialState) => string;
}

const n = (s: TutorialState, key: string): number => s.counters[key] ?? 0;
const of = (s: TutorialState, key: string, target: number): string =>
  `${Math.min(n(s, key), target)} / ${target}`;

const TREATS = 3;
const STEPS = 15;
const SIPS = 8;
const DROPS = 8;
const TRICKS = 5;

export const TUTORIAL_STAGES: readonly TutorialStage[] = [
  {
    id: 'move',
    title: 'Get moving',
    body: 'W A S D to walk. Treats are the little bones — go collect three.',
    setup: { spawnTreats: TREATS },
    done: (s) => n(s, 'ate') >= TREATS,
    progress: (s) => of(s, 'ate', TREATS),
  },
  {
    id: 'hud',
    title: 'Your card, bottom left',
    body: 'Food is your score. Walking burns food AND water, and hot pavement burns water fastest. Take a walk and watch the bars move.',
    done: (s) => n(s, 'stepped') >= STEPS,
    progress: (s) => of(s, 'stepped', STEPS),
  },
  {
    id: 'drink',
    title: 'Stay watered',
    body: 'Ponds are the blue tiles. Stand next to one and hold Q to drink — Q for quench.',
    setup: { drainWater: true },
    done: (s) => n(s, 'drank') >= SIPS,
    progress: (s) => of(s, 'drank', SIPS),
  },
  {
    id: 'relieve',
    title: 'When you have to go',
    body: 'Hold C to poop (C for crap) and Z to pee (Z for the noise it makes) — grass only. Either one costs that family some affection, so pick your spot.',
    setup: { fillPoop: true },
    done: (s) => n(s, 'pooped') >= DROPS,
    progress: (s) => of(s, 'pooped', DROPS),
  },
  {
    id: 'yard',
    title: 'Whose lawn is this?',
    body: 'Walk onto a family yard. Current Space, bottom right, shows who owns it, how tolerant they are, and how much they like you.',
    done: (s) => s.onFamilyYard,
  },
  {
    id: 'trick',
    title: 'Win them over',
    body: 'Hold E on a lawn to do a trick. Tricks cost water, never food — do five and watch Likes You climb.',
    done: (s) => n(s, 'tricked') >= TRICKS,
    progress: (s) => of(s, 'tricked', TRICKS),
  },
  {
    id: 'thresholds',
    title: 'Better food, better yards',
    body: 'See the markers on the Likes You bar? Past them a yard starts dropping bowls, then bags, then pup cups. Trick this one past the first marker.',
    setup: { boostAffection: config.BOWL_THRESHOLD - 5 },
    done: (s) => s.yardAffection >= config.BOWL_THRESHOLD,
  },
  {
    id: 'bandit',
    title: 'Meet Bandit',
    body: 'The rival. He is shut in his own yard — watch his card count him out. Once loose he hunts treats and fouls whichever yard likes you most.',
    setup: { banditCountdown: 12 },
    done: (s) => !s.banditPenned,
  },
  {
    id: 'rawhide',
    title: `Item 1 — ${ITEMS.rawhide.name}`,
    body: 'Press 1 to drop it. Bandit drops whatever he is doing, comes running, and stays put while he chews.',
    setup: { grantItem: 'rawhide' },
    done: (s) => n(s, 'used:rawhide') >= 1,
  },
  {
    id: 'repeller',
    title: `Item 2 — ${ITEMS.repeller.name}`,
    body: 'Press 2 to fence off a patch. Bandit will not set foot inside the ring — handy over the yard you are farming.',
    setup: { grantItem: 'repeller' },
    done: (s) => n(s, 'used:repeller') >= 1,
  },
  {
    id: 'diaper',
    title: `Item 3 — ${ITEMS.diaper.name}`,
    body: 'You are full again. Press 3 to empty out on the spot without fouling anything.',
    setup: { grantItem: 'diaper', fillPoop: true, fillPee: true },
    done: (s) => n(s, 'used:diaper') >= 1,
  },
  {
    id: 'zoomies',
    title: `Item 4 — ${ITEMS.zoomies.name}`,
    body: 'Press 4 and let go of the keys. Blizzard tears around at double speed hoovering up every treat, free of charge.',
    setup: { grantItem: 'zoomies', spawnTreats: 6 },
    done: (s) => n(s, 'used:zoomies') >= 1,
  },
];

/** Every item must be taught somewhere — adding a fifth without a stage fails. */
export function itemsTaught(): ItemType[] {
  return ITEM_TYPES.filter((t) => TUTORIAL_STAGES.some((st) => st.setup?.grantItem === t));
}
