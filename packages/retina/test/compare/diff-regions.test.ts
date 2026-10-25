import { describe, expect, it } from 'vitest';
import { diffRegions, type DiffRegionList, type DiffRegionsOutcome } from '../../src/index.ts';
import { maskFromPoints, maskFromRects } from '../helpers/fixtures.ts';

function regions(outcome: DiffRegionsOutcome): DiffRegionList {
  if (outcome.kind !== 'regions') {
    throw new Error(`expected regions, got ${outcome.kind}`);
  }
  return outcome;
}

describe('diffRegions', () => {
  it('finds two separate blobs with correct boxes, largest first', () => {
    const mask = maskFromRects(10, 10, [
      { x: 6, y: 6, width: 2, height: 2 },
      { x: 1, y: 1, width: 3, height: 2 },
    ]);
    const result = regions(diffRegions(mask, 10, 10));
    expect(result.totalRegions).toBe(2);
    expect(result.regions).toEqual([
      { x: 1, y: 1, width: 3, height: 2, area: 6 },
      { x: 6, y: 6, width: 2, height: 2, area: 4 },
    ]);
  });

  it('uses 8-connectivity, so diagonal neighbours form one region', () => {
    const mask = maskFromPoints(4, 4, [
      [0, 0],
      [1, 1],
      [2, 2],
    ]);
    expect(regions(diffRegions(mask, 4, 4)).regions).toEqual([{ x: 0, y: 0, width: 3, height: 3, area: 3 }]);
  });

  it('reports area as the pixel count, not the box size', () => {
    const mask = maskFromPoints(5, 5, [
      [0, 0],
      [1, 0],
      [2, 0],
      [2, 1],
      [2, 2],
    ]);
    expect(regions(diffRegions(mask, 5, 5)).regions).toEqual([{ x: 0, y: 0, width: 3, height: 3, area: 5 }]);
  });

  it('applies minArea and topN after sorting, and keeps the total count', () => {
    const mask = maskFromRects(20, 20, [
      { x: 0, y: 0, width: 1, height: 1 },
      { x: 5, y: 5, width: 2, height: 2 },
      { x: 10, y: 10, width: 3, height: 3 },
      { x: 15, y: 15, width: 4, height: 4 },
    ]);
    const result = regions(diffRegions(mask, 20, 20, { minArea: 2, topN: 2 }));
    expect(result.totalRegions).toBe(4);
    expect(result.regions.map((r) => r.area)).toEqual([16, 9]);
  });

  it('orders equal areas by position for deterministic output', () => {
    const mask = maskFromPoints(5, 5, [
      [4, 4],
      [0, 2],
      [2, 0],
    ]);
    expect(regions(diffRegions(mask, 5, 5)).regions.map((r) => [r.x, r.y])).toEqual([
      [2, 0],
      [0, 2],
      [4, 4],
    ]);
  });

  it('returns no regions for an empty mask', () => {
    expect(regions(diffRegions(new Uint8Array(9), 3, 3))).toEqual({ kind: 'regions', regions: [], totalRegions: 0 });
  });

  it('handles a 1000x1000 all-diff mask without a stack overflow', () => {
    const mask = new Uint8Array(1000 * 1000).fill(1);
    const result = regions(diffRegions(mask, 1000, 1000));
    expect(result.regions).toEqual([{ x: 0, y: 0, width: 1000, height: 1000, area: 1_000_000 }]);
  });

  it('rejects a mask whose length does not match the size, and bad options', () => {
    expect(diffRegions(new Uint8Array(8), 3, 3)).toMatchObject({ kind: 'invalid_input' });
    expect(diffRegions(new Uint8Array(9), 3, 3, { topN: -1 })).toMatchObject({ kind: 'invalid_input' });
    expect(diffRegions(new Uint8Array(9), 3, 3, { minArea: 0.5 })).toMatchObject({ kind: 'invalid_input' });
  });

  it('does not mutate the mask', () => {
    const mask = maskFromRects(6, 6, [{ x: 1, y: 1, width: 2, height: 2 }]);
    const copy = new Uint8Array(mask);
    regions(diffRegions(mask, 6, 6));
    expect(mask).toEqual(copy);
  });
});
