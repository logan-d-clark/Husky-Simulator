import { describe, it, expect } from 'vitest';
import { parseBlock } from '../../src/world/blockParser';

describe('parseBlock', () => {
  it('plain grass G0', () => {
    expect(parseBlock('G0')).toEqual({ cls: 'G', ownerId: 0, fences: '' });
  });
  it('single-digit owner grass G1', () => {
    expect(parseBlock('G1')).toEqual({ cls: 'G', ownerId: 1, fences: '' });
  });
  it('two-digit owner grass G19', () => {
    expect(parseBlock('G19')).toEqual({ cls: 'G', ownerId: 19, fences: '' });
  });
  it('single-digit owner + one fence G3l', () => {
    expect(parseBlock('G3l')).toEqual({ cls: 'G', ownerId: 3, fences: 'l' });
  });
  it('two-digit owner + one fence G14r', () => {
    expect(parseBlock('G14r')).toEqual({ cls: 'G', ownerId: 14, fences: 'r' });
  });
  it('single-digit owner + two fences G9lt', () => {
    expect(parseBlock('G9lt')).toEqual({ cls: 'G', ownerId: 9, fences: 'lt' });
  });
  it('two-digit owner + two fences G10rb', () => {
    expect(parseBlock('G10rb')).toEqual({ cls: 'G', ownerId: 10, fences: 'rb' });
  });
  it('bare G (owner 0)', () => {
    expect(parseBlock('G')).toEqual({ cls: 'G', ownerId: 0, fences: '' });
  });
  it('house H', () => {
    expect(parseBlock('H')).toEqual({ cls: 'H', ownerId: 0, fences: '' });
  });
  it('pavement P0', () => {
    expect(parseBlock('P0')).toEqual({ cls: 'P', ownerId: 0, fences: '' });
  });
  it('water W0', () => {
    expect(parseBlock('W0')).toEqual({ cls: 'W', ownerId: 0, fences: '' });
  });
});
