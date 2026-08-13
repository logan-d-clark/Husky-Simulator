import type { Owner } from '../entities/Owner';
import type { FoodType } from '../types';
import { config } from '../config/gameConfig';

export const AffectionSystem = {
  applyAction(owner: Owner, action: 'pee' | 'poop' | 'trick'): void {
    if (action === 'pee') owner.affection = Math.max(0, owner.affection - config.PEE_COST * owner.sensitivity);
    else if (action === 'poop') owner.affection = Math.max(0, owner.affection - config.POOP_COST * owner.sensitivity);
    else if (action === 'trick') owner.affection = Math.min(100, owner.affection + config.TRICK_RATE);
  },

  rollDispense(owner: Owner, rand: () => number): FoodType | null {
    const p = owner.treatRateActive;

    // The pup cup takes its OWN roll ahead of the chain below, rather than
    // joining it. The chain resolves one draw down ascending bands, so folding a
    // pup cup in at the same likelihood as a bag would swallow the bag's whole
    // band — maxing a yard would silently stop it producing bags. Independent,
    // a perfect yard gains pup cups on top of everything it already made, and
    // every yard under 100 behaves exactly as before.
    //
    // `>=`, unlike the `>` below: affection is capped at exactly 100 by
    // applyAction, so `> 100` could never fire.
    if (owner.affection >= config.PUPCUP_THRESHOLD && rand() <= config.PUPCUP_LIKELIHOOD * p) return 'pupcup';

    const r = rand();
    if (r <= config.BAG_LIKELIHOOD * p && owner.affection > config.BAG_THRESHOLD) return 'bag';
    if (r <= config.BOWL_LIKELIHOOD * p && owner.affection > config.BOWL_THRESHOLD) return 'bowl';
    if (r <= p) return 'treat';
    return null;
  },
};
