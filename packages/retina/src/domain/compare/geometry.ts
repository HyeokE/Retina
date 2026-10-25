import type { InvalidInput, Rect, RgbaImage, Size } from './types.ts';

export function invalidInput(reason: string): InvalidInput {
  return { kind: 'invalid_input', reason };
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

export function validateSize(width: number, height: number, label: string): InvalidInput | undefined {
  if (!isPositiveInteger(width) || !isPositiveInteger(height)) {
    return invalidInput(`${label} must have a positive integer width and height.`);
  }
  return undefined;
}

export function validateImage(image: RgbaImage, label: string): InvalidInput | undefined {
  const sizeError = validateSize(image.width, image.height, label);
  if (sizeError) {
    return sizeError;
  }
  if (image.data.length !== image.width * image.height * 4) {
    return invalidInput(`${label} data length must be width * height * 4.`);
  }
  return undefined;
}

/** Rectangles need integer coordinates and non-negative integer sizes. */
export function validateRect(rect: Rect, label: string): InvalidInput | undefined {
  const values = [rect.x, rect.y, rect.width, rect.height];
  if (!values.every(Number.isInteger) || rect.width < 0 || rect.height < 0) {
    return invalidInput(`${label} must use integer coordinates and a non-negative integer size.`);
  }
  return undefined;
}

/** Intersects a rectangle with the image bounds. The result may be empty. */
export function clipRect(rect: Rect, size: Size): Rect {
  const left = Math.min(Math.max(rect.x, 0), size.width);
  const top = Math.min(Math.max(rect.y, 0), size.height);
  const right = Math.min(Math.max(rect.x + rect.width, left), size.width);
  const bottom = Math.min(Math.max(rect.y + rect.height, top), size.height);
  return { x: left, y: top, width: right - left, height: bottom - top };
}

export function fullRect(size: Size): Rect {
  return { x: 0, y: 0, width: size.width, height: size.height };
}

/** Marks every pixel covered by any rectangle (overlaps count once). */
export function rasterizeRects(rects: readonly Rect[], size: Size): Uint8Array {
  const bitmap = new Uint8Array(size.width * size.height);
  for (const rect of rects) {
    const clipped = clipRect(rect, size);
    for (let y = clipped.y; y < clipped.y + clipped.height; y += 1) {
      const rowStart = y * size.width + clipped.x;
      bitmap.fill(1, rowStart, rowStart + clipped.width);
    }
  }
  return bitmap;
}
