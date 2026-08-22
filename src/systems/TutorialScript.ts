import type { Inventory } from '../types';
import type { ItemType } from '../entities/Item';
import { ITEM_TYPES, ITEMS } from '../entities/Item';
import type { ItemCounts } from './ItemSystem';
import { config } from '../config/gameConfig';

// The walkthrough, as pure data. Keeping the script and its objectives free of
// Phaser is what makes a thirteen-stage tutorial testable at all: the entire
// progression can be driven in a unit test instead of played thirteen times.
//
// Ordering is load-bearing. Nothing may lean on a term the player has not met —
// relieving used to say fouling "costs affection" three stages before affection
// existed. `tests/systems/TutorialDirector.test.ts` enforces that as an
// invariant rather than a review note.

/** Part of the HUD a stage is talking about, outlined while it runs. */
export type HudRegion =
  'blizzardCard' | 'waterBar' | 'currentSpace' | 'affectionBar' | 'spotBars' | 'banditCard' | 'itemBelt';

/** What an objective is allowed to look at. */
export interface TutorialState {
  inv: Inventory;
  onFamilyYard: boolean;
  /** Affection of the yard he is standing on; 0 on public land. */
  yardAffection: number;
  items: ItemCounts;
  banditPenned: boolean;
  /** True while the Zoom Zoom Chew is still running. */
  zooming: boolean;
  /** Reset to zero on every stage change, so "3 treats" means three THIS stage. */
  counters: Readonly<Record<string, number>>;
}

/** Events GameScene reports as they really happen. */
export type TutorialEvent =
  | 'ate'
  | 'drank'
  | 'pooped'
  | 'tricked'
  | 'stepped'
  /** Bumped every tick, so a stage can insist on being readable before it ends. */
  | 'tick'
  | `used:${ItemType}`;

// Ticks a stage must be up before an instantly-satisfiable objective may pass.
// Without it, a stage whose condition is already true when it starts — standing
// on a lawn when the lawn stage begins — completes on its first frame and its
// copy is never read.
const READABLE_TICKS = 30;

/**
 * Declarative world setup. The script says WHAT a stage needs; GameScene decides
 * how — which is what keeps this module pure.
 */
export interface TutorialSetup {
  /** Scatter this many treats on family lawns within easy reach. */
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
  /** HUD region to outline while this stage runs. */
  highlight?: HudRegion;
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
    body: 'W A S D to walk. Treats are the little bones, and they come from the families whose lawns you walk on — go collect three.',
    setup: { spawnTreats: TREATS },
    done: (s) => n(s, 'ate') >= TREATS,
    progress: (s) => of(s, 'ate', TREATS),
  },
  {
    id: 'hud',
    title: 'Your card, bottom left',
    body: 'Food is your score. Water is your life. Walking burns both, and hot pavement burns water fastest. To win you must last the whole day without either hitting zero — and finish with more food than Bandit. Take a walk and watch the bars.',
    highlight: 'blizzardCard',
    done: (s) => n(s, 'stepped') >= STEPS,
    progress: (s) => of(s, 'stepped', STEPS),
  },
  {
    id: 'drink',
    title: 'Stay watered',
    body: 'Ponds are the blue tiles. Stand next to one and hold Q to drink — Q for quench.',
    setup: { drainWater: true },
    highlight: 'waterBar',
    done: (s) => n(s, 'drank') >= SIPS,
    progress: (s) => of(s, 'drank', SIPS),
  },
  {
    id: 'yard',
    title: 'Whose lawn is this?',
    body: 'Step onto a family lawn. Current Space, bottom right, names them and shows two things: how much they LIKE you, which decides how good the food is that they put out — and how TOLERANT they are, which is how little they mind you making a mess on it.',
    highlight: 'currentSpace',
    done: (s) => s.onFamilyYard && n(s, 'tick') >= READABLE_TICKS,
  },
  {
    id: 'trick',
    title: 'Win them over',
    body: 'Hold E on a lawn to do a trick — E for exercise. Tricks cost water, never food. Do five and watch Likes You climb.',
    highlight: 'affectionBar',
    done: (s) => n(s, 'tricked') >= TRICKS,
    progress: (s) => of(s, 'tricked', TRICKS),
  },
  {
    id: 'thresholds',
    title: 'What their liking buys you',
    body: 'The markers on the Likes You bar are the food they will put out. Past the first, this lawn starts leaving bowls; past the next, bags; at the very top, pup cups. Trick it past that first marker.',
    setup: { boostAffection: config.BOWL_THRESHOLD - 5 },
    highlight: 'affectionBar',
    done: (s) => s.yardAffection >= config.BOWL_THRESHOLD,
  },
  {
    id: 'relieve',
    title: 'When you have to go',
    body: 'Hold C to poop (C for crap) and Z to pee (Z for the noise) — grass only. It costs that family some of the liking you just earned, and the less tolerant they are, the more it costs. Watch the two bars on the right of Current Space: each spot holds only so much, so you cannot keep using the same one.',
    setup: { fillPoop: true },
    highlight: 'spotBars',
    done: (s) => n(s, 'pooped') >= DROPS,
    progress: (s) => of(s, 'pooped', DROPS),
  },
  {
    id: 'bandit',
    title: 'Meet Bandit',
    body: 'The rival, shut in his own yard for now — watch his card count him out. He eats what you do, and he fills up like you do: when he needs to go he heads for whichever lawn likes you MOST and ruins it.',
    setup: { banditCountdown: 12 },
    highlight: 'banditCard',
    done: (s) => !s.banditPenned,
  },
  {
    id: 'rawhide',
    title: `Item 1 — ${ITEMS.rawhide.name}`,
    body: `You never start with items: they turn up in random spots around the map as the day goes on, more often the more food you are carrying, and one arrives free every ${config.ITEM_MILESTONE_FOOD} food. Here is one. Press 1 to drop it — Bandit abandons whatever he was doing, comes running, and stays put while he chews.`,
    setup: { grantItem: 'rawhide' },
    highlight: 'itemBelt',
    done: (s) => n(s, 'used:rawhide') >= 1,
  },
  {
    id: 'repeller',
    title: `Item 2 — ${ITEMS.repeller.name}`,
    body: 'Press 2 to fence off a patch. Bandit will not set foot inside the ring — worth dropping on the lawn you have spent all day buttering up.',
    setup: { grantItem: 'repeller' },
    highlight: 'itemBelt',
    done: (s) => n(s, 'used:repeller') >= 1,
  },
  {
    id: 'diaper',
    title: `Item 3 — ${ITEMS.diaper.name}`,
    body: 'You are full again. Press 3 to empty out on the spot without costing anyone a thing.',
    setup: { grantItem: 'diaper', fillPoop: true, fillPee: true },
    highlight: 'itemBelt',
    done: (s) => n(s, 'used:diaper') >= 1,
  },
  {
    id: 'zoomies',
    title: `Item 4 — ${ITEMS.zoomies.name}`,
    body: 'Press 4 and take your hands off the keys. Blizzard tears around at double speed hoovering up every treat on the map, free of charge. Watch him go.',
    setup: { grantItem: 'zoomies', spawnTreats: 6 },
    highlight: 'itemBelt',
    // Not merely "was used": that is true the instant it is pressed, which ended
    // the walkthrough before the player ever saw the item do anything.
    done: (s) => n(s, 'used:zoomies') >= 1 && !s.zooming,
  },
];

/** Every item must be taught somewhere — adding a fifth without a stage fails. */
export function itemsTaught(): ItemType[] {
  return ITEM_TYPES.filter((t) => TUTORIAL_STAGES.some((st) => st.setup?.grantItem === t));
}
