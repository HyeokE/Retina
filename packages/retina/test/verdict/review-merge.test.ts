import { describe, expect, it } from 'vitest';
import { aggregateRun, mergeReview, type CaseResult, type CaseReview, type ReviewMergeOutcome } from '../../src/index.ts';
import { caseResult, check, deepFreeze, requiredFor } from '../helpers/fixtures.ts';

const hashes = { expected: 'sha256:e', actual: 'sha256:a', diff: 'sha256:d' } as const;

const auto: CaseResult = caseResult('form/web-mobile/initial', 'web', [
  check('functional', 'PASS'),
  check('design', 'REVIEW_REQUIRED', { reasons: ['no_threshold'], imageHashes: hashes }),
]);

function review(overrides: Partial<CaseReview> = {}): CaseReview {
  return {
    caseId: 'form/web-mobile/initial',
    checkKind: 'design',
    imageHashes: hashes,
    verdict: 'REVIEW_REQUIRED',
    reviewer: 'agent',
    reasons: [],
    ...overrides,
  };
}

function merged(outcome: ReviewMergeOutcome): CaseResult {
  if (outcome.kind !== 'merged') {
    throw new Error(`expected merged, got ${outcome.code}`);
  }
  return outcome.result;
}

function designStatus(result: CaseResult): string | undefined {
  return result.checks.find((c) => c.kind === 'design')?.status;
}

describe('mergeReview: status can only get worse', () => {
  it('lowers REVIEW_REQUIRED to FAIL and appends the review reasons', () => {
    const result = merged(mergeReview(auto, review({ verdict: 'FAIL', reasons: ['button overflows by 12px'] }), { mode: 'dev' }));
    expect(designStatus(result)).toBe('FAIL');
    expect(result.checks.find((c) => c.kind === 'design')?.reasons).toEqual(['no_threshold', 'button overflows by 12px']);
  });

  it('cannot raise REVIEW_REQUIRED to PASS', () => {
    const result = merged(mergeReview(auto, review({ verdict: 'PASS' }), { mode: 'dev' }));
    expect(designStatus(result)).toBe('REVIEW_REQUIRED');
  });

  it('cannot raise INCONCLUSIVE to PASS or REVIEW_REQUIRED', () => {
    const inconclusive = caseResult(auto.caseId, 'web', [check('design', 'INCONCLUSIVE', { imageHashes: hashes })]);
    expect(designStatus(merged(mergeReview(inconclusive, review({ verdict: 'PASS' }), { mode: 'validate' })))).toBe(
      'INCONCLUSIVE',
    );
    expect(
      designStatus(merged(mergeReview(inconclusive, review({ verdict: 'REVIEW_REQUIRED' }), { mode: 'validate' }))),
    ).toBe('INCONCLUSIVE');
  });

  it('leaves the other checks untouched', () => {
    const result = merged(mergeReview(auto, review({ verdict: 'FAIL' }), { mode: 'dev' }));
    expect(result.checks.find((c) => c.kind === 'functional')).toEqual(check('functional', 'PASS'));
  });
});

describe('mergeReview: rejections', () => {
  it('rejects a review whose image hashes differ from the case', () => {
    const outcome = mergeReview(auto, review({ imageHashes: { ...hashes, actual: 'sha256:other' } }), { mode: 'dev' });
    expect(outcome).toMatchObject({ kind: 'rejected', code: 'hash_mismatch' });
  });

  it('rejects a review that omits a hash the case has', () => {
    const outcome = mergeReview(auto, review({ imageHashes: { expected: hashes.expected, actual: hashes.actual } }), {
      mode: 'dev',
    });
    expect(outcome).toMatchObject({ kind: 'rejected', code: 'hash_mismatch' });
  });

  it('rejects a review of a check that has no image hashes', () => {
    const outcome = mergeReview(auto, review({ checkKind: 'functional' }), { mode: 'dev' });
    expect(outcome).toMatchObject({ kind: 'rejected', code: 'hash_mismatch' });
  });

  it('rejects a review for another case', () => {
    expect(mergeReview(auto, review({ caseId: 'other' }), { mode: 'dev' })).toMatchObject({
      kind: 'rejected',
      code: 'case_mismatch',
    });
  });

  it('rejects a review for a check kind the case does not have', () => {
    expect(mergeReview(auto, review({ checkKind: 'regression' }), { mode: 'dev' })).toMatchObject({
      kind: 'rejected',
      code: 'check_not_found',
    });
  });
});

describe('mergeReview: user acceptance', () => {
  const acceptance = { by: 'user', diffHash: hashes.diff } as const;

  it('records a user acceptance on the reviewed check, not on the case, in dev mode', () => {
    const result = merged(mergeReview(auto, review({ reviewer: 'user', acceptance }), { mode: 'dev' }));
    expect(result.checks.find((c) => c.kind === 'design')?.acceptance).toEqual(acceptance);
    expect(result.checks.find((c) => c.kind === 'functional')?.acceptance).toBeUndefined();
    expect('acceptance' in result).toBe(false);
    expect(designStatus(result)).toBe('REVIEW_REQUIRED');

    const run = aggregateRun({
      mode: 'dev',
      declaredPlatforms: ['web'],
      projectPlatforms: ['web'],
      requiredCases: [requiredFor(result)],
      results: [result],
    });
    expect(run).toMatchObject({ kind: 'aggregate', status: 'PASS', gateEligible: false });
  });

  it('rejects an acceptance written by the agent', () => {
    expect(mergeReview(auto, review({ acceptance }), { mode: 'dev' })).toMatchObject({
      kind: 'rejected',
      code: 'agent_cannot_accept',
    });
  });

  it('rejects an acceptance outside dev mode', () => {
    expect(mergeReview(auto, review({ reviewer: 'user', acceptance }), { mode: 'validate' })).toMatchObject({
      kind: 'rejected',
      code: 'acceptance_not_allowed',
    });
  });

  it('rejects an acceptance when the case is not REVIEW_REQUIRED', () => {
    const failing: CaseResult = { ...auto, checks: [...auto.checks, check('layout', 'FAIL')] };
    expect(mergeReview(failing, review({ reviewer: 'user', acceptance }), { mode: 'dev' })).toMatchObject({
      kind: 'rejected',
      code: 'acceptance_not_allowed',
    });
    expect(mergeReview(auto, review({ reviewer: 'user', verdict: 'FAIL', acceptance }), { mode: 'dev' })).toMatchObject({
      kind: 'rejected',
      code: 'acceptance_not_allowed',
    });
  });

  it('rejects an acceptance whose diff hash is not the case diff', () => {
    const outcome = mergeReview(auto, review({ reviewer: 'user', acceptance: { by: 'user', diffHash: 'sha256:x' } }), {
      mode: 'dev',
    });
    expect(outcome).toMatchObject({ kind: 'rejected', code: 'hash_mismatch' });
  });
});

describe('mergeReview: acceptance on a case with two REVIEW_REQUIRED checks', () => {
  const regressionHashes = { expected: 'sha256:re', actual: 'sha256:ra', diff: 'sha256:rd' } as const;
  const twoReviews: CaseResult = {
    ...auto,
    checks: [...auto.checks, check('regression', 'REVIEW_REQUIRED', { imageHashes: regressionHashes })],
  };

  function runStatus(result: CaseResult): string {
    return aggregateRun({
      mode: 'dev',
      declaredPlatforms: ['web'],
      projectPlatforms: ['web'],
      requiredCases: [requiredFor(result)],
      results: [result],
    }).status;
  }

  it('needs one acceptance per check before the case passes', () => {
    const designOnly = merged(
      mergeReview(twoReviews, review({ reviewer: 'user', acceptance: { by: 'user', diffHash: hashes.diff } }), {
        mode: 'dev',
      }),
    );
    expect(runStatus(designOnly)).toBe('REVIEW_REQUIRED');

    const both = merged(
      mergeReview(
        designOnly,
        review({
          reviewer: 'user',
          checkKind: 'regression',
          imageHashes: regressionHashes,
          acceptance: { by: 'user', diffHash: regressionHashes.diff },
        }),
        { mode: 'dev' },
      ),
    );
    expect(runStatus(both)).toBe('PASS');
  });
});

describe('mergeReview: immutability', () => {
  it('returns a new case and never mutates the automatic result or the review', () => {
    const frozenAuto = deepFreeze(structuredClone(auto));
    const frozenReview = deepFreeze(review({ verdict: 'FAIL', reasons: ['x'] }));
    const result = merged(mergeReview(frozenAuto, frozenReview, { mode: 'dev' }));
    expect(result).not.toBe(frozenAuto);
    expect(frozenAuto).toEqual(auto);
  });
});
