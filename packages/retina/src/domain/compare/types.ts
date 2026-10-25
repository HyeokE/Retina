/**
 * Raw image model for comparison. Decoding (PNG etc.) belongs to infrastructure;
 * the domain only sees straight (non-premultiplied) 8-bit RGBA, row-major.
 */
export interface RgbaImage {
  readonly width: number;
  readonly height: number;
  /** `width * height * 4` bytes: R, G, B, A per pixel. */
  readonly data: Uint8Array;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

/** Axis-aligned rectangle in pixels. `x`/`y` is the top-left corner. */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface InvalidInput {
  readonly kind: 'invalid_input';
  readonly reason: string;
}
