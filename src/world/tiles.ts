import type { TileType, FenceEdges } from '../types';

export interface Tile {
  col: number;
  row: number;
  type: TileType;
  ownerId: number;
  fences: FenceEdges;
  heat: number;
  dirt: number;         // poop accumulation
  destruction: number;  // pee accumulation
  foodPresent: boolean;
  houseColor?: 'marble' | 'clay';
}

export function emptyFences(): FenceEdges {
  return { top: false, bottom: false, left: false, right: false };
}
