import { COLOR_DISTANCE_FORMULA, distanceFromSquaredDifference, squaredDifference } from './color-distance.ts';
import { clipRect, fullRect, invalidInput, rasterizeRects, validateImage, validateRect } from './geometry.ts';
import type { InvalidInput, Rect, RgbaImage, Size } from './types.ts';

export interface CompareOptions {
  /** Maximum colour distance (0..1, see `colorDistance`) still counted as a match. */
  readonly colorThreshold: number;
  /** Rectangles excluded from the comparison. Overlaps count once; parts outside the image are ignored. */
  readonly masks?: readonly Rect[];
  /** Restricts the comparison to this rectangle (clipped to the image). Defaults to the whole image. */
  readonly region?: Rect;
}

export interface CompareThresholds {
  readonly colorThreshold: number;
  readonly distance: typeof COLOR_DISTANCE_FORMULA;
}

export interface PixelComparison {
  readonly kind: 'compared';
  readonly width: number;
  readonly height: number;
  /** The region actually compared, after clipping. */
  readonly region: Rect;
  readonly comparedPixels: number;
  readonly mismatchedPixels: number;
  /** `1 - mismatchedPixels / comparedPixels`. This is also the pixel matched ratio. */
  readonly matchRate: number;
  /** Masked pixels inside the region. */
  readonly maskedPixels: number;
  /** `maskedPixels / region area`. */
  readonly maskedRatio: number;
  /** One byte per image pixel (`width * height`): 1 = mismatch, 0 = match, masked or outside the region. */
  readonly diffMask: Uint8Array;
  readonly thresholds: CompareThresholds;
}

/** Sizes differ. Retina never resizes to make them match; the check is INCONCLUSIVE. */
export interface SizeMismatch {
  readonly kind: 'size_mismatch';
  readonly expected: Size;
  readonly actual: Size;
}

/** Region and masks left no pixel to compare. */
export interface NothingCompared {
  readonly kind: 'nothing_compared';
  readonly regionPixels: number;
  readonly maskedPixels: number;
}

export type CompareOutcome = PixelComparison | SizeMismatch | NothingCompared | InvalidInput;

interface Counts {
  readonly compared: number;
  readonly mismatched: number;
  readonly masked: number;
}

function validateInputs(expected: RgbaImage, actual: RgbaImage, options: CompareOptions): InvalidInput | undefined {
  const imageError = validateImage(expected, 'expected image') ?? validateImage(actual, 'actual image');
  if (imageError) {
    return imageError;
  }
  const t = options.colorThreshold;
  if (!Number.isFinite(t) || t < 0 || t > 1) {
    return invalidInput('colorThreshold must be a number between 0 and 1.');
  }
  const rectErrors = [
    ...(options.region ? [validateRect(options.region, 'region')] : []),
    ...(options.masks ?? []).map((mask, i) => validateRect(mask, `masks[${i}]`)),
  ];
  return rectErrors.find((error) => error !== undefined);
}

function countPixels(
  expected: RgbaImage,
  actual: RgbaImage,
  region: Rect,
  maskBitmap: Uint8Array,
  diffMask: Uint8Array,
  threshold: number,
): Counts {
  let compared = 0;
  let mismatched = 0;
  let masked = 0;
  for (let y = region.y; y < region.y + region.height; y += 1) {
    for (let x = region.x; x < region.x + region.width; x += 1) {
      const index = y * expected.width + x;
      if (maskBitmap[index] === 1) {
        masked += 1;
        continue;
      }
      compared += 1;
      const sum = squaredDifference(expected.data, index * 4, actual.data, index * 4);
      if (sum !== 0 && distanceFromSquaredDifference(sum) > threshold) {
        mismatched += 1;
        diffMask[index] = 1;
      }
    }
  }
  return { compared, mismatched, masked };
}

/**
 * Compares two RGBA images pixel by pixel. A pixel mismatches when its colour
 * distance is strictly greater than `colorThreshold`. Inputs are never
 * mutated and never resized.
 */
export function comparePixels(expected: RgbaImage, actual: RgbaImage, options: CompareOptions): CompareOutcome {
  const invalid = validateInputs(expected, actual, options);
  if (invalid) {
    return invalid;
  }
  if (expected.width !== actual.width || expected.height !== actual.height) {
    return {
      kind: 'size_mismatch',
      expected: { width: expected.width, height: expected.height },
      actual: { width: actual.width, height: actual.height },
    };
  }
  const size: Size = { width: expected.width, height: expected.height };
  const region = clipRect(options.region ?? fullRect(size), size);
  const diffMask = new Uint8Array(size.width * size.height);
  const maskBitmap = rasterizeRects(options.masks ?? [], size);
  const counts = countPixels(expected, actual, region, maskBitmap, diffMask, options.colorThreshold);
  const regionPixels = region.width * region.height;
  if (counts.compared === 0) {
    return { kind: 'nothing_compared', regionPixels, maskedPixels: counts.masked };
  }
  return {
    kind: 'compared',
    ...size,
    region,
    comparedPixels: counts.compared,
    mismatchedPixels: counts.mismatched,
    matchRate: 1 - counts.mismatched / counts.compared,
    maskedPixels: counts.masked,
    maskedRatio: counts.masked / regionPixels,
    diffMask,
    thresholds: { colorThreshold: options.colorThreshold, distance: COLOR_DISTANCE_FORMULA },
  };
}
