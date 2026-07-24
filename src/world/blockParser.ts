export interface ParsedBlock { cls: 'H' | 'G' | 'P' | 'W'; ownerId: number; fences: string; }

export function parseBlock(raw: string): ParsedBlock {
  const s = raw.trim();
  const cls = s[0] as ParsedBlock['cls'];
  const rest = s.slice(1);

  if (rest.length === 0) return { cls, ownerId: 0, fences: '' };

  let ownerId = 0;
  let fences = '';

  if (rest.length === 1) {
    ownerId = parseInt(rest, 10);
  } else if (rest.length === 2) {
    if (isDigit(rest[0]) && isDigit(rest[1])) ownerId = parseInt(rest, 10);
    else { ownerId = parseInt(rest[0], 10); fences = rest[1]; }
  } else if (rest.length === 3) {
    if (isDigit(rest[1])) { ownerId = parseInt(rest.slice(0, 2), 10); fences = rest[2]; }
    else { ownerId = parseInt(rest[0], 10); fences = rest.slice(1, 3); }
  } else if (rest.length === 4) {
    ownerId = parseInt(rest.slice(0, 2), 10);
    fences = rest.slice(2, 4);
  }
  return { cls, ownerId, fences };
}

function isDigit(c: string): boolean { return c >= '0' && c <= '9'; }
