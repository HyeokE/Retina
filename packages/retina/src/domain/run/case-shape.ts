import {
  CHECK_KINDS,
  KNOWN_PLATFORMS,
  STATUSES,
  type Acceptance,
  type CaseResult,
  type CheckResult,
  type ImageHashes,
  type Platform,
} from '../verdict/types.ts';

/*
 * Shape checks for case results that cross a process boundary (a scenario
 * test records them in Vitest task meta, the CLI reads them back). Problems
 * name fields, never values.
 */

export type Parsed<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly problems: readonly string[] };

/** The identity of a case: enough to attribute a failure before any check is recorded. */
export interface CaseIdentity {
  readonly caseId: string;
  readonly platform: Platform;
  readonly profile: string;
}

type UnknownRecord = Readonly<Record<string, unknown>>;

const IDENTITY_KEYS: ReadonlySet<string> = new Set(['caseId', 'platform', 'profile']);
const RESULT_KEYS: ReadonlySet<string> = new Set([...IDENTITY_KEYS, 'checks']);
const CHECK_KEYS: ReadonlySet<string> = new Set(['kind', 'status', 'reasons', 'imageHashes', 'acceptance']);
const HASH_KEYS: readonly (keyof ImageHashes)[] = ['expected', 'actual', 'diff'];
const PLATFORMS: ReadonlySet<unknown> = new Set(KNOWN_PLATFORMS);
const KINDS: ReadonlySet<unknown> = new Set(CHECK_KINDS);
const STATUS_SET: ReadonlySet<unknown> = new Set(STATUSES);

function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringList(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((entry: unknown) => typeof entry === 'string');
}

function unknownKeys(record: UnknownRecord, allowed: ReadonlySet<string>, prefix: string): readonly string[] {
  return Object.keys(record)
    .filter((key) => !allowed.has(key))
    .map((key) => `unknown key "${prefix}${key}"`);
}

function identityProblems(record: UnknownRecord): readonly string[] {
  return [
    ...(isNonEmptyString(record['caseId']) ? [] : ['caseId must be a non-empty string']),
    ...(PLATFORMS.has(record['platform']) ? [] : [`platform must be one of ${KNOWN_PLATFORMS.join(', ')}`]),
    ...(isNonEmptyString(record['profile']) ? [] : ['profile must be a non-empty string']),
  ];
}

function hashProblems(value: unknown, base: string): readonly string[] {
  if (value === undefined) {
    return [];
  }
  if (!isRecord(value)) {
    return [`${base}.imageHashes must be an object`];
  }
  const allowed: ReadonlySet<string> = new Set(HASH_KEYS);
  return [
    ...unknownKeys(value, allowed, `${base}.imageHashes.`),
    ...HASH_KEYS.flatMap((key) =>
      value[key] === undefined || typeof value[key] === 'string' ? [] : [`${base}.imageHashes.${key} must be a string`],
    ),
  ];
}

function isAcceptance(value: unknown): value is Acceptance {
  return isRecord(value) && value['by'] === 'user' && isNonEmptyString(value['diffHash']) && Object.keys(value).length === 2;
}

function checkProblems(value: unknown, index: number): readonly string[] {
  const base = `checks[${index}]`;
  if (!isRecord(value)) {
    return [`${base} must be an object`];
  }
  return [
    ...unknownKeys(value, CHECK_KEYS, `${base}.`),
    ...(KINDS.has(value['kind']) ? [] : [`${base}.kind is not a check kind`]),
    ...(STATUS_SET.has(value['status']) ? [] : [`${base}.status is not a status`]),
    ...(isStringList(value['reasons']) ? [] : [`${base}.reasons must be a list of strings`]),
    ...hashProblems(value['imageHashes'], base),
    ...(value['acceptance'] === undefined || isAcceptance(value['acceptance'])
      ? []
      : [`${base}.acceptance must be { by: "user", diffHash }`]),
  ];
}

function copyCheck(check: UnknownRecord): CheckResult {
  const imageHashes = check['imageHashes'] as ImageHashes | undefined;
  const acceptance = check['acceptance'] as Acceptance | undefined;
  return {
    kind: check['kind'] as CheckResult['kind'],
    status: check['status'] as CheckResult['status'],
    reasons: [...(check['reasons'] as readonly string[])],
    ...(imageHashes !== undefined ? { imageHashes: { ...imageHashes } } : {}),
    ...(acceptance !== undefined ? { acceptance: { by: acceptance.by, diffHash: acceptance.diffHash } } : {}),
  };
}

function copyIdentity(record: UnknownRecord): CaseIdentity {
  return {
    caseId: record['caseId'] as string,
    platform: record['platform'] as Platform,
    profile: record['profile'] as string,
  };
}

/** Parses an untrusted case identity `{ caseId, platform, profile }`. */
export function parseCaseIdentity(value: unknown): Parsed<CaseIdentity> {
  if (!isRecord(value)) {
    return { ok: false, problems: ['case identity must be an object'] };
  }
  const problems = [...unknownKeys(value, IDENTITY_KEYS, ''), ...identityProblems(value)];
  return problems.length > 0 ? { ok: false, problems } : { ok: true, value: copyIdentity(value) };
}

/** Parses an untrusted `CaseResult` and returns a fresh copy of it. */
export function parseCaseResult(value: unknown): Parsed<CaseResult> {
  if (!isRecord(value)) {
    return { ok: false, problems: ['case result must be an object'] };
  }
  const checks = value['checks'];
  const problems = [
    ...unknownKeys(value, RESULT_KEYS, ''),
    ...identityProblems(value),
    ...(Array.isArray(checks) ? checks.flatMap((check: unknown, index) => checkProblems(check, index)) : ['checks must be a list']),
  ];
  if (problems.length > 0) {
    return { ok: false, problems };
  }
  const list = checks as readonly UnknownRecord[];
  return { ok: true, value: { ...copyIdentity(value), checks: list.map(copyCheck) } };
}
