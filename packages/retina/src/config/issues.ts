import type { ConfigIssue, ConfigIssueCode } from './types.ts';

/*
 * Small helpers shared by the config validators. Messages name keys, never
 * values, so a value read from the environment cannot leak through an issue.
 */

export type UnknownRecord = Readonly<Record<string, unknown>>;

export function isRecord(value: unknown): value is UnknownRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

export function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0;
}

export function issue(path: string, code: ConfigIssueCode, message: string): ConfigIssue {
  return { path, code, message };
}

export function keyPath(base: string, key: string): string {
  return base === '' ? key : `${base}.${key}`;
}

export function indexPath(base: string, index: number): string {
  return `${base}[${index}]`;
}

/** Own keys of `record` outside `allowed`. */
export function unknownKeyIssues(record: UnknownRecord, allowed: ReadonlySet<string>, base: string): ConfigIssue[] {
  return Object.keys(record)
    .filter((key) => !allowed.has(key))
    .map((key) => issue(keyPath(base, key), 'unknown_key', `unknown key "${key}"`));
}

/** A required, non-blank string field. */
export function requiredStringIssues(record: UnknownRecord, key: string, base: string): ConfigIssue[] {
  const path = keyPath(base, key);
  const value = record[key];
  if (value === undefined) {
    return [issue(path, 'missing', `${key} is required`)];
  }
  return isNonEmptyString(value) ? [] : [issue(path, 'invalid_value', `${key} must be a non-empty string`)];
}

/** An optional field: absent (or `undefined`) is fine, otherwise `isValid` must hold. */
export function optionalIssues(
  record: UnknownRecord,
  key: string,
  base: string,
  isValid: (value: unknown) => boolean,
  expected: string,
): ConfigIssue[] {
  const value = record[key];
  if (value === undefined || isValid(value)) {
    return [];
  }
  return [issue(keyPath(base, key), 'invalid_value', `${key} must be ${expected}`)];
}

/** Indices of entries already seen earlier in the list. */
export function repeatedIndices(values: readonly unknown[]): number[] {
  return values.flatMap((value, index) => (values.indexOf(value) < index ? [index] : []));
}
