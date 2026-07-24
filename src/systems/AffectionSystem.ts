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
