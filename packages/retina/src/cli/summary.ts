import type { RunOutcome } from '../domain/run/run-retina.ts';

/** Lines for stdout (the verdict) and stderr (causes). Codes and names only, never env values. */
export interface Summary {
  readonly out: readonly string[];
  readonly err: readonly string[];
}

function countLines(outcome: RunOutcome): readonly string[] {
  const { aggregate, tests } = outcome.result;
  const cases =
    aggregate === undefined
      ? []
      : [
          `  cases: PASS ${aggregate.counts.PASS}, FAIL ${aggregate.counts.FAIL}, ` +
            `REVIEW_REQUIRED ${aggregate.counts.REVIEW_REQUIRED}, INCONCLUSIVE ${aggregate.counts.INCONCLUSIVE}, ` +
            `missing ${aggregate.missingCases.length}`,
        ];
  const testLine =
    tests === undefined ? [] : [`  tests: ${tests.total} total, ${tests.passed} passed, ${tests.failed} failed, ${tests.skipped} skipped`];
  return [...cases, ...testLine];
}

function causeLines(outcome: RunOutcome): readonly string[] {
  const { execution, config } = outcome.result;
  return [
    ...config.issues.map((issue) => `  config issue: ${issue.path} ${issue.code}`),
    ...config.missingEnv.map((name) => `  missing env: ${name}`),
    ...execution.errors.map((error) => `  execution error: ${error.code}${error.reason ? ` (${error.reason})` : ''}: ${error.message}`),
    ...(outcome.resultWrite.ok ? [] : [`  result.json could not be written: ${outcome.resultWrite.path} (${outcome.resultWrite.reason})`]),
  ];
}

export function formatSummary(outcome: RunOutcome): Summary {
  const { result } = outcome;
  return {
    out: [
      `retina run: ${result.status} (exit ${outcome.exitCode})`,
      `  mode ${result.mode}, scope ${result.scope}, gate eligible: ${result.gateEligible ? 'yes' : 'no'}`,
      ...countLines(outcome),
      `  execution errors: ${result.execution.errors.length}`,
      ...(outcome.resultWrite.ok ? [`  result: ${outcome.resultWrite.path}`] : []),
    ],
    err: causeLines(outcome),
  };
}
