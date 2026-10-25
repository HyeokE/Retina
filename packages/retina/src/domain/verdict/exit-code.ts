import type { RunOutcome } from './aggregate.ts';

/**
 * Process exit codes. Only `pass` is success; `unresolved` (3) is not a
 * success in any job and there is no setting that turns it into one.
 */
export const EXIT_CODES = {
  /** Every required result is PASS (accepted dev cases count as PASS). */
  pass: 0,
  /** At least one FAIL. */
  fail: 1,
  /** Execution error: configuration, zero tests, zero results, provider failure. */
  executionError: 2,
  /** Only REVIEW_REQUIRED or INCONCLUSIVE remain. */
  unresolved: 3,
} as const;

export type ExitCode = (typeof EXIT_CODES)[keyof typeof EXIT_CODES];

/**
 * Precedence (highest first): an execution error -> 2, a FAIL -> 1, a REVIEW_REQUIRED or
 * INCONCLUSIVE -> 3, otherwise 0. The run status is not changed by this; an
 * aggregate with a FAIL and an execution error has status FAIL and exit code 2.
 */
export function exitCodeFor(outcome: RunOutcome): ExitCode {
  if (outcome.kind === 'execution_error' || outcome.executionErrors.length > 0) {
    return EXIT_CODES.executionError;
  }
  switch (outcome.status) {
    case 'PASS':
      return EXIT_CODES.pass;
    case 'FAIL':
      return EXIT_CODES.fail;
    case 'REVIEW_REQUIRED':
    case 'INCONCLUSIVE':
      return EXIT_CODES.unresolved;
  }
}
