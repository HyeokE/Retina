import { describe, expect, it } from 'vitest';
import { caseStatus, mergeStatus, STATUS_SEVERITY_ORDER, worstStatus, type Status } from '../../src/index.ts';
import { caseResult, check, deepFreeze } from '../helpers/fixtures.ts';

const ORDER: readonly Status[] = ['PASS', 'REVIEW_REQUIRED', 'INCONCLUSIVE', 'FAIL'];

describe('mergeStatus', () => {
  it('orders severity FAIL > INCONCLUSIVE > REVIEW_REQUIRED > PASS', () => {
    expect(STATUS_SEVERITY_ORDER).toEqual(ORDER);
  });

  it.each(
    ORDER.flatMap((a, i) => ORDER.map((b, j) => [a, b, ORDER[Math.max(i, j)]] as const)),
  )('mergeStatus(%s, %s) = %s and is symmetric', (a, b, expected) => {
    expect(mergeStatus(a, b)).toBe(expected);
    expect(mergeStatus(b, a)).toBe(expected);
  });
});

describe('worstStatus', () => {
  it('returns the most severe status in the list', () => {
    expect(worstStatus(['PASS', 'REVIEW_REQUIRED', 'PASS'])).toBe('REVIEW_REQUIRED');
    expect(worstStatus(['PASS', 'FAIL', 'INCONCLUSIVE'])).toBe('FAIL');
    expect(worstStatus(['REVIEW_REQUIRED', 'INCONCLUSIVE'])).toBe('INCONCLUSIVE');
    expect(worstStatus(['PASS'])).toBe('PASS');
  });

  it('treats an empty list as INCONCLUSIVE, never PASS', () => {
    expect(worstStatus([])).toBe('INCONCLUSIVE');
  });
});

describe('caseStatus', () => {
  it('is the worst of the case checks', () => {
    const result = deepFreeze(
      caseResult('form/initial', 'web', [check('functional', 'PASS'), check('design', 'REVIEW_REQUIRED')]),
    );
    expect(caseStatus(result)).toBe('REVIEW_REQUIRED');
  });

  it('keeps design and regression separate and follows the worse one', () => {
    const result = caseResult('form/initial', 'ios', [check('design', 'REVIEW_REQUIRED'), check('regression', 'FAIL')]);
    expect(caseStatus(result)).toBe('FAIL');
  });

  it('is INCONCLUSIVE for a case with zero checks', () => {
    expect(caseStatus(caseResult('form/initial', 'web', []))).toBe('INCONCLUSIVE');
  });
});
