import { parseBlock } from './blockParser';
import { emptyFences, type Tile } from './tiles';
import type { TileType } from '../types';
import { config } from '../config/gameConfig';

export interface GameMap {
  rows: number;
  cols: number;
  tiles: Tile[][];
}

const CLASS_TO_TYPE: Record<string, TileType> = {
  G: 'grass',
  H: 'house',
  P: 'pavement',
  W: 'water',
};

export function parseMap(csvText: string): GameMap {
  const lines = csvText
    .replace(/\r/g, '')
    .split('\n')
    .filter((l) => l.trim().length > 0);
  const tiles: Tile[][] = [];

  lines.forEach((line, row) => {
    const cells = line.split(',');
    const rowTiles: Tile[] = cells.map((cell, col) => {
      const { cls, ownerId, fences } = parseBlock(cell);
      const type = CLASS_TO_TYPE[cls];
      const fenceEdges = emptyFences();
      if (fences.includes('l')) fenceEdges.left = true;
      if (fences.includes('r')) fenceEdges.right = true;
      if (fences.includes('t')) fenceEdges.top = true;
      if (fences.includes('b')) fenceEdges.bottom = true;
      const heat = type === 'grass' ? config.HEAT_GRASS : type === 'pavement' ? config.HEAT_PAVEMENT : 0;
      return {
        col,
        row,
        type,
        ownerId,
        fences: fenceEdges,
        heat,
        dirt: 0,
        destruction: 0,
        foodPresent: false,
        houseColor: type === 'house' ? 'marble' : undefined,
      };
    });
    tiles.push(rowTiles);
  });

  return { rows: tiles.length, cols: tiles[0]?.length ?? 0, tiles };
}
