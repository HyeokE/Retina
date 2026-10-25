import type { TestFailureKind } from '../../domain/run/test-outcome.ts';

/**
 * Vitest 5 has no structured timeout signal: `makeTimeoutError` creates a
 * plain `Error` whose message starts with "Test timed out in <n>ms" or
 * "Hook timed out in <n>ms", and the reporter API exposes no flag. This
 * pattern is the one place that depends on that text (checked against
 * Vitest 5.0.5, pinned by the lockfile). An automated contract test that runs
 * the installed Vitest is still to be added. If the text ever stops matching,
 * a timeout is classified as `error` (a FAIL, exit 1), never as a pass.
 */
export const VITEST_TIMEOUT_MESSAGE = /^(Test|Hook) timed out in \d+ms/;

export interface ErrorLike {
  readonly name?: unknown;
  readonly message?: unknown;
}

export function isTimeoutError(error: ErrorLike): boolean {
  return typeof error.message === 'string' && VITEST_TIMEOUT_MESSAGE.test(error.message);
}

/** Timeout wins over assertion: a timed-out test cannot be judged. */
export function classifyFailure(errors: readonly ErrorLike[]): TestFailureKind {
  if (errors.some(isTimeoutError)) {
    return 'timeout';
  }
  return errors.some((error) => error.name === 'AssertionError') ? 'assertion' : 'error';
}
