export interface OwnerData {
  id: number;
  affection: number;
  sensitivity: number;
  treatRateBase: number;
  name: string;
}

// affection/sensitivity/treatRateBase are verbatim from V1 OwnerProperties.csv.
// Names are editable placeholders. id 0 = public/streets/water (no household).
export const OWNERS: OwnerData[] = [
  { id: 0, affection: 1, sensitivity: 0, treatRateBase: 0.00005, name: 'Public' },
  { id: 1, affection: 0, sensitivity: 5, treatRateBase: 0.0005, name: 'The Grumbles' },
  { id: 2, affection: 15, sensitivity: 1, treatRateBase: 0.00005, name: 'Ms. Rivera' },
  { id: 3, affection: 15, sensitivity: 1, treatRateBase: 0.00005, name: 'The Okafors' },
  { id: 4, affection: 15, sensitivity: 1, treatRateBase: 0.00005, name: 'Old Pete' },
  { id: 5, affection: 15, sensitivity: 1, treatRateBase: 0.00005, name: 'The Nguyens' },
  { id: 6, affection: 15, sensitivity: 1, treatRateBase: 0.00005, name: 'Sunny' },
  { id: 7, affection: 10, sensitivity: 2, treatRateBase: 0.0001, name: 'The Bakers' },
  { id: 8, affection: 5, sensitivity: 4, treatRateBase: 0.00035, name: 'Mr. Frost' },
  { id: 9, affection: 5, sensitivity: 3, treatRateBase: 0.0002, name: 'The Delgados' },
  { id: 10, affection: 15, sensitivity: 2, treatRateBase: 0.00015, name: 'Auntie May' },
  { id: 11, affection: 5, sensitivity: 3, treatRateBase: 0.0002, name: 'The Harts' },
  { id: 12, affection: 5, sensitivity: 3, treatRateBase: 0.00025, name: 'The Wus' },
  { id: 13, affection: 10, sensitivity: 4, treatRateBase: 0.00025, name: 'Coach Bo' },
  { id: 14, affection: 10, sensitivity: 4, treatRateBase: 0.00035, name: 'The Larsons' },
  { id: 15, affection: 15, sensitivity: 1, treatRateBase: 0.0001, name: 'Grandpa Joe' },
  { id: 16, affection: 10, sensitivity: 3, treatRateBase: 0.00015, name: 'The Pattels' },
  { id: 17, affection: 10, sensitivity: 3, treatRateBase: 0.0002, name: 'Ms. Cole' },
  { id: 18, affection: 10, sensitivity: 3, treatRateBase: 0.00015, name: 'The Kims' },
  { id: 19, affection: 5, sensitivity: 4, treatRateBase: 0.00035, name: 'The Volkovs' },
];
