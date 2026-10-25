/*
 * Framework-neutral facts about one test run, produced by the test runner
 * adapter and mapped to case results by `mapRunnerReport`.
 */

/** Version of the value scenario tests store under `task.meta.retina`. */
export const RETINA_META_VERSION = 1;

/** Key under which scenario tests store Retina data in Vitest task meta. */
export const RETINA_META_KEY = 'retina';

/** Why a failed test failed: an assertion, any other thrown error, or a test/hook timeout. */
export type TestFailureKind = 'assertion' | 'error' | 'timeout';

export type TestState = 'passed' | 'failed' | 'skipped' | 'pending';

export interface TestOutcome {
  /** Test file, relative to the run root. */
  readonly file: string;
  /** Full test name including suites. */
  readonly name: string;
  readonly state: TestState;
  /** Set when `state` is `failed`. */
  readonly failure?: TestFailureKind;
  /** The raw `task.meta.retina` value, untrusted. */
  readonly retina: unknown;
}

/**
 * A problem of a test file outside any single test: an import or collection
 * error, or a failing `beforeAll`/`afterAll` hook.
 */
export interface ModuleProblem {
  readonly file: string;
  readonly kind: 'collection' | 'hook';
  readonly timeout: boolean;
}

export interface RunnerReport {
  /** Test files the runner collected. */
  readonly testFiles: number;
  readonly tests: readonly TestOutcome[];
  readonly moduleProblems: readonly ModuleProblem[];
  readonly unhandledErrors: number;
  readonly interrupted: boolean;
  /** Error name when the runner could not start; never a message. */
  readonly startError?: string;
}
