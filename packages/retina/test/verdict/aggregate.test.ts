import { describe, expect, it } from 'vitest';
import {
  aggregateRun,
  executionError,
  exitCodeFor,
  type AggregateInput,
  type CheckKind,
  type Platform,
  type RequiredCase,
} from '../../src/index.ts';
import { caseResult, check, deepFreeze, passCase, reviewCheck } from '../helpers/fixtures.ts';

function req(caseId: string, platform: Platform, expectedChecks: readonly CheckKind[] = ['functional']): RequiredCase {
  return { caseId, platform, expectedChecks };
}

const base: AggregateInput = {
  mode: 'validate',
  declaredPlatforms: ['web', 'ios'],
  projectPlatforms: ['web', 'ios'],
  requiredCases: [req('a/web', 'web'), req('a/ios', 'ios')],
  results: [passCase('a/web', 'web'), passCase('a/ios', 'ios')],
};

describe('aggregateRun: happy path', () => {
  it('passes when every required case passes on every declared platform', () => {
    const run = aggregateRun(base);
    expect(run.status).toBe('PASS');
    expect(run.counts).toEqual({ PASS: 2, FAIL: 0, REVIEW_REQUIRED: 0, INCONCLUSIVE: 0 });
    expect(run.missingCases).toEqual([]);
    expect(run.excludedRequiredCases).toEqual([]);
    expect(run.scope).toEqual({
      kind: 'full',
      declaredPlatforms: ['web', 'ios'],
      executedPlatforms: ['web', 'ios'],
      missingPlatforms: [],
      excludedPlatforms: [],
    });
    expect(run.gateEligible).toBe(true);
  });

  it('follows the worst case status', () => {
    const run = aggregateRun({
      ...base,
      results: [
        passCase('a/web', 'web'),
        caseResult('a/ios', 'ios', [check('functional', 'PASS'), check('design', 'REVIEW_REQUIRED')]),
      ],
    });
    expect(run.status).toBe('REVIEW_REQUIRED');
    expect(run.counts.REVIEW_REQUIRED).toBe(1);
  });

  it('treats a result with zero checks as INCONCLUSIVE', () => {
    const run = aggregateRun({ ...base, results: [passCase('a/web', 'web'), caseResult('a/ios', 'ios', [])] });
    expect(run.status).toBe('INCONCLUSIVE');
    expect(run.cases.find((c) => c.caseId === 'a/ios')?.reasons).toContain('no_checks');
  });

  it('lets a non-required failing case on a declared platform fail the run', () => {
    const run = aggregateRun({
      ...base,
      results: [...base.results, caseResult('extra/web', 'web', [check('layout', 'FAIL')])],
    });
    expect(run.status).toBe('FAIL');
    expect(run.cases.find((c) => c.caseId === 'extra/web')?.required).toBe(false);
  });
});

describe('aggregateRun: missing work', () => {
  it('reports a required case without a result as INCONCLUSIVE with reason missing', () => {
    const run = aggregateRun({ ...base, requiredCases: [...base.requiredCases, req('b/web', 'web')] });
    expect(run.status).toBe('INCONCLUSIVE');
    expect(run.missingCases).toEqual([{ caseId: 'b/web', platform: 'web', status: 'INCONCLUSIVE', reasons: ['missing'] }]);
    expect(run.counts).toEqual({ PASS: 2, FAIL: 0, REVIEW_REQUIRED: 0, INCONCLUSIVE: 1 });
  });

  it("reports one platform's missing required cases when all three platforms are declared", () => {
    const all: readonly Platform[] = ['web', 'ios', 'android'];
    const run = aggregateRun({
      ...base,
      declaredPlatforms: all,
      projectPlatforms: all,
      requiredCases: [req('a/web', 'web'), req('a/ios', 'ios'), req('a/android', 'android')],
      results: [passCase('a/web', 'web'), passCase('a/ios', 'ios'), passCase('other/android', 'android')],
    });
    expect(run.status).toBe('INCONCLUSIVE');
    expect(run.missingCases).toEqual([
      { caseId: 'a/android', platform: 'android', status: 'INCONCLUSIVE', reasons: ['missing'] },
    ]);
    expect(exitCodeFor(run)).toBe(3);
  });

  it('does not let a result on another platform satisfy a required case', () => {
    const run = aggregateRun({
      ...base,
      requiredCases: [req('a/web', 'web'), req('shared', 'web')],
      results: [passCase('a/web', 'web'), passCase('shared', 'ios')],
    });
    expect(run.status).toBe('INCONCLUSIVE');
    expect(run.missingCases.map((m) => [m.caseId, m.platform])).toEqual([['shared', 'web']]);
    expect(run.cases.find((c) => c.caseId === 'shared')?.required).toBe(false);
  });

  it('reports a declared platform without results as INCONCLUSIVE platform_missing and partial scope', () => {
    const run = aggregateRun({ ...base, requiredCases: [req('a/web', 'web')], results: [passCase('a/web', 'web')] });
    expect(run.status).toBe('INCONCLUSIVE');
    expect(run.platforms).toEqual([
      { platform: 'web', status: 'PASS', caseCount: 1, reasons: [] },
      { platform: 'ios', status: 'INCONCLUSIVE', caseCount: 0, reasons: ['platform_missing'] },
    ]);
    expect(run.scope.kind).toBe('partial');
    expect(run.scope.missingPlatforms).toEqual(['ios']);
  });

  it('never counts results from undeclared platforms toward PASS', () => {
    const run = aggregateRun({
      ...base,
      declaredPlatforms: ['web'],
      projectPlatforms: ['web'],
      requiredCases: [req('a/web', 'web'), req('b/web', 'web')],
      results: [passCase('a/web', 'web'), passCase('b/web', 'android')],
    });
    expect(run.status).toBe('INCONCLUSIVE');
    expect(run.missingCases.map((m) => m.caseId)).toEqual(['b/web']);
    expect(run.undeclaredResults.map((c) => c.caseId)).toEqual(['b/web']);
    expect(run.cases.map((c) => c.caseId)).toEqual(['a/web']);
  });

  it('reports undeclared failures without letting them decide the status', () => {
    const run = aggregateRun({
      ...base,
      declaredPlatforms: ['web'],
      projectPlatforms: ['web'],
      requiredCases: [req('a/web', 'web')],
      results: [passCase('a/web', 'web'), caseResult('a/android', 'android', [check('functional', 'FAIL')])],
    });
    expect(run.status).toBe('PASS');
    expect(run.undeclaredResults[0]?.status).toBe('FAIL');
  });
});

describe('aggregateRun: scope', () => {
  const fullRequired = [req('a/web', 'web'), req('a/ios', 'ios'), req('a/android', 'android')];

  it('lets a web-only run of a multi-platform project pass as a partial run', () => {
    const run = aggregateRun({
      ...base,
      declaredPlatforms: ['web'],
      projectPlatforms: ['web', 'ios', 'android'],
      requiredCases: fullRequired,
      results: [passCase('a/web', 'web')],
    });
    expect(run.status).toBe('PASS');
    expect(exitCodeFor(run)).toBe(0);
    expect(run.missingCases).toEqual([]);
    expect(run.excludedRequiredCases).toEqual([req('a/ios', 'ios'), req('a/android', 'android')]);
    expect(run.counts).toEqual({ PASS: 1, FAIL: 0, REVIEW_REQUIRED: 0, INCONCLUSIVE: 0 });
    expect(run.scope.kind).toBe('partial');
    expect(run.scope.excludedPlatforms).toEqual(['ios', 'android']);
    expect(run.gateEligible).toBe(false);
  });

  it('labels a run full only when every project platform is declared and executed', () => {
    const all: readonly Platform[] = ['web', 'ios', 'android'];
    const run = aggregateRun({
      ...base,
      declaredPlatforms: all,
      projectPlatforms: all,
      requiredCases: fullRequired,
      results: [passCase('a/web', 'web'), passCase('a/ios', 'ios'), passCase('a/android', 'android')],
    });
    expect(run.status).toBe('PASS');
    expect(run.scope.kind).toBe('full');
  });

  it('assumes every known platform when projectPlatforms is omitted, so a web-only run is partial', () => {
    const { projectPlatforms: _omitted, ...rest } = base;
    const run = aggregateRun({
      ...rest,
      declaredPlatforms: ['web'],
      requiredCases: [req('a/web', 'web')],
      results: [passCase('a/web', 'web')],
    });
    expect(run.scope.kind).toBe('partial');
  });
});

describe('aggregateRun: execution errors', () => {
  function codes(input: AggregateInput): readonly string[] {
    return aggregateRun(input).executionErrors.map((error) => error.code);
  }

  it('records an execution error when no case is required', () => {
    expect(codes({ ...base, requiredCases: [] })).toEqual(['no_required_cases']);
  });

  it('records no_required_cases when no required case is on a declared platform', () => {
    const run = aggregateRun({
      ...base,
      declaredPlatforms: ['web'],
      requiredCases: [req('a/ios', 'ios')],
      results: [passCase('a/web', 'web')],
    });
    expect(run.executionErrors.map((error) => error.code)).toEqual(['no_required_cases']);
    expect(run.excludedRequiredCases).toEqual([req('a/ios', 'ios')]);
    expect(exitCodeFor(run)).toBe(2);
  });

  it('records an execution error, not a status, when there are zero results', () => {
    const run = aggregateRun({ ...base, results: [] });
    expect(run.executionErrors.map((error) => error.code)).toEqual(['no_results']);
    expect(run.status).toBe('INCONCLUSIVE');
    expect(run.gateEligible).toBe(false);
  });

  it('records an execution error when no platform is declared', () => {
    expect(codes({ ...base, declaredPlatforms: [] })).toContain('no_declared_platforms');
  });

  it('records an execution error when two results share a case id', () => {
    const run = aggregateRun({ ...base, results: [...base.results, passCase('a/web', 'web')] });
    expect(run.executionErrors).toEqual([
      { kind: 'execution_error', code: 'duplicate_case_id', message: expect.any(String), caseId: 'a/web' },
    ]);
  });

  it('keeps reported execution errors next to the results and the FAIL status', () => {
    const providerError = executionError('provider_error', 'auth provider failed', { platform: 'ios' });
    const run = aggregateRun({
      ...base,
      requiredCases: [req('a/web', 'web', ['layout'])],
      results: [caseResult('a/web', 'web', [check('layout', 'FAIL', { reasons: ['button overflows'] })])],
      executionErrors: [providerError],
    });
    expect(run.status).toBe('FAIL');
    expect(run.executionErrors).toEqual([providerError]);
    expect(run.cases[0]?.reasons).toEqual(['button overflows']);
    expect(run.platforms.find((p) => p.platform === 'ios')?.reasons).toEqual(['platform_missing', 'execution_error']);
    expect(run.gateEligible).toBe(false);
  });

  it('turns an otherwise passing run INCONCLUSIVE when an execution error was reported', () => {
    const run = aggregateRun({ ...base, executionErrors: [executionError('setup_failure', 'fixture setup failed')] });
    expect(run.status).toBe('INCONCLUSIVE');
  });
});

describe('aggregateRun: user acceptance (per check)', () => {
  function devRun(iosChecks: Parameters<typeof caseResult>[2], mode: AggregateInput['mode'] = 'dev') {
    const kinds = [...new Set(iosChecks.map((c) => c.kind))];
    const run = aggregateRun({
      ...base,
      mode,
      requiredCases: [req('a/web', 'web'), req('a/ios', 'ios', kinds)],
      results: [passCase('a/web', 'web'), caseResult('a/ios', 'ios', iosChecks)],
    });
    return { run, ios: run.cases.find((c) => c.caseId === 'a/ios') };
  }

  it('turns a REVIEW_REQUIRED check accepted with its diff hash into PASS in dev mode, never gate eligible', () => {
    const { run, ios } = devRun([reviewCheck('design', 'sha256:d', 'sha256:d')]);
    expect(run.status).toBe('PASS');
    expect(ios).toMatchObject({ autoStatus: 'REVIEW_REQUIRED', status: 'PASS', accepted: true, acceptedChecks: ['design'] });
    expect(run.acceptedCaseIds).toEqual(['a/ios']);
    expect(run.gateEligible).toBe(false);
    expect(exitCodeFor(run)).toBe(0);
  });

  it('ignores an acceptance with the wrong diff hash', () => {
    const { run, ios } = devRun([reviewCheck('design', 'sha256:d', 'sha256:forged')]);
    expect(run.status).toBe('REVIEW_REQUIRED');
    expect(ios).toMatchObject({ status: 'REVIEW_REQUIRED', accepted: false, acceptedChecks: [] });
    expect(ios?.reasons).toContain('acceptance_hash_mismatch');
    expect(run.acceptedCaseIds).toEqual([]);
  });

  it('ignores an acceptance on a check without a recorded diff hash', () => {
    const { run, ios } = devRun([reviewCheck('design', undefined, 'sha256:d')]);
    expect(run.status).toBe('REVIEW_REQUIRED');
    expect(ios?.reasons).toContain('acceptance_hash_mismatch');
  });

  it('keeps the case REVIEW_REQUIRED when only one of two REVIEW_REQUIRED checks is accepted', () => {
    const { run, ios } = devRun([reviewCheck('design', 'sha256:d', 'sha256:d'), reviewCheck('regression', 'sha256:r')]);
    expect(run.status).toBe('REVIEW_REQUIRED');
    expect(ios).toMatchObject({ status: 'REVIEW_REQUIRED', accepted: false, acceptedChecks: ['design'] });
    expect(run.acceptedCaseIds).toEqual([]);
    expect(run.gateEligible).toBe(false);
  });

  it('passes when every REVIEW_REQUIRED check is accepted with its own diff hash, in dev mode only', () => {
    const checks = [check('functional', 'PASS'), reviewCheck('design', 'sha256:d', 'sha256:d'), reviewCheck('regression', 'sha256:r', 'sha256:r')];
    const dev = devRun(checks);
    expect(dev.run.status).toBe('PASS');
    expect(dev.ios).toMatchObject({ accepted: true, acceptedChecks: ['design', 'regression'] });

    const validate = devRun(checks, 'validate');
    expect(validate.run.status).toBe('REVIEW_REQUIRED');
    expect(validate.ios).toMatchObject({ accepted: false, acceptedChecks: [] });
    expect(validate.ios?.reasons).toContain('acceptance_requires_dev_mode');
    expect(validate.run.acceptedCaseIds).toEqual([]);
    expect(validate.run.gateEligible).toBe(true);
  });

  it('never accepts a FAIL or INCONCLUSIVE check and keeps the worst status', () => {
    const failing = devRun([
      reviewCheck('design', 'sha256:d', 'sha256:d'),
      check('layout', 'FAIL', { imageHashes: { diff: 'sha256:l' }, acceptance: { by: 'user', diffHash: 'sha256:l' } }),
    ]);
    expect(failing.run.status).toBe('FAIL');
    expect(failing.ios).toMatchObject({ status: 'FAIL', accepted: false, acceptedChecks: ['design'] });
    expect(failing.ios?.reasons).toContain('acceptance_requires_review_required');

    const inconclusive = devRun([reviewCheck('design', 'sha256:d', 'sha256:d'), check('appearance', 'INCONCLUSIVE')]);
    expect(inconclusive.run.status).toBe('INCONCLUSIVE');
    expect(inconclusive.ios?.accepted).toBe(false);
  });

  it('is never gate eligible in dev mode, even without acceptance', () => {
    const run = aggregateRun({ ...base, mode: 'dev' });
    expect(run.status).toBe('PASS');
    expect(run.gateEligible).toBe(false);
  });
});

describe('aggregateRun: immutability', () => {
  it('does not mutate its input', () => {
    const input: AggregateInput = {
      ...base,
      mode: 'dev',
      requiredCases: [...base.requiredCases, req('missing/web', 'web'), req('x/android', 'android')],
      results: [passCase('a/web', 'web'), caseResult('a/ios', 'ios', [reviewCheck('design', 'h', 'h')])],
    };
    const snapshot = structuredClone(input);
    expect(() => aggregateRun(deepFreeze(input))).not.toThrow();
    expect(input).toEqual(snapshot);
  });
});

describe('aggregateRun: expected checks per required case', () => {
  const single = { mode: 'validate', declaredPlatforms: ['web'], projectPlatforms: ['web'] } as const;

  it('turns a missing expected check into an INCONCLUSIVE check_missing, even when the other check passes', () => {
    const run = aggregateRun({
      ...single,
      requiredCases: [req('a/web', 'web', ['functional', 'regression'])],
      results: [passCase('a/web', 'web')],
    });
    expect(run.status).toBe('INCONCLUSIVE');
    expect(run.cases[0]).toMatchObject({ status: 'INCONCLUSIVE', missingChecks: ['regression'] });
    expect(run.cases[0]?.reasons).toContain('check_missing');
    expect(run.counts.INCONCLUSIVE).toBe(1);
    expect(run.executionErrors).toEqual([]);
    expect(exitCodeFor(run)).toBe(3);
  });

  it('passes when every expected check is present and PASS', () => {
    const run = aggregateRun({
      ...single,
      requiredCases: [req('a/web', 'web', ['functional', 'regression'])],
      results: [caseResult('a/web', 'web', [check('regression', 'PASS'), check('functional', 'PASS')])],
    });
    expect(run.status).toBe('PASS');
    expect(run.cases[0]?.missingChecks).toEqual([]);
    expect(run.gateEligible).toBe(true);
    expect(exitCodeFor(run)).toBe(0);
  });

  it('still counts an extra, unexpected check kind', () => {
    const run = aggregateRun({
      ...single,
      requiredCases: [req('a/web', 'web', ['functional'])],
      results: [caseResult('a/web', 'web', [check('functional', 'PASS'), check('layout', 'FAIL')])],
    });
    expect(run.status).toBe('FAIL');
  });

  it('does not let a missing expected check be accepted away in dev mode', () => {
    const run = aggregateRun({
      ...single,
      mode: 'dev',
      requiredCases: [req('a/web', 'web', ['design', 'regression'])],
      results: [caseResult('a/web', 'web', [reviewCheck('design', 'sha256:d', 'sha256:d')])],
    });
    expect(run.status).toBe('INCONCLUSIVE');
    expect(run.acceptedCaseIds).toEqual([]);
  });

  it('records an execution error for an empty expectedChecks', () => {
    const run = aggregateRun({ ...single, requiredCases: [req('a/web', 'web', [])], results: [passCase('a/web', 'web')] });
    expect(run.executionErrors).toEqual([
      expect.objectContaining({ code: 'invalid_expected_checks', caseId: 'a/web', platform: 'web' }),
    ]);
    expect(exitCodeFor(run)).toBe(2);
    expect(run.gateEligible).toBe(false);
  });

  it('records an execution error for repeated kinds in expectedChecks', () => {
    const run = aggregateRun({
      ...single,
      requiredCases: [req('a/web', 'web', ['functional', 'functional'])],
      results: [passCase('a/web', 'web')],
    });
    expect(run.executionErrors.map((error) => error.code)).toEqual(['invalid_expected_checks']);
    expect(exitCodeFor(run)).toBe(2);
  });

  it('records duplicate_check_kind when a result repeats a check kind, so one PASS cannot mask the other', () => {
    const run = aggregateRun({
      ...single,
      requiredCases: [req('a/web', 'web', ['functional'])],
      results: [caseResult('a/web', 'web', [check('functional', 'PASS'), check('functional', 'PASS')])],
    });
    expect(run.executionErrors).toEqual([
      expect.objectContaining({ code: 'duplicate_check_kind', caseId: 'a/web', platform: 'web' }),
    ]);
    expect(run.status).toBe('INCONCLUSIVE');
    expect(exitCodeFor(run)).toBe(2);
  });

  it('merges the expected checks of a required case declared twice', () => {
    const run = aggregateRun({
      ...single,
      requiredCases: [req('a/web', 'web', ['functional']), req('a/web', 'web', ['regression'])],
      results: [passCase('a/web', 'web')],
    });
    expect(run.cases[0]?.missingChecks).toEqual(['regression']);
    expect(run.status).toBe('INCONCLUSIVE');
  });
});

describe('aggregateRun: gate eligibility needs full scope', () => {
  it('is eligible for a web-only plan whose project platforms are web only', () => {
    const run = aggregateRun({
      mode: 'validate',
      declaredPlatforms: ['web'],
      projectPlatforms: ['web'],
      requiredCases: [req('a/web', 'web')],
      results: [passCase('a/web', 'web')],
    });
    expect(run.scope.kind).toBe('full');
    expect(run.gateEligible).toBe(true);
  });

  it('is never eligible for a narrowed web-only run of a three-platform plan, even with PASS and exit 0', () => {
    const run = aggregateRun({
      mode: 'validate',
      declaredPlatforms: ['web'],
      projectPlatforms: ['web', 'ios', 'android'],
      requiredCases: [req('a/web', 'web'), req('a/ios', 'ios'), req('a/android', 'android')],
      results: [passCase('a/web', 'web')],
    });
    expect(run.status).toBe('PASS');
    expect(exitCodeFor(run)).toBe(0);
    expect(run.scope.kind).toBe('partial');
    expect(run.gateEligible).toBe(false);
  });
});
