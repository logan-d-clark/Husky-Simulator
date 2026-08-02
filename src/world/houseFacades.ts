import type { GameMap } from './MapParser';

export type HouseFace = 'roof' | 'door' | 'window' | 'bare';

// Facade tiles whose row is within this many rows of the map's bottom edge face
// off-screen (their front is implied to be at the top), so they get no door.
export const BOTTOM_BAND = 3;

const k = (c: number, r: number): string => `${c},${r}`;

// Assign a face to every house tile: roof for interior/side tiles, and for each
// house's street-facing facade row exactly one `door` (unless it's a bottom-of-
// map house) with the remaining facade tiles alternating `window`/`bare`.
export function assignHouseFaces(map: GameMap): Map<string, HouseFace> {
  const { rows, cols, tiles } = map;
  const isHouse = (c: number, r: number): boolean =>
    r >= 0 && r < rows && c >= 0 && c < cols && tiles[r][c].type === 'house';

  const result = new Map<string, HouseFace>();
  const visited = new Set<string>();

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!isHouse(c, r) || visited.has(k(c, r))) continue;

      // Flood-fill the connected house (4-connectivity).
      const comp: { c: number; r: number }[] = [];
      const stack = [{ c, r }];
      visited.add(k(c, r));
      while (stack.length > 0) {
        const t = stack.pop()!;
        comp.push(t);
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nc = t.c + dc, nr = t.r + dr;
          if (isHouse(nc, nr) && !visited.has(k(nc, nr))) {
            visited.add(k(nc, nr));
            stack.push({ c: nc, r: nr });
          }
        }
      }

      for (const t of comp) result.set(k(t.c, t.r), 'roof');

      // Facade = tiles with no house directly below them.
      const facade = comp.filter((t) => !isHouse(t.c, t.r + 1));
      if (facade.length === 0) continue;

      const bottomHouse = facade.some((t) => t.r >= rows - BOTTOM_BAND);
      let door: { c: number; r: number } | null = null;
      if (!bottomHouse) {
        // Door on the facade tile nearest the facade's horizontal center.
        const avg = facade.reduce((s, t) => s + t.c, 0) / facade.length;
        door = facade.reduce((best, t) => (Math.abs(t.c - avg) < Math.abs(best.c - avg) ? t : best), facade[0]);
      }
      for (const t of facade) {
        if (door && t.c === door.c && t.r === door.r) result.set(k(t.c, t.r), 'door');
        else result.set(k(t.c, t.r), t.c % 2 === 0 ? 'window' : 'bare');
      }
    }
  }
  return result;
}
