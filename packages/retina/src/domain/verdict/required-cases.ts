import { executionError, type ExecutionError } from './execution-error.ts';
import type { CaseResult, CheckKind, Platform, RequiredCase } from './types.ts';

/** Identity of a case in a run: the same case id on another platform is another case. */
export function requiredKey(entry: { readonly caseId: string; readonly platform: Platform }): string {
  return JSON.stringify([entry.platform, entry.caseId]);
}

function hasRepeats(values: readonly unknown[]): boolean {
  return new Set(values).size !== values.length;
}

/**
 * Required cases declared twice are merged; their expected kinds are united,
 * so a repeated declaration can only add checks, never drop them.
 */
export function mergeRequired(entries: readonly RequiredCase[]): readonly RequiredCase[] {
  const byKey = entries.reduce((merged, entry) => {
    const key = requiredKey(entry);
    const previous = merged.get(key)?.expectedChecks ?? [];
    const expectedChecks: readonly CheckKind[] = [...new Set([...previous, ...entry.expectedChecks])];
    return new Map(merged).set(key, { caseId: entry.caseId, platform: entry.platform, expectedChecks });
  }, new Map<string, RequiredCase>());
  return [...byKey.values()];
}

/** `expectedChecks` must be non-empty with unique kinds; checked on the declarations as given. */
export function expectedChecksErrors(entries: readonly RequiredCase[]): readonly ExecutionError[] {
  return entries
    .filter((entry) => entry.expectedChecks.length === 0 || hasRepeats(entry.expectedChecks))
    .map((entry) =>
      executionError(
        'invalid_expected_checks',
        `Required case "${entry.caseId}" must list each expected check kind once and at least one.`,
        { platform: entry.platform, caseId: entry.caseId },
      ),
    );
}

/** Check kinds must be unique within one case, so one check cannot stand in for another. */
export function duplicateCheckKindErrors(results: readonly CaseResult[]): readonly ExecutionError[] {
  return results
    .filter((result) => hasRepeats(result.checks.map((check) => check.kind)))
    .map((result) =>
      executionError('duplicate_check_kind', `Result "${result.caseId}" reports the same check kind more than once.`, {
        platform: result.platform,
        caseId: result.caseId,
      }),
    );
}
