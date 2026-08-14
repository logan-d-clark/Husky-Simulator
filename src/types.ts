export type TileType = 'grass' | 'pavement' | 'house' | 'water';
export type Direction = 'up' | 'down' | 'left' | 'right';
export type FoodType = 'treat' | 'bowl' | 'bag' | 'pupcup';

export interface Inventory {
  food: number;
  water: number;
  poop: number;
  pee: number;
}
export interface FenceEdges {
  top: boolean;
  bottom: boolean;
  left: boolean;
  right: boolean;
}
export interface TileCoord {
  col: number;
  row: number;
}
