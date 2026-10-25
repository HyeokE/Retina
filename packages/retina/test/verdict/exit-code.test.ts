import { describe, expect, it } from 'vitest';
import {
  aggregateRun,
  EXIT_CODES,
  executionError,
  exitCodeFor,
  type AggregateInput,
  type CaseResult,
} from '../../src/index.ts';
import { caseResult, check, passCase, requiredFor, reviewCheck } from '../helpers/fixtures.ts';

function run(results: readonly CaseResult[], overrides: Partial<AggregateInput> = {}): number {
  return exitCodeFor(
    aggregateRun({
      mode: 'validate',
      declaredPlatforms: ['web'],
      projectPlatforms: ['web'],
      requiredCases: results.map((r) => requiredFor(r)),
      results,
      ...overrides,
    }),
  );
}

describe('exitCodeFor', () => {
  it('exposes the documented codes', () => {
    expect(EXIT_CODES).toEqual({ pass: 0, fail: 1, executionError: 2, unresolved: 3 });
  });

  it('is 0 when every required result passes', () => {
    expect(run([passCase('a', 'web'), passCase('b', 'web')])).toBe(0);
  });

  it('is 1 when any FAIL exists, even next to REVIEW_REQUIRED and INCONCLUSIVE', () => {
    expect(
      run([
        caseResult('a', 'web', [check('layout', 'FAIL')]),
        caseResult('b', 'web', [check('design', 'REVIEW_REQUIRED')]),
        caseResult('c', 'web', [check('appearance', 'INCONCLUSIVE')]),
      ]),
    ).toBe(1);
  });

  it('is 2 for an execution error, including zero tests', () => {
    expect(run([])).toBe(2);
    expect(run([passCase('a', 'web')], { requiredCases: [] })).toBe(2);
    expect(exitCodeFor({ kind: 'execution_error', code: 'no_results', message: 'no results' })).toBe(2);
  });

  it('is 2 when a FAIL and an execution error coexist, while the status stays FAIL', () => {
    const outcome = aggregateRun({
      mode: 'validate',
      declaredPlatforms: ['web', 'android'],
      projectPlatforms: ['web', 'android'],
      requiredCases: [{ caseId: 'a', platform: 'web', expectedChecks: ['functional'] }],
      results: [caseResult('a', 'web', [check('functional', 'FAIL', { reasons: ['save did not persist'] })])],
      executionErrors: [executionError('provider_error', 'emulator did not boot', { platform: 'android' })],
    });
    expect(exitCodeFor(outcome)).toBe(2);
    expect(outcome.status).toBe('FAIL');
    expect(outcome.cases[0]?.reasons).toContain('save did not persist');
    expect(outcome.executionErrors.map((error) => error.code)).toEqual(['provider_error']);
  });

  it('is 3 when only REVIEW_REQUIRED or INCONCLUSIVE remain', () => {
    expect(run([passCase('a', 'web'), caseResult('b', 'web', [check('design', 'REVIEW_REQUIRED')])])).toBe(3);
    expect(run([passCase('a', 'web'), caseResult('b', 'web', [])])).toBe(3);
    expect(run([passCase('a', 'web')], {
      requiredCases: [
        { caseId: 'a', platform: 'web', expectedChecks: ['functional'] },
        { caseId: 'missing', platform: 'web', expectedChecks: ['functional'] },
      ],
    })).toBe(3);
  });

  it('counts an accepted dev case as PASS while the run stays gate ineligible', () => {
    const accepted: CaseResult = caseResult('a', 'web', [reviewCheck('design', 'sha256:diff', 'sha256:diff')]);
    const outcome = aggregateRun({
      mode: 'dev',
      declaredPlatforms: ['web'],
      projectPlatforms: ['web'],
      requiredCases: [requiredFor(accepted)],
      results: [accepted],
    });
    expect(exitCodeFor(outcome)).toBe(0);
    expect(outcome).toMatchObject({ kind: 'aggregate', gateEligible: false });
  });
});
