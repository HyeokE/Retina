import { invalidInput, validateSize } from './geometry.ts';
import type { InvalidInput } from './types.ts';

export interface DiffRegionOptions {
  /** Regions with fewer pixels than this are dropped. Default 1. */
  readonly minArea?: number;
  /** Keep only the N largest regions. Default: all. */
  readonly topN?: number;
}

export interface DiffRegion {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  /** Number of mismatched pixels in the region (not the box area). */
  readonly area: number;
}

export interface DiffRegionList {
  readonly kind: 'regions';
  /** Sorted by area descending, then by y, then by x. */
  readonly regions: readonly DiffRegion[];
  /** Number of regions found before `minArea` and `topN` were applied. */
  readonly totalRegions: number;
}

export type DiffRegionsOutcome = DiffRegionList | InvalidInput;

/** 8-connectivity: horizontal, vertical and diagonal neighbours. */
const NEIGHBOURS: readonly (readonly [number, number])[] = [
  [-1, -1], [0, -1], [1, -1],
  [-1, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1],
];

function validate(mask: Uint8Array, width: number, height: number, options: DiffRegionOptions): InvalidInput | undefined {
  const sizeError = validateSize(width, height, 'diff mask');
  if (sizeError) {
    return sizeError;
  }
  if (mask.length !== width * height) {
    return invalidInput('diff mask length must be width * height.');
  }
  const { minArea = 1, topN } = options;
  if (!Number.isInteger(minArea) || minArea < 1) {
    return invalidInput('minArea must be a positive integer.');
  }
  if (topN !== undefined && (!Number.isInteger(topN) || topN < 0)) {
    return invalidInput('topN must be a non-negative integer.');
  }
  return undefined;
}

/** Breadth-first flood fill with an explicit queue (no recursion). */
function fillRegion(
  mask: Uint8Array,
  visited: Uint8Array,
  queue: Int32Array,
  start: number,
  width: number,
  height: number,
): DiffRegion {
  let head = 0;
  let tail = 0;
  let minX = width, minY = height, maxX = -1, maxY = -1;
  queue[tail++] = start;
  visited[start] = 1;
  while (head < tail) {
    const index = queue[head++] ?? 0;
    const x = index % width;
    const y = (index - x) / width;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    for (const [dx, dy] of NEIGHBOURS) {
      const nx = x + dx;
      const ny = y + dy;
      const next = ny * width + nx;
      if (nx >= 0 && ny >= 0 && nx < width && ny < height && mask[next] !== 0 && visited[next] === 0) {
        visited[next] = 1;
        queue[tail++] = next;
      }
    }
  }
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1, area: tail };
}

function byAreaThenPosition(a: DiffRegion, b: DiffRegion): number {
  return b.area - a.area || a.y - b.y || a.x - b.x;
}

/**
 * Groups mismatched pixels (non-zero bytes) of a diff mask into connected
 * regions using 8-connectivity and returns their bounding boxes. Iterative,
 * so large all-diff masks do not overflow the stack. The mask is not mutated.
 */
export function diffRegions(
  mask: Uint8Array,
  width: number,
  height: number,
  options: DiffRegionOptions = {},
): DiffRegionsOutcome {
  const invalid = validate(mask, width, height, options);
  if (invalid) {
    return invalid;
  }
  const visited = new Uint8Array(mask.length);
  const queue = new Int32Array(mask.length);
  const found: DiffRegion[] = [];
  for (let index = 0; index < mask.length; index += 1) {
    if (mask[index] !== 0 && visited[index] === 0) {
      found.push(fillRegion(mask, visited, queue, index, width, height));
    }
  }
  const { minArea = 1, topN = found.length } = options;
  const regions = found
    .filter((region) => region.area >= minArea)
    .sort(byAreaThenPosition)
    .slice(0, topN);
  return { kind: 'regions', regions, totalRegions: found.length };
}
