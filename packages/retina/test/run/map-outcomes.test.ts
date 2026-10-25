import { describe, expect, it } from 'vitest';
import { mapRunnerReport } from '../../src/domain/run/map-outcomes.ts';
import { RETINA_META_VERSION, type RunnerReport, type TestOutcome } from '../../src/domain/run/test-outcome.ts';
import type { CaseResult } from '../../src/index.ts';

const recorded: CaseResult = {
  caseId: 'form/web/initial',
  platform: 'web',
  profile: 'web',
  checks: [
    { kind: 'functional', status: 'PASS', reasons: [] },
    { kind: 'regression', status: 'PASS', reasons: [] },
  ],
};

function outcome(changes: Partial<TestOutcome>): TestOutcome {
  return { file: 'retina/a.test.ts', name: 'a > b', state: 'passed', retina: undefined, ...changes };
}

function report(tests: readonly TestOutcome[], changes: Partial<RunnerReport> = {}): RunnerReport {
  return { testFiles: 1, tests, moduleProblems: [], unhandledErrors: 0, interrupted: false, ...changes };
}

const withResult = { version: RETINA_META_VERSION, result: recorded };
const withDeclared = {
  version: RETINA_META_VERSION,
  declared: { caseId: 'form/web/initial', platform: 'web', profile: 'web' },
};

describe('mapRunnerReport: passed tests', () => {
  it('takes the recorded case result of a passed test', () => {
    expect(mapRunnerReport(report([outcome({ retina: withResult })]))).toEqual({
      results: [recorded],
      executionErrors: [],
      counts: { total: 1, passed: 1, failed: 0, skipped: 0 },
    });
  });

  it('ignores a passed test that is not a Retina case', () => {
    expect(mapRunnerReport(report([outcome({})])).results).toEqual([]);
  });

  it('turns a declared case without a recorded result into a case with no checks', () => {
    expect(mapRunnerReport(report([outcome({ retina: withDeclared })])).results).toEqual([
      { caseId: 'form/web/initial', platform: 'web', profile: 'web', checks: [] },
    ]);
  });

  it('reports an invalid Retina meta value as invalid_case_result', () => {
    const mapped = mapRunnerReport(report([outcome({ retina: { version: RETINA_META_VERSION, result: { caseId: 1 } } })]));
    expect(mapped.results).toEqual([]);
    expect(mapped.executionErrors).toEqual([expect.objectContaining({ code: 'invalid_case_result' })]);
  });

  it('reports an unknown meta version as invalid_case_result', () => {
    const mapped = mapRunnerReport(report([outcome({ retina: { version: 99, result: recorded } })]));
    expect(mapped.executionErrors).toEqual([expect.objectContaining({ code: 'invalid_case_result' })]);
  });
});

describe('mapRunnerReport: failed tests', () => {
  it('maps an assertion failure of a declared case to a FAIL functional check', () => {
    const mapped = mapRunnerReport(report([outcome({ state: 'failed', failure: 'assertion', retina: withDeclared })]));
    expect(mapped.results).toEqual([
      {
        caseId: 'form/web/initial',
        platform: 'web',
        profile: 'web',
        checks: [{ kind: 'functional', status: 'FAIL', reasons: ['assertion_failed'] }],
      },
    ]);
    expect(mapped.executionErrors).toEqual([]);
  });

  it('replaces the recorded functional check and keeps the others when a recorded case fails afterwards', () => {
    const mapped = mapRunnerReport(report([outcome({ state: 'failed', failure: 'assertion', retina: withResult })]));
    expect(mapped.results[0]?.checks).toEqual([
      { kind: 'regression', status: 'PASS', reasons: [] },
      { kind: 'functional', status: 'FAIL', reasons: ['assertion_failed'] },
    ]);
  });

  it('maps a thrown non-assertion error to a FAIL with reason test_error', () => {
    const mapped = mapRunnerReport(report([outcome({ state: 'failed', failure: 'error', retina: withDeclared })]));
    expect(mapped.results[0]?.checks).toEqual([{ kind: 'functional', status: 'FAIL', reasons: ['test_error'] }]);
  });

  it('reports a failure without a declared case as unattributed_failure', () => {
    const mapped = mapRunnerReport(report([outcome({ state: 'failed', failure: 'assertion' })]));
    expect(mapped.results).toEqual([]);
    expect(mapped.executionErrors).toEqual([expect.objectContaining({ code: 'unattributed_failure' })]);
  });

  it('reports a test timeout as test_timeout and records no result for it', () => {
    const mapped = mapRunnerReport(report([outcome({ state: 'failed', failure: 'timeout', retina: withDeclared })]));
    expect(mapped.results).toEqual([]);
    expect(mapped.executionErrors).toEqual([
      expect.objectContaining({ code: 'test_timeout', caseId: 'form/web/initial', platform: 'web' }),
    ]);
  });
});

describe('mapRunnerReport: run-level problems', () => {
  it('counts skipped tests and records nothing for them', () => {
    const mapped = mapRunnerReport(report([outcome({ state: 'skipped', retina: withDeclared })]));
    expect(mapped.results).toEqual([]);
    expect(mapped.counts).toEqual({ total: 1, passed: 0, failed: 0, skipped: 1 });
  });

  it('reports zero test files as no_test_files', () => {
    expect(mapRunnerReport(report([], { testFiles: 0 })).executionErrors).toEqual([
      expect.objectContaining({ code: 'no_test_files' }),
    ]);
  });

  it('reports module problems: collection, hook timeout and hook failure', () => {
    const mapped = mapRunnerReport(
      report([], {
        moduleProblems: [
          { file: 'a.test.ts', kind: 'collection', timeout: false },
          { file: 'b.test.ts', kind: 'hook', timeout: true },
          { file: 'c.test.ts', kind: 'hook', timeout: false },
        ],
      }),
    );
    expect(mapped.executionErrors.map((e) => e.code)).toEqual(['collection_error', 'test_timeout', 'setup_failure']);
  });

  it('reports unhandled errors, an interrupted run and a runner start error', () => {
    const mapped = mapRunnerReport(report([], { unhandledErrors: 2, interrupted: true, startError: 'Error' }));
    expect(mapped.executionErrors.map((e) => e.code)).toEqual(['runner_error', 'unhandled_error', 'run_interrupted']);
  });
});
