import { KNOWN_PLATFORMS } from '../domain/verdict/types.ts';
import {
  isNonEmptyString,
  isPositiveInteger,
  isRecord,
  issue,
  keyPath,
  optionalIssues,
  unknownKeyIssues,
  type UnknownRecord,
} from './issues.ts';
import type { ConfigIssue } from './types.ts';

const WEB_KEYS: ReadonlySet<string> = new Set([
  'platform',
  'viewport',
  'deviceScaleFactor',
  'isMobile',
  'locale',
  'timezone',
  'colorScheme',
  'fixtureScope',
]);
const NATIVE_KEYS: ReadonlySet<string> = new Set(['platform', 'device', 'fixtureScope']);
const VIEWPORT_KEYS: ReadonlySet<string> = new Set(['width', 'height']);
const IOS_DEVICE_KEYS: ReadonlySet<string> = new Set(['udid']);
const ANDROID_DEVICE_KEYS: ReadonlySet<string> = new Set(['serial', 'avdRamMb']);
const PLATFORMS: ReadonlySet<unknown> = new Set(KNOWN_PLATFORMS);
const COLOR_SCHEMES: ReadonlySet<unknown> = new Set(['light', 'dark']);

export interface ProfilesValidation {
  readonly issues: readonly ConfigIssue[];
  /** Every declared profile id, valid or not, so references can be checked. */
  readonly ids: ReadonlySet<string>;
}

function isPositiveFinite(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function viewportIssues(value: unknown, base: string): ConfigIssue[] {
  const path = keyPath(base, 'viewport');
  if (!isRecord(value)) {
    return [issue(path, 'invalid_viewport', 'web profiles need a viewport { width, height }')];
  }
  const dimensions = ['width', 'height'].flatMap((key) =>
    isPositiveInteger(value[key])
      ? []
      : [issue(keyPath(path, key), 'invalid_viewport', `viewport ${key} must be a positive integer`)],
  );
  return [...unknownKeyIssues(value, VIEWPORT_KEYS, path), ...dimensions];
}

function webProfileIssues(profile: UnknownRecord, base: string): ConfigIssue[] {
  return [
    ...unknownKeyIssues(profile, WEB_KEYS, base),
    ...viewportIssues(profile['viewport'], base),
    ...optionalIssues(profile, 'deviceScaleFactor', base, isPositiveFinite, 'a positive number'),
    ...optionalIssues(profile, 'isMobile', base, (value) => typeof value === 'boolean', 'a boolean'),
    ...optionalIssues(profile, 'locale', base, isNonEmptyString, 'a non-empty string'),
    ...optionalIssues(profile, 'timezone', base, isNonEmptyString, 'a non-empty string'),
    ...optionalIssues(profile, 'colorScheme', base, (value) => COLOR_SCHEMES.has(value), '"light" or "dark"'),
  ];
}

/** A native profile must pin its device; without it the profile does not run (plan 8.3). */
function deviceIssues(profile: UnknownRecord, base: string, idKey: 'udid' | 'serial'): ConfigIssue[] {
  const path = keyPath(base, 'device');
  const device = profile['device'];
  if (!isRecord(device)) {
    return [issue(path, 'device_not_pinned', `device.${idKey} is required; an unpinned device is never used`)];
  }
  const allowed = idKey === 'udid' ? IOS_DEVICE_KEYS : ANDROID_DEVICE_KEYS;
  const pinned = isNonEmptyString(device[idKey])
    ? []
    : [issue(keyPath(path, idKey), 'device_not_pinned', `device.${idKey} is required; an unpinned device is never used`)];
  const ram =
    idKey === 'serial'
      ? optionalIssues(device, 'avdRamMb', path, isPositiveInteger, 'a positive integer (MB)')
      : [];
  return [...unknownKeyIssues(device, allowed, path), ...pinned, ...ram];
}

function nativeProfileIssues(profile: UnknownRecord, base: string, idKey: 'udid' | 'serial'): ConfigIssue[] {
  return [...unknownKeyIssues(profile, NATIVE_KEYS, base), ...deviceIssues(profile, base, idKey)];
}

function profileIssues(value: unknown, base: string): ConfigIssue[] {
  if (!isRecord(value)) {
    return [issue(base, 'invalid_type', 'a profile must be an object')];
  }
  const platform = value['platform'];
  const platformPath = keyPath(base, 'platform');
  if (platform === undefined) {
    return [issue(platformPath, 'missing', 'platform is required')];
  }
  if (!PLATFORMS.has(platform)) {
    return [issue(platformPath, 'unknown_platform', `platform must be one of ${KNOWN_PLATFORMS.join(', ')}`)];
  }
  const scope = optionalIssues(value, 'fixtureScope', base, isNonEmptyString, 'a non-empty string');
  if (platform === 'web') {
    return [...webProfileIssues(value, base), ...scope];
  }
  return [...nativeProfileIssues(value, base, platform === 'ios' ? 'udid' : 'serial'), ...scope];
}

export function validateProfiles(value: unknown): ProfilesValidation {
  if (value === undefined) {
    return { issues: [issue('profiles', 'missing', 'profiles is required')], ids: new Set() };
  }
  if (!isRecord(value)) {
    return { issues: [issue('profiles', 'invalid_type', 'profiles must be an object keyed by profile id')], ids: new Set() };
  }
  const ids = Object.keys(value);
  if (ids.length === 0) {
    return { issues: [issue('profiles', 'no_profiles', 'declare at least one profile')], ids: new Set() };
  }
  return {
    issues: ids.flatMap((id) => profileIssues(value[id], keyPath('profiles', id))),
    ids: new Set(ids),
  };
}
