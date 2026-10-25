import type { Reporter, TestCase, TestModule, TestRunEndReason, TestSpecification } from 'vitest/node';
import { RETINA_META_KEY, type ModuleProblem, type RunnerReport, type TestOutcome } from '../../domain/run/test-outcome.ts';
import { classifyFailure, isTimeoutError, type ErrorLike } from './classify-error.ts';

/*
 * A Vitest reporter that turns test cases into framework-neutral
 * `TestOutcome`s. It uses only `onTestRunStart`, `onTestCaseResult` (with
 * `testCase.meta()`) and `onTestRunEnd`, the hooks the Vitest 5 compatibility
 * check confirmed.
 */

export interface Collector {
  readonly reporter: Reporter;
  report(startError?: string): RunnerReport;
}

function toOutcome(testCase: TestCase): TestOutcome {
  const result = testCase.result();
  // TaskMeta is not augmented (Vitest compatibility report); read it as an untrusted record.
  const meta = testCase.meta() as Readonly<Record<string, unknown>>;
  return {
    file: testCase.module.relativeModuleId,
    name: testCase.fullName,
    state: result.state,
    ...(result.state === 'failed' ? { failure: classifyFailure(result.errors) } : {}),
    retina: meta[RETINA_META_KEY],
  };
}

function problem(file: string, kind: ModuleProblem['kind'], errors: readonly ErrorLike[]): readonly ModuleProblem[] {
  return errors.length > 0 ? [{ file, kind, timeout: errors.some(isTimeoutError) }] : [];
}

/** Import/collection errors and `beforeAll`/`afterAll` failures of one test file. */
export function moduleProblems(testModule: TestModule): readonly ModuleProblem[] {
  const file = testModule.relativeModuleId;
  const ownErrors = testModule.errors();
  const hasTests = !testModule.children.allTests().next().done;
  const suiteErrors = [...testModule.children.allSuites()].flatMap((suite) => suite.errors());
  return [...problem(file, hasTests ? 'hook' : 'collection', ownErrors), ...problem(file, 'hook', suiteErrors)];
}

export function createCollector(): Collector {
  // Reporter callbacks arrive one by one, so the collector keeps local state.
  const tests: TestOutcome[] = [];
  const state = { testFiles: 0, problems: [] as readonly ModuleProblem[], unhandledErrors: 0, interrupted: false };
  const reporter: Reporter = {
    onTestRunStart(specifications: ReadonlyArray<TestSpecification>) {
      state.testFiles = new Set(specifications.map((spec) => spec.moduleId)).size;
    },
    onTestCaseResult(testCase: TestCase) {
      tests.push(toOutcome(testCase));
    },
    onTestRunEnd(testModules: ReadonlyArray<TestModule>, unhandledErrors: ReadonlyArray<unknown>, reason: TestRunEndReason) {
      state.problems = testModules.flatMap(moduleProblems);
      state.unhandledErrors = unhandledErrors.length;
      state.interrupted = reason === 'interrupted';
    },
  };
  return {
    reporter,
    report: (startError) => ({
      testFiles: state.testFiles,
      tests: [...tests],
      moduleProblems: state.problems,
      unhandledErrors: state.unhandledErrors,
      interrupted: state.interrupted,
      ...(startError !== undefined ? { startError } : {}),
    }),
  };
}
