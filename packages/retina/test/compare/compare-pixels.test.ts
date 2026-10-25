import { describe, expect, it } from 'vitest';
import { colorDistance, comparePixels, type CompareOutcome, type PixelComparison } from '../../src/index.ts';
import { BLACK, deepFreeze, solidImage, TRANSPARENT_BLACK, WHITE, withPixel } from '../helpers/fixtures.ts';

function compared(outcome: CompareOutcome): PixelComparison {
  if (outcome.kind !== 'compared') {
    throw new Error(`expected a comparison, got ${outcome.kind}`);
  }
  return outcome;
}

const white10 = solidImage(10, 10, WHITE);
const oneBlack = withPixel(white10, 3, 4, BLACK);

describe('comparePixels: match rate', () => {
  it('reports matchRate 1 for identical images', () => {
    const result = compared(comparePixels(solidImage(4, 4, WHITE), solidImage(4, 4, WHITE), { colorThreshold: 0 }));
    expect(result).toMatchObject({ comparedPixels: 16, mismatchedPixels: 0, matchRate: 1, maskedPixels: 0, maskedRatio: 0 });
    expect(result.diffMask).toEqual(new Uint8Array(16));
  });

  it('finds a single changed pixel in a 10x10 image', () => {
    const result = compared(comparePixels(white10, oneBlack, { colorThreshold: 0.1 }));
    expect(result.comparedPixels).toBe(100);
    expect(result.mismatchedPixels).toBe(1);
    expect(result.matchRate).toBeCloseTo(0.99, 10);
    expect(result.diffMask[4 * 10 + 3]).toBe(1);
    expect(result.diffMask.reduce((sum, v) => sum + v, 0)).toBe(1);
  });

  it('reports the thresholds and distance formula it used', () => {
    const result = compared(comparePixels(white10, oneBlack, { colorThreshold: 0.1 }));
    expect(result.thresholds).toEqual({ colorThreshold: 0.1, distance: 'rgb-euclidean-over-white' });
  });

  it('is deterministic', () => {
    const a = comparePixels(white10, oneBlack, { colorThreshold: 0.05 });
    const b = comparePixels(white10, oneBlack, { colorThreshold: 0.05 });
    expect(a).toEqual(b);
  });
});

describe('comparePixels: masks', () => {
  it('excludes masked pixels from the comparison and reports the masked ratio', () => {
    const result = compared(
      comparePixels(white10, oneBlack, { colorThreshold: 0, masks: [{ x: 2, y: 3, width: 3, height: 2 }] }),
    );
    expect(result).toMatchObject({ comparedPixels: 94, mismatchedPixels: 0, matchRate: 1, maskedPixels: 6 });
    expect(result.maskedRatio).toBeCloseTo(0.06, 10);
    expect(result.diffMask[4 * 10 + 3]).toBe(0);
  });

  it('counts overlapping masks once and clips masks to the image', () => {
    const result = compared(
      comparePixels(white10, white10, {
        colorThreshold: 0,
        masks: [
          { x: 0, y: 0, width: 2, height: 2 },
          { x: 1, y: 1, width: 2, height: 2 },
          { x: 9, y: 9, width: 5, height: 5 },
        ],
      }),
    );
    expect(result.maskedPixels).toBe(7 + 1);
    expect(result.comparedPixels).toBe(92);
  });

  it('reports nothing_compared when masks cover the whole region', () => {
    const outcome = comparePixels(white10, oneBlack, { colorThreshold: 0, masks: [{ x: 0, y: 0, width: 10, height: 10 }] });
    expect(outcome).toEqual({ kind: 'nothing_compared', regionPixels: 100, maskedPixels: 100 });
  });
});

describe('comparePixels: region', () => {
  it('restricts the comparison to the region', () => {
    const outside = compared(
      comparePixels(white10, oneBlack, { colorThreshold: 0, region: { x: 5, y: 5, width: 5, height: 5 } }),
    );
    expect(outside).toMatchObject({ comparedPixels: 25, mismatchedPixels: 0, matchRate: 1 });
    expect(outside.region).toEqual({ x: 5, y: 5, width: 5, height: 5 });

    const inside = compared(
      comparePixels(white10, oneBlack, { colorThreshold: 0, region: { x: 0, y: 0, width: 5, height: 5 } }),
    );
    expect(inside).toMatchObject({ comparedPixels: 25, mismatchedPixels: 1, matchRate: 0.96 });
  });

  it('measures the masked ratio against the region area', () => {
    const result = compared(
      comparePixels(white10, white10, {
        colorThreshold: 0,
        region: { x: 0, y: 0, width: 5, height: 4 },
        masks: [{ x: 3, y: 0, width: 4, height: 1 }],
      }),
    );
    expect(result).toMatchObject({ comparedPixels: 18, maskedPixels: 2, maskedRatio: 0.1 });
  });

  it('clips a region that extends past the image', () => {
    const result = compared(
      comparePixels(white10, white10, { colorThreshold: 0, region: { x: 8, y: 8, width: 10, height: 10 } }),
    );
    expect(result.region).toEqual({ x: 8, y: 8, width: 2, height: 2 });
    expect(result.comparedPixels).toBe(4);
  });

  it('reports nothing_compared for a region outside the image', () => {
    expect(comparePixels(white10, white10, { colorThreshold: 0, region: { x: 20, y: 20, width: 2, height: 2 } })).toEqual({
      kind: 'nothing_compared',
      regionPixels: 0,
      maskedPixels: 0,
    });
  });
});

describe('comparePixels: size and input errors', () => {
  it('reports a size mismatch and never resizes', () => {
    const outcome = comparePixels(solidImage(10, 10, WHITE), solidImage(10, 12, WHITE), { colorThreshold: 0.5 });
    expect(outcome).toEqual({
      kind: 'size_mismatch',
      expected: { width: 10, height: 10 },
      actual: { width: 10, height: 12 },
    });
  });

  it('rejects image data whose length does not match its size', () => {
    const broken = { width: 2, height: 2, data: new Uint8Array(15) };
    expect(comparePixels(broken, broken, { colorThreshold: 0 })).toMatchObject({ kind: 'invalid_input' });
  });

  it('rejects a threshold outside 0..1 and malformed rectangles', () => {
    expect(comparePixels(white10, white10, { colorThreshold: 1.5 })).toMatchObject({ kind: 'invalid_input' });
    expect(comparePixels(white10, white10, { colorThreshold: Number.NaN })).toMatchObject({ kind: 'invalid_input' });
    expect(
      comparePixels(white10, white10, { colorThreshold: 0, masks: [{ x: 0, y: 0, width: -1, height: 2 }] }),
    ).toMatchObject({ kind: 'invalid_input' });
    expect(
      comparePixels(white10, white10, { colorThreshold: 0, region: { x: 0.5, y: 0, width: 2, height: 2 } }),
    ).toMatchObject({ kind: 'invalid_input' });
  });
});

describe('comparePixels: color threshold', () => {
  const light = withPixel(white10, 0, 0, [250, 250, 250, 255]);
  const lightDistance = 5 / 255;

  it('documents the distance of a near-white pixel', () => {
    expect(colorDistance([255, 255, 255, 255], [250, 250, 250, 255])).toBeCloseTo(lightDistance, 12);
    expect(colorDistance([255, 255, 255, 255], [0, 0, 0, 255])).toBe(1);
  });

  it('treats a difference at or below the threshold as a match', () => {
    expect(compared(comparePixels(white10, light, { colorThreshold: 0.05 })).mismatchedPixels).toBe(0);
    expect(compared(comparePixels(white10, light, { colorThreshold: lightDistance })).mismatchedPixels).toBe(0);
  });

  it('treats a difference above the threshold as a mismatch', () => {
    expect(compared(comparePixels(white10, light, { colorThreshold: 0.01 })).mismatchedPixels).toBe(1);
    expect(compared(comparePixels(white10, light, { colorThreshold: 0 })).mismatchedPixels).toBe(1);
  });

  it('composites alpha over white before measuring', () => {
    const transparent = withPixel(white10, 0, 0, TRANSPARENT_BLACK);
    expect(compared(comparePixels(white10, transparent, { colorThreshold: 0 })).mismatchedPixels).toBe(0);
    expect(colorDistance([0, 0, 0, 0], [255, 255, 255, 255])).toBe(0);
    expect(colorDistance([0, 0, 0, 128], [255, 255, 255, 255])).toBeCloseTo(128 / 255, 12);
    expect(compared(comparePixels(white10, oneBlack, { colorThreshold: 0.99 })).mismatchedPixels).toBe(1);
  });
});

describe('comparePixels: immutability', () => {
  it('does not mutate the images or options', () => {
    const expected = solidImage(10, 10, WHITE);
    const actual = withPixel(expected, 1, 1, BLACK);
    const expectedCopy = new Uint8Array(expected.data);
    const actualCopy = new Uint8Array(actual.data);
    const options = deepFreeze({
      colorThreshold: 0.1,
      masks: [{ x: 0, y: 0, width: 1, height: 1 }],
      region: { x: 0, y: 0, width: 8, height: 8 },
    });
    const result = compared(comparePixels(deepFreeze(expected), deepFreeze(actual), options));
    expect(expected.data).toEqual(expectedCopy);
    expect(actual.data).toEqual(actualCopy);
    expect(result.diffMask).not.toBe(expected.data);
  });
});
