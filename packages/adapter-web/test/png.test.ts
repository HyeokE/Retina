import { PNG } from 'pngjs';
import { describe, expect, it } from 'vitest';
import { decodePng } from '../src/png.ts';

function encode(width: number, height: number, fill: (x: number, y: number) => readonly [number, number, number, number]): Uint8Array {
  const png = new PNG({ width, height });
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const [r, g, b, a] = fill(x, y);
      png.data[offset] = r;
      png.data[offset + 1] = g;
      png.data[offset + 2] = b;
      png.data[offset + 3] = a;
    }
  }
  return new Uint8Array(PNG.sync.write(png));
}

describe('decodePng', () => {
  it('decodes to straight 8-bit RGBA with the PNG dimensions', () => {
    const bytes = encode(3, 2, (x, y) => [x * 10, y * 20, 255, x === 0 ? 128 : 255]);
    const result = decodePng(bytes);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.image.width).toBe(3);
    expect(result.image.height).toBe(2);
    expect(result.image.data).toBeInstanceOf(Uint8Array);
    expect(result.image.data.length).toBe(3 * 2 * 4);
    // Pixel (0, 0) keeps its alpha unpremultiplied; pixel (2, 1) is opaque.
    expect([...result.image.data.subarray(0, 4)]).toEqual([0, 0, 255, 128]);
    expect([...result.image.data.subarray(20, 24)]).toEqual([20, 20, 255, 255]);
  });

  it('decodes a view into a larger buffer (non-zero byteOffset)', () => {
    const bytes = encode(1, 1, () => [1, 2, 3, 4]);
    const padded = new Uint8Array(bytes.length + 8);
    padded.set(bytes, 8);
    const result = decodePng(padded.subarray(8));
    expect(result.ok && [...result.image.data]).toEqual([1, 2, 3, 4]);
  });

  it('returns decode_failed instead of throwing for bytes that are not a PNG', () => {
    const result = decodePng(new Uint8Array([1, 2, 3, 4, 5]));
    expect(result).toMatchObject({ ok: false, code: 'decode_failed' });
  });
});
