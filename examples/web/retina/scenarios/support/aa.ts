import { comparePixels, diffRegions, type DiffRegion, type RgbaImage } from 'retina';

export interface PairResult {
  readonly checkpoint: string;
  readonly pair: readonly [number, number];
  readonly kind: string;
  readonly matchRate?: number;
  readonly comparedPixels?: number;
  readonly mismatchedPixels?: number;
  /** Largest diff regions (8-connected), only when pixels differ. */
  readonly diffRegions?: readonly DiffRegion[];
  readonly totalDiffRegions?: number;
  readonly detail?: string;
}

/** A/A: every pair of repeats of one checkpoint, exact colour match (threshold 0). */
export function compareRepeats(checkpoint: string, images: readonly RgbaImage[]): PairResult[] {
  const results: PairResult[] = [];
  for (let a = 0; a < images.length; a += 1) {
    for (let b = a + 1; b < images.length; b += 1) {
      const left = images[a];
      const right = images[b];
      if (left === undefined || right === undefined) continue;
      results.push(comparePair(checkpoint, [a + 1, b + 1], left, right));
    }
  }
  return results;
}

function comparePair(checkpoint: string, pair: readonly [number, number], left: RgbaImage, right: RgbaImage): PairResult {
  const outcome = comparePixels(left, right, { colorThreshold: 0 });
  if (outcome.kind !== 'compared') {
    return { checkpoint, pair, kind: outcome.kind, detail: JSON.stringify(outcome) };
  }
  const base = {
    checkpoint,
    pair,
    kind: outcome.kind,
    matchRate: outcome.matchRate,
    comparedPixels: outcome.comparedPixels,
    mismatchedPixels: outcome.mismatchedPixels,
  };
  if (outcome.mismatchedPixels === 0) return base;
  const regions = diffRegions(outcome.diffMask, outcome.width, outcome.height, { topN: 10 });
  return regions.kind === 'regions'
    ? { ...base, diffRegions: regions.regions, totalDiffRegions: regions.totalRegions }
    : { ...base, detail: regions.reason };
}
