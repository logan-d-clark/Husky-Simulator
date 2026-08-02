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
    const r = rand();
    if (r <= config.BAG_LIKELIHOOD * p && owner.affection > config.BAG_THRESHOLD) return 'bag';
    if (r <= config.BOWL_LIKELIHOOD * p && owner.affection > config.BOWL_THRESHOLD) return 'bowl';
    if (r <= p) return 'treat';
    return null;
  },
};
