/**
 * Colour distance used by `comparePixels`.
 *
 * Each pixel is first composited over opaque white, which is the same as
 * premultiplying by alpha against a white background:
 *
 *   c' = (c / 255) * (a / 255) + (1 - a / 255)        for c in R, G, B
 *
 * The distance is the Euclidean distance of the composited RGB values,
 * normalised so that opaque black vs opaque white is exactly 1:
 *
 *   d = sqrt(((r1' - r2')^2 + (g1' - g2')^2 + (b1' - b2')^2) / 3),  0 <= d <= 1
 *
 * To stay deterministic the composite is computed in integers scaled by
 * 255 * 255 (`c * a + 255 * (255 - a)`), so the only floating point steps are
 * one division and one square root per pixel. Fully transparent pixels of any
 * colour therefore equal opaque white.
 */

export const COLOR_DISTANCE_FORMULA = 'rgb-euclidean-over-white';

export type RgbaTuple = readonly [number, number, number, number];

const SCALE = 255 * 255;

function compositeOverWhite(channel: number, alpha: number): number {
  return channel * alpha + 255 * (255 - alpha);
}

/** Sum of squared composited channel differences, in integer units of 1 / (255 * 255). */
export function squaredDifference(a: ArrayLike<number>, ai: number, b: ArrayLike<number>, bi: number): number {
  const alphaA = a[ai + 3] ?? 0;
  const alphaB = b[bi + 3] ?? 0;
  let sum = 0;
  for (let channel = 0; channel < 3; channel += 1) {
    const delta = compositeOverWhite(a[ai + channel] ?? 0, alphaA) - compositeOverWhite(b[bi + channel] ?? 0, alphaB);
    sum += delta * delta;
  }
  return sum;
}

export function distanceFromSquaredDifference(sum: number): number {
  return Math.sqrt(sum / 3) / SCALE;
}

/** Normalised (0..1) distance between two straight-alpha RGBA colours. */
export function colorDistance(a: RgbaTuple, b: RgbaTuple): number {
  return distanceFromSquaredDifference(squaredDifference(a, 0, b, 0));
}
