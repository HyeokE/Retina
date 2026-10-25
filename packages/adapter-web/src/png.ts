import { PNG } from 'pngjs';
import type { RgbaImage } from 'retina';
import { describeError, failure, type WebAdapterResult } from './result.ts';

/**
 * Decodes PNG bytes into straight 8-bit RGBA (`RgbaImage`). pngjs expands
 * palette, grey and 16-bit images to 8-bit RGBA.
 *
 * Lives in adapter-web for now because only web captures need it. It is a
 * candidate to move into retina's infrastructure layer once the native
 * adapters decode screenshots too.
 */
export function decodePng(bytes: Uint8Array): WebAdapterResult<{ readonly image: RgbaImage }> {
  try {
    const decoded = PNG.sync.read(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength));
    const { width, height, data } = decoded;
    if (data.length !== width * height * 4) {
      return failure('decode_failed', 'decoded pixel data is not width * height * 4 bytes');
    }
    const pixels = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
    return { ok: true, image: { width, height, data: pixels } };
  } catch (error) {
    return failure('decode_failed', `PNG decoding failed: ${describeError(error)}`);
  }
}
