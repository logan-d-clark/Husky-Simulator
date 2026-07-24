import { describe, it, expect } from 'vitest';
import { parseMap } from '../../src/world/MapParser';
import { Grid } from '../../src/world/Grid';

// row0: grass(G0) | house(H) | grass with right-fence(G0r)
// row1: grass(G0)   grass(G0)   grass with left-fence(G0l)
const CSV = `G0,H,G0r
G0,G0,G0l`;

describe('Grid', () => {
  const grid = new Grid(parseMap(CSV));

  it('blocks moving into a house', () => {
    expect(grid.canMove({ col: 0, row: 0 }, 'right')).toBe(false);
  });
  it('blocks moving off-grid', () => {
    expect(grid.canMove({ col: 0, row: 0 }, 'left')).toBe(false);
    expect(grid.canMove({ col: 0, row: 0 }, 'up')).toBe(false);
  });
  it('allows an open move', () => {
    expect(grid.canMove({ col: 0, row: 0 }, 'down')).toBe(true);
  });
  it('blocks across a fenced edge (right fence on source)', () => {
    // tile (2,0) has right fence; moving right would leave grid anyway,
    // so test the left-fence pair: (2,1) has left fence -> moving left blocked
    expect(grid.canMove({ col: 2, row: 1 }, 'left')).toBe(false);
  });
  it('computes neighbor coord', () => {
    expect(grid.neighbor({ col: 1, row: 1 }, 'up')).toEqual({ col: 1, row: 0 });
  });
  it('tile center pixel', () => {
    expect(grid.tileToPixel({ col: 0, row: 0 })).toEqual({ x: 14, y: 14 });
  });
});
