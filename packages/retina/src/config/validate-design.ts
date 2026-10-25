import { parseFigmaFrameUrl } from './figma-url.ts';
import {
  indexPath,
  isRecord,
  issue,
  keyPath,
  repeatedIndices,
  requiredStringIssues,
  unknownKeyIssues,
} from './issues.ts';
import type { ConfigIssue } from './types.ts';

const DESIGN_KEYS: ReadonlySet<string> = new Set(['frames', 'fixturesDir']);
const FRAME_KEYS: ReadonlySet<string> = new Set(['id', 'url', 'checkpoint', 'envs']);

function urlIssues(value: unknown, base: string): ConfigIssue[] {
  const path = keyPath(base, 'url');
  if (value === undefined) {
    return [issue(path, 'missing', 'url is required')];
  }
  if (typeof value !== 'string') {
    return [issue(path, 'invalid_figma_url', 'url must be a Figma frame URL string')];
  }
  const parsed = parseFigmaFrameUrl(value);
  return parsed.ok
    ? []
    : [issue(path, 'invalid_figma_url', `url is not a Figma frame URL with a file key and node-id (${parsed.code})`)];
}

/** `envs` lists the profile ids a frame is compared on; each must be declared. */
function envsIssues(value: unknown, base: string, profileIds: ReadonlySet<string>): ConfigIssue[] {
  const path = keyPath(base, 'envs');
  if (!Array.isArray(value) || value.length === 0) {
    return [issue(path, 'invalid_value', 'envs must be a non-empty list of profile ids')];
  }
  return value.flatMap((env: unknown, index) => {
    if (typeof env !== 'string') {
      return [issue(indexPath(path, index), 'invalid_value', 'a profile id must be a string')];
    }
    return profileIds.has(env)
      ? []
      : [issue(indexPath(path, index), 'unknown_profile_ref', 'envs references a profile id that is not declared')];
  });
}

function frameIssues(frame: unknown, base: string, profileIds: ReadonlySet<string>): ConfigIssue[] {
  if (!isRecord(frame)) {
    return [issue(base, 'invalid_type', 'a frame must be an object')];
  }
  return [
    ...unknownKeyIssues(frame, FRAME_KEYS, base),
    ...requiredStringIssues(frame, 'id', base),
    ...urlIssues(frame['url'], base),
    ...requiredStringIssues(frame, 'checkpoint', base),
    ...envsIssues(frame['envs'], base, profileIds),
  ];
}

function duplicateIdIssues(frames: readonly unknown[], base: string): ConfigIssue[] {
  const ids = frames.map((frame) => (isRecord(frame) && typeof frame['id'] === 'string' ? frame['id'] : undefined));
  return repeatedIndices(ids)
    .filter((index) => ids[index] !== undefined)
    .map((index) => issue(keyPath(indexPath(base, index), 'id'), 'duplicate_frame_id', 'frame id is already used by an earlier frame'));
}

function framesIssues(value: unknown, profileIds: ReadonlySet<string>): ConfigIssue[] {
  const path = 'design.frames';
  if (value === undefined) {
    return [issue(path, 'missing', 'frames is required')];
  }
  if (!Array.isArray(value)) {
    return [issue(path, 'invalid_type', 'frames must be a list')];
  }
  return [
    ...value.flatMap((frame: unknown, index) => frameIssues(frame, indexPath(path, index), profileIds)),
    ...duplicateIdIssues(value, path),
  ];
}

/** The optional `design` section (plan 13.2). */
export function validateDesign(value: unknown, profileIds: ReadonlySet<string>): ConfigIssue[] {
  if (value === undefined) {
    return [];
  }
  if (!isRecord(value)) {
    return [issue('design', 'invalid_type', 'design must be an object')];
  }
  return [
    ...unknownKeyIssues(value, DESIGN_KEYS, 'design'),
    ...framesIssues(value['frames'], profileIds),
    ...requiredStringIssues(value, 'fixturesDir', 'design'),
  ];
}
