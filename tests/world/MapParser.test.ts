import { describe, it, expect } from 'vitest';
import { parseMap } from '../../src/world/MapParser';

const CSV = `G1,H,P0,W0
G3l,G3,G,G0`;

describe('parseMap', () => {
  it('builds a 2x4 grid', () => {
    const m = parseMap(CSV);
    expect(m.rows).toBe(2);
    expect(m.cols).toBe(4);
  });
  it('maps classes to tile types', () => {
    const m = parseMap(CSV);
    expect(m.tiles[0][0].type).toBe('grass');
    expect(m.tiles[0][1].type).toBe('house');
    expect(m.tiles[0][2].type).toBe('pavement');
    expect(m.tiles[0][3].type).toBe('water');
  });
  it('assigns owner id to grass', () => {
    expect(parseMap(CSV).tiles[0][0].ownerId).toBe(1);
  });
  it('sets fence edges from metadata', () => {
    const t = parseMap(CSV).tiles[1][0]; // G3l
    expect(t.fences.left).toBe(true);
    expect(t.fences.right).toBe(false);
  });
  it('grass heat = HEAT_GRASS, pavement = HEAT_PAVEMENT, water = 0', () => {
    const m = parseMap(CSV);
    expect(m.tiles[0][0].heat).toBeCloseTo(0.01);
    expect(m.tiles[0][2].heat).toBeCloseTo(0.05);
    expect(m.tiles[0][3].heat).toBe(0);
  });
});

import realCsv from '../../src/data/map.csv?raw';
it('parses the real 26x48 map', () => {
  const m = parseMap(realCsv);
  expect(m.rows).toBe(26);
  expect(m.cols).toBe(48);
});
