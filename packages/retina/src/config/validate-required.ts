import { CHECK_KINDS, KNOWN_PLATFORMS } from '../domain/verdict/types.ts';
import {
  indexPath,
  isRecord,
  issue,
  keyPath,
  requiredStringIssues,
  unknownKeyIssues,
  type UnknownRecord,
} from './issues.ts';
import type { ConfigIssue } from './types.ts';

const REQUIRED_KEYS: ReadonlySet<string> = new Set(['caseId', 'platform', 'expectedChecks', 'profile']);
const PLATFORMS: ReadonlySet<unknown> = new Set(KNOWN_PLATFORMS);
const KINDS: ReadonlySet<unknown> = new Set(CHECK_KINDS);

/** Platform of each declared profile id, read from the raw `profiles` value. */
export function profilePlatforms(profiles: unknown): ReadonlyMap<string, unknown> {
  if (!isRecord(profiles)) {
    return new Map();
  }
  return new Map(Object.entries(profiles).map(([id, profile]) => [id, isRecord(profile) ? profile['platform'] : undefined]));
}

function platformIssues(entry: UnknownRecord, base: string): ConfigIssue[] {
  const path = keyPath(base, 'platform');
  const platform = entry['platform'];
  if (platform === undefined) {
    return [issue(path, 'missing', 'platform is required')];
  }
  return PLATFORMS.has(platform) ? [] : [issue(path, 'unknown_platform', `platform must be one of ${KNOWN_PLATFORMS.join(', ')}`)];
}

function expectedChecksIssues(value: unknown, base: string): ConfigIssue[] {
  const path = keyPath(base, 'expectedChecks');
  if (value === undefined) {
    return [issue(path, 'missing', 'expectedChecks is required')];
  }
  if (!Array.isArray(value) || value.length === 0) {
    return [issue(path, 'invalid_value', 'expectedChecks must be a non-empty list of check kinds')];
  }
  const kinds: readonly unknown[] = value;
  return kinds.flatMap((kind, index) => {
    if (!KINDS.has(kind)) {
      return [issue(indexPath(path, index), 'invalid_value', `a check kind must be one of ${CHECK_KINDS.join(', ')}`)];
    }
    return kinds.indexOf(kind) < index ? [issue(indexPath(path, index), 'invalid_value', 'a check kind is listed twice')] : [];
  });
}

function profileIssues(entry: UnknownRecord, base: string, platforms: ReadonlyMap<string, unknown>): ConfigIssue[] {
  const profile = entry['profile'];
  const path = keyPath(base, 'profile');
  if (profile === undefined) {
    return [];
  }
  if (typeof profile !== 'string' || !platforms.has(profile)) {
    return [issue(path, 'unknown_profile_ref', 'profile must be a declared profile id')];
  }
  const platform = entry['platform'];
  return PLATFORMS.has(platform) && platforms.get(profile) !== platform
    ? [issue(path, 'profile_platform_mismatch', 'the profile runs on another platform than the case')]
    : [];
}

function entryIssues(value: unknown, base: string, platforms: ReadonlyMap<string, unknown>): ConfigIssue[] {
  if (!isRecord(value)) {
    return [issue(base, 'invalid_type', 'a required case must be an object')];
  }
  return [
    ...unknownKeyIssues(value, REQUIRED_KEYS, base),
    ...requiredStringIssues(value, 'caseId', base),
    ...platformIssues(value, base),
    ...expectedChecksIssues(value['expectedChecks'], base),
    ...profileIssues(value, base, platforms),
  ];
}

function entryKey(value: unknown): string | undefined {
  return isRecord(value) && typeof value['caseId'] === 'string' ? JSON.stringify([value['platform'], value['caseId']]) : undefined;
}

/** The same case id on the same platform declared twice is a mistake, not a merge. */
function duplicateIssues(entries: readonly unknown[]): ConfigIssue[] {
  const keys = entries.map(entryKey);
  return keys.flatMap((key, index) =>
    key !== undefined && keys.indexOf(key) < index
      ? [issue(indexPath('required', index), 'duplicate_required_case', 'this case id is already required on this platform')]
      : [],
  );
}

/** Validates the optional `required` list against the declared profiles. */
export function validateRequired(value: unknown, profiles: unknown): ConfigIssue[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    return [issue('required', 'invalid_type', 'required must be a list of required cases')];
  }
  const entries: readonly unknown[] = value;
  const platforms = profilePlatforms(profiles);
  return [...entries.flatMap((entry, index) => entryIssues(entry, indexPath('required', index), platforms)), ...duplicateIssues(entries)];
}
