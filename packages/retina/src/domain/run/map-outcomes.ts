import { executionError, type ExecutionError } from '../verdict/execution-error.ts';
import type { CaseResult, CheckResult } from '../verdict/types.ts';
import { parseCaseIdentity, parseCaseResult, type CaseIdentity } from './case-shape.ts';
import { RETINA_META_VERSION, type ModuleProblem, type RunnerReport, type TestOutcome } from './test-outcome.ts';

/** Reason codes the run layer puts on checks it derives from test failures. */
export const RUN_REASONS = {
  assertionFailed: 'assertion_failed',
  testError: 'test_error',
} as const;

export interface TestCounts {
  readonly total: number;
  readonly passed: number;
  readonly failed: number;
  readonly skipped: number;
}

export interface MappedRun {
  readonly results: readonly CaseResult[];
  readonly executionErrors: readonly ExecutionError[];
  readonly counts: TestCounts;
}

/** What a test stored under `task.meta.retina`, after validation. */
type RetinaMeta =
  | { readonly kind: 'none' }
  | { readonly kind: 'invalid'; readonly problems: readonly string[] }
  | { readonly kind: 'declared'; readonly identity: CaseIdentity }
  | { readonly kind: 'recorded'; readonly result: CaseResult };

interface Mapped {
  readonly results: readonly CaseResult[];
  readonly errors: readonly ExecutionError[];
}

const NOTHING: Mapped = { results: [], errors: [] };

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function readMeta(value: unknown): RetinaMeta {
  if (value === undefined) {
    return { kind: 'none' };
  }
  if (!isRecord(value) || value['version'] !== RETINA_META_VERSION) {
    return { kind: 'invalid', problems: [`retina meta must be an object with version ${RETINA_META_VERSION}`] };
  }
  if (value['result'] !== undefined) {
    const parsed = parseCaseResult(value['result']);
    return parsed.ok ? { kind: 'recorded', result: parsed.value } : { kind: 'invalid', problems: parsed.problems };
  }
  const parsed = parseCaseIdentity(value['declared']);
  return parsed.ok ? { kind: 'declared', identity: parsed.value } : { kind: 'invalid', problems: parsed.problems };
}

function where(test: TestOutcome): string {
  return `"${test.name}" in ${test.file}`;
}

function identityOf(meta: RetinaMeta): CaseIdentity | undefined {
  if (meta.kind === 'recorded') {
    return { caseId: meta.result.caseId, platform: meta.result.platform, profile: meta.result.profile };
  }
  return meta.kind === 'declared' ? meta.identity : undefined;
}

function functionalFailure(test: TestOutcome): CheckResult {
  const reason = test.failure === 'assertion' ? RUN_REASONS.assertionFailed : RUN_REASONS.testError;
  return { kind: 'functional', status: 'FAIL', reasons: [reason] };
}

/** A failed test makes its case's functional check FAIL; other recorded checks stay. */
function failedCase(test: TestOutcome, meta: RetinaMeta, identity: CaseIdentity): CaseResult {
  const recorded = meta.kind === 'recorded' ? meta.result.checks.filter((check) => check.kind !== 'functional') : [];
  return { ...identity, checks: [...recorded, functionalFailure(test)] };
}

function mapFailed(test: TestOutcome, meta: RetinaMeta): Mapped {
  const identity = identityOf(meta);
  const location = identity !== undefined ? { platform: identity.platform, caseId: identity.caseId } : {};
  if (test.failure === 'timeout') {
    return { results: [], errors: [executionError('test_timeout', `Test ${where(test)} timed out.`, location)] };
  }
  if (identity === undefined) {
    const message = `Test ${where(test)} failed without declaring a Retina case.`;
    return { results: [], errors: [executionError('unattributed_failure', message)] };
  }
  return { results: [failedCase(test, meta, identity)], errors: [] };
}

function mapPassed(meta: RetinaMeta): Mapped {
  if (meta.kind === 'recorded') {
    return { results: [meta.result], errors: [] };
  }
  // A declared case that recorded nothing has zero checks, which is INCONCLUSIVE.
  return meta.kind === 'declared' ? { results: [{ ...meta.identity, checks: [] }], errors: [] } : NOTHING;
}

function mapTest(test: TestOutcome): Mapped {
  const meta = readMeta(test.retina);
  if (meta.kind === 'invalid') {
    const message = `Test ${where(test)} recorded an invalid Retina case: ${meta.problems.join('; ')}.`;
    return { results: [], errors: [executionError('invalid_case_result', message)] };
  }
  switch (test.state) {
    case 'passed':
      return mapPassed(meta);
    case 'failed':
      return mapFailed(test, meta);
    case 'skipped':
    case 'pending':
      // Skipped and todo tests record nothing; a required case they stood for is reported missing.
      return NOTHING;
  }
}

function moduleError(problem: ModuleProblem): ExecutionError {
  if (problem.kind === 'collection') {
    return executionError('collection_error', `Test file ${problem.file} could not be collected.`);
  }
  return problem.timeout
    ? executionError('test_timeout', `A suite hook in ${problem.file} timed out.`)
    : executionError('setup_failure', `A suite hook in ${problem.file} failed.`);
}

function runErrors(report: RunnerReport): readonly ExecutionError[] {
  return [
    ...(report.startError !== undefined ? [executionError('runner_error', `The test runner failed to start (${report.startError}).`)] : []),
    ...(report.startError === undefined && report.testFiles === 0
      ? [executionError('no_test_files', 'No test file matched the configured scenarios.')]
      : []),
    ...report.moduleProblems.map(moduleError),
    ...(report.unhandledErrors > 0
      ? [executionError('unhandled_error', `The test run had ${report.unhandledErrors} unhandled error(s).`)]
      : []),
    ...(report.interrupted ? [executionError('run_interrupted', 'The test run was interrupted.')] : []),
  ];
}

function countTests(tests: readonly TestOutcome[]): TestCounts {
  const count = (state: TestOutcome['state']): number => tests.filter((test) => test.state === state).length;
  return { total: tests.length, passed: count('passed'), failed: count('failed'), skipped: count('skipped') + count('pending') };
}

/**
 * Maps a test run to case results and execution errors.
 *
 * - A passed test contributes the case it recorded, or a zero-check case if
 *   it only declared one; a test without Retina data is not a case.
 * - A failed test contributes its case with a FAIL `functional` check
 *   (`assertion_failed` or `test_error`); without a declared case it is an
 *   `unattributed_failure` execution error.
 * - A timeout (test or hook) is a `test_timeout` execution error.
 * - Zero test files, collection errors, failing suite hooks, unhandled
 *   errors and interruptions are execution errors.
 */
export function mapRunnerReport(report: RunnerReport): MappedRun {
  const mapped = report.tests.map(mapTest);
  return {
    results: mapped.flatMap((entry) => entry.results),
    executionErrors: [...runErrors(report), ...mapped.flatMap((entry) => entry.errors)],
    counts: countTests(report.tests),
  };
}
