// The four deployable items. One table drives the number-key bindings, the HUD
// row and the first-pickup tutorial, so a new item cannot be half-wired: adding
// it here is what makes it deployable, countable and explainable at once.

export type ItemType = 'rawhide' | 'repeller' | 'diaper' | 'zoomies';

export interface ItemInfo {
  /** Number key that deploys it, as shown to the player. Phaser's addKey maps
   *  strings through KeyCodes, which has no '1' — only ONE — so the binding
   *  uses `keyCode` below, never this string. */
  key: '1' | '2' | '3' | '4';
  /** Phaser KeyCode for that digit (KeyCodes.ONE is 49). */
  keyCode: number;
  name: string;
  /** Shown in the pause panel the first time Blizzard picks one up. */
  blurb: string;
}

export const ITEMS: Record<ItemType, ItemInfo> = {
  rawhide: {
    key: '1',
    keyCode: 49,
    name: 'Rawhide',
    blurb:
      'Drop it and Bandit comes running from anywhere on the map — then he ' +
      'settles in to chew and forgets whatever he was up to. He will not budge ' +
      'until it is gone.',
  },
  repeller: {
    key: '2',
    keyCode: 50,
    name: 'Sonic Dog Repeller',
    blurb:
      'Drop it to fence off a patch of the neighbourhood. Bandit will not ' +
      'set foot inside the ring and quietly routes around it. It does not ' +
      'bother you at all.',
  },
  diaper: {
    key: '3',
    keyCode: 51,
    name: 'Doggy Diaper',
    blurb:
      'Empties your poop and pee to nothing on the spot — and leaves the ' +
      'lawn spotless. A get-out-of-jail card for when you are full and ' +
      'standing somewhere you would rather not ruin.',
  },
  zoomies: {
    key: '4',
    keyCode: 52,
    name: 'Zoom Zoom Chew',
    blurb:
      'Caffeinated. You lose the wheel for half a minute while Blizzard ' +
      'tears around at double speed hoovering up every treat on the map. ' +
      'All that running is free — though the sun still finds him.',
  },
};

/** Deployment order — index 0 is key "1". */
export const ITEM_TYPES: readonly ItemType[] = ['rawhide', 'repeller', 'diaper', 'zoomies'];

/** The item a number key deploys, or null for any other key. */
export function itemForKey(key: string): ItemType | null {
  return ITEM_TYPES.find((t) => ITEMS[t].key === key) ?? null;
}
