import type {
  Acceptance,
  CaseResult,
  CheckKind,
  RequiredCase,
  CheckResult,
  ImageHashes,
  Platform,
  RgbaImage,
  Status,
} from '../../src/index.ts';

export function check(
  kind: CheckKind,
  status: Status,
  extra: {
    readonly reasons?: readonly string[];
    readonly imageHashes?: ImageHashes;
    readonly acceptance?: Acceptance;
  } = {},
): CheckResult {
  return {
    kind,
    status,
    reasons: extra.reasons ?? [],
    ...(extra.imageHashes ? { imageHashes: extra.imageHashes } : {}),
    ...(extra.acceptance ? { acceptance: extra.acceptance } : {}),
  };
}

/** A REVIEW_REQUIRED check with a recorded diff hash, optionally accepted with `acceptedHash`. */
export function reviewCheck(kind: CheckKind, diffHash: string | undefined, acceptedHash?: string): CheckResult {
  return check(kind, 'REVIEW_REQUIRED', {
    ...(diffHash !== undefined ? { imageHashes: { diff: diffHash } } : {}),
    ...(acceptedHash !== undefined ? { acceptance: { by: 'user', diffHash: acceptedHash } } : {}),
  });
}

export function caseResult(
  caseId: string,
  platform: Platform,
  checks: readonly CheckResult[],
  profile: string = `${platform}-default`,
): CaseResult {
  return { caseId, platform, profile, checks };
}

/**
 * The required case a result stands for. Expected checks default to the
 * result's own check kinds, or `functional` for a result without checks.
 */
export function requiredFor(result: CaseResult, expectedChecks?: readonly CheckKind[]): RequiredCase {
  const own = [...new Set(result.checks.map((c) => c.kind))];
  return {
    caseId: result.caseId,
    platform: result.platform,
    expectedChecks: expectedChecks ?? (own.length > 0 ? own : ['functional']),
  };
}

export function passCase(caseId: string, platform: Platform): CaseResult {
  return caseResult(caseId, platform, [check('functional', 'PASS')]);
}

export function deepFreeze<T>(value: T): T {
  if (value === null || typeof value !== 'object' || ArrayBuffer.isView(value)) {
    return value;
  }
  for (const key of Reflect.ownKeys(value)) {
    deepFreeze((value as Record<PropertyKey, unknown>)[key]);
  }
  return Object.freeze(value);
}

type Rgba = readonly [number, number, number, number];

export function solidImage(width: number, height: number, color: Rgba): RgbaImage {
  const data = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    data.set(color, i * 4);
  }
  return { width, height, data };
}

export function withPixel(image: RgbaImage, x: number, y: number, color: Rgba): RgbaImage {
  const data = new Uint8Array(image.data);
  data.set(color, (y * image.width + x) * 4);
  return { width: image.width, height: image.height, data };
}

export function maskFromPoints(width: number, height: number, points: readonly (readonly [number, number])[]): Uint8Array {
  const mask = new Uint8Array(width * height);
  for (const [x, y] of points) {
    mask[y * width + x] = 1;
  }
  return mask;
}

export function maskFromRects(
  width: number,
  height: number,
  rects: readonly { readonly x: number; readonly y: number; readonly width: number; readonly height: number }[],
): Uint8Array {
  const mask = new Uint8Array(width * height);
  for (const rect of rects) {
    for (let y = rect.y; y < rect.y + rect.height; y += 1) {
      mask.fill(1, y * width + rect.x, y * width + rect.x + rect.width);
    }
  }
  return mask;
}

export const WHITE: Rgba = [255, 255, 255, 255];
export const BLACK: Rgba = [0, 0, 0, 255];
export const TRANSPARENT_BLACK: Rgba = [0, 0, 0, 0];
