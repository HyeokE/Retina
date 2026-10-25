import { executionError, type ExecutionError } from './execution-error.ts';
import { resolveCase, type ResolvedCase } from './resolve-case.ts';
import { worstStatus, zeroStatusCounts } from './status.ts';
import {
  KNOWN_PLATFORMS,
  VERDICT_REASONS,
  type CaseResult,
  type Platform,
  type RequiredCase,
  type RunMode,
  type Status,
} from './types.ts';

export interface AggregateInput {
  readonly mode: RunMode;
  /** Platforms this run was asked to cover (e.g. after a `--platform` filter). */
  readonly declaredPlatforms: readonly Platform[];
  /**
   * Every platform the project supports. Decides whether the run is `full` or
   * `partial`. Defaults to every known platform, so an incomplete call is
   * never labelled full support.
   */
  readonly projectPlatforms?: readonly Platform[];
  /**
   * Every case the project requires, each on its platform. Only the entries on
   * declared platforms are expected in this run; the rest are reported in
   * `excludedRequiredCases`.
   */
  readonly requiredCases: readonly RequiredCase[];
  readonly results: readonly CaseResult[];
  /** Errors reported by the run layer (provider error, setup failure, …). */
  readonly executionErrors?: readonly ExecutionError[];
}

export interface MissingCase {
  readonly caseId: string;
  readonly platform: Platform;
  readonly status: 'INCONCLUSIVE';
  readonly reasons: readonly string[];
}

export interface PlatformCoverage {
  readonly platform: Platform;
  readonly status: Status;
  readonly caseCount: number;
  readonly reasons: readonly string[];
}

export interface RunScope {
  /** `full` only when every project platform was declared and produced results. */
  readonly kind: 'full' | 'partial';
  readonly declaredPlatforms: readonly Platform[];
  readonly executedPlatforms: readonly Platform[];
  /** Declared but without any result. */
  readonly missingPlatforms: readonly Platform[];
  /** Supported by the project but not declared for this run. */
  readonly excludedPlatforms: readonly Platform[];
}

export interface RunAggregate {
  readonly kind: 'aggregate';
  readonly mode: RunMode;
  readonly status: Status;
  /** Per-status counts over declared-platform cases plus missing required cases. */
  readonly counts: Readonly<Record<Status, number>>;
  readonly cases: readonly ResolvedCase[];
  readonly missingCases: readonly MissingCase[];
  /** Required cases on platforms this run did not declare: reported, never missing, never counted. */
  readonly excludedRequiredCases: readonly RequiredCase[];
  readonly platforms: readonly PlatformCoverage[];
  /** Results for platforms outside `declaredPlatforms`: reported, never counted. */
  readonly undeclaredResults: readonly ResolvedCase[];
  readonly acceptedCaseIds: readonly string[];
  /** Reported and detected execution errors. Any entry makes the exit code 2. */
  readonly executionErrors: readonly ExecutionError[];
  readonly scope: RunScope;
  /** False in dev mode, when any check acceptance was used, or when any execution error exists. */
  readonly gateEligible: boolean;
}

export type RunOutcome = RunAggregate | ExecutionError;

function findDuplicate(ids: readonly string[]): string | undefined {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) {
      return id;
    }
    seen.add(id);
  }
  return undefined;
}

/** Problems in the input itself; they are reported as execution errors, not statuses. */
function detectInputErrors(input: AggregateInput, expected: readonly RequiredCase[]): readonly ExecutionError[] {
  const duplicate = findDuplicate(input.results.map((result) => result.caseId));
  return [
    ...(input.declaredPlatforms.length === 0
      ? [executionError('no_declared_platforms', 'The run declares no platform.')]
      : []),
    ...(expected.length === 0
      ? [executionError('no_required_cases', 'The run has no required cases on its declared platforms.')]
      : []),
    ...(input.results.length === 0 ? [executionError('no_results', 'The run produced zero results.')] : []),
    ...(duplicate !== undefined
      ? [executionError('duplicate_case_id', `More than one result has case id "${duplicate}".`, { caseId: duplicate })]
      : []),
  ];
}

function coverPlatform(
  platform: Platform,
  cases: readonly ResolvedCase[],
  errors: readonly ExecutionError[],
): PlatformCoverage {
  const own = cases.filter((c) => c.platform === platform);
  const failedToRun = errors.some((error) => error.platform === platform);
  const reasons = [
    ...(own.length === 0 ? [VERDICT_REASONS.platformMissing] : []),
    ...(failedToRun ? [VERDICT_REASONS.executionError] : []),
  ];
  const statuses = [...own.map((c) => c.status), ...(reasons.length > 0 ? (['INCONCLUSIVE'] as const) : [])];
  return { platform, status: worstStatus(statuses), caseCount: own.length, reasons };
}

function buildScope(declared: readonly Platform[], project: readonly Platform[], cases: readonly ResolvedCase[]): RunScope {
  const executedPlatforms = declared.filter((p) => cases.some((c) => c.platform === p));
  const missingPlatforms = declared.filter((p) => !executedPlatforms.includes(p));
  const excludedPlatforms = project.filter((p) => !declared.includes(p));
  const full = missingPlatforms.length === 0 && excludedPlatforms.length === 0;
  return { kind: full ? 'full' : 'partial', declaredPlatforms: declared, executedPlatforms, missingPlatforms, excludedPlatforms };
}

function countStatuses(statuses: readonly Status[]): Readonly<Record<Status, number>> {
  return statuses.reduce((counts, status) => ({ ...counts, [status]: counts[status] + 1 }), zeroStatusCounts());
}

function unique<T>(values: readonly T[]): readonly T[] {
  return [...new Set(values)];
}

function requiredKey(entry: { readonly caseId: string; readonly platform: Platform }): string {
  return JSON.stringify([entry.platform, entry.caseId]);
}

function uniqueRequired(entries: readonly RequiredCase[]): readonly RequiredCase[] {
  const byKey = new Map(entries.map((entry) => [requiredKey(entry), entry] as const));
  return [...byKey.values()].map((entry) => ({ caseId: entry.caseId, platform: entry.platform }));
}

function findMissing(expected: readonly RequiredCase[], cases: readonly ResolvedCase[]): readonly MissingCase[] {
  const present = new Set(cases.map(requiredKey));
  return expected
    .filter((entry) => !present.has(requiredKey(entry)))
    .map((entry) => ({ ...entry, status: 'INCONCLUSIVE', reasons: [VERDICT_REASONS.missing] }));
}

/**
 * Aggregates case results into one run verdict.
 *
 * - Only required cases on declared platforms are expected. One without a
 *   result for the same case id on the same platform is INCONCLUSIVE (`missing`).
 * - Required cases on undeclared platforms go to `excludedRequiredCases`, so a
 *   web-only run can PASS while its scope stays `partial`.
 * - A declared platform without results is INCONCLUSIVE (`platform_missing`).
 * - Results on undeclared platforms are reported in `undeclaredResults` only.
 * - Non-required cases on declared platforms still count, so they can make the
 *   run worse but never satisfy a required case.
 * - Zero required cases on declared platforms, zero results, zero declared platforms or duplicate
 *   case ids are execution errors, kept in `executionErrors` together with the
 *   ones reported by the run layer. Each adds INCONCLUSIVE to the status, so a
 *   FAIL stays FAIL while the exit code becomes 2.
 */
export function aggregateRun(input: AggregateInput): RunAggregate {
  const declared = unique(input.declaredPlatforms);
  const allRequired = uniqueRequired(input.requiredCases);
  const expected = allRequired.filter((entry) => declared.includes(entry.platform));
  const executionErrors = [...(input.executionErrors ?? []), ...detectInputErrors(input, expected)];
  const requiredKeys = new Set(expected.map(requiredKey));
  const resolved = input.results.map((result) => resolveCase(result, input.mode, requiredKeys.has(requiredKey(result))));
  const cases = resolved.filter((c) => declared.includes(c.platform));
  const missingCases = findMissing(expected, cases);
  const platforms = declared.map((platform) => coverPlatform(platform, cases, executionErrors));
  const caseStatuses = [...cases, ...missingCases].map((c) => c.status);
  const errorStatuses: readonly Status[] = executionErrors.length > 0 ? ['INCONCLUSIVE'] : [];
  const acceptanceUsed = cases.some((c) => c.acceptedChecks.length > 0);
  return {
    kind: 'aggregate',
    mode: input.mode,
    status: worstStatus([...caseStatuses, ...platforms.map((p) => p.status), ...errorStatuses]),
    counts: countStatuses(caseStatuses),
    cases,
    missingCases,
    excludedRequiredCases: allRequired.filter((entry) => !declared.includes(entry.platform)),
    platforms,
    undeclaredResults: resolved.filter((c) => !declared.includes(c.platform)),
    acceptedCaseIds: cases.filter((c) => c.accepted).map((c) => c.caseId),
    executionErrors,
    scope: buildScope(declared, unique(input.projectPlatforms ?? KNOWN_PLATFORMS), cases),
    gateEligible: input.mode === 'validate' && !acceptanceUsed && executionErrors.length === 0,
  };
}
