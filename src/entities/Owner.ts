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

  get treatRateActive(): number {
    return this.treatRateBase * (this.affection / 25);
  }
}
