import type { CaseResult, Status } from './types.ts';

/** Statuses from least to most severe: FAIL > INCONCLUSIVE > REVIEW_REQUIRED > PASS. */
export const STATUS_SEVERITY_ORDER: readonly Status[] = ['PASS', 'REVIEW_REQUIRED', 'INCONCLUSIVE', 'FAIL'];

const SEVERITY: Readonly<Record<Status, number>> = {
  PASS: 0,
  REVIEW_REQUIRED: 1,
  INCONCLUSIVE: 2,
  FAIL: 3,
};

/** Returns the more severe of two statuses. */
export function mergeStatus(a: Status, b: Status): Status {
  return SEVERITY[b] > SEVERITY[a] ? b : a;
}

/**
 * Returns the most severe status in the list. An empty list has no evidence,
 * so it is INCONCLUSIVE, never PASS.
 */
export function worstStatus(statuses: readonly Status[]): Status {
  const [first, ...rest] = statuses;
  if (first === undefined) {
    return 'INCONCLUSIVE';
  }
  return rest.reduce(mergeStatus, first);
}

/**
 * The automatic status of a case: the worst of its checks. A case with zero
 * checks is INCONCLUSIVE. User acceptances are not applied here; see
 * `resolveCase`, which also needs the run mode.
 */
export function caseStatus(result: CaseResult): Status {
  return worstStatus(result.checks.map((check) => check.status));
}

export function zeroStatusCounts(): Record<Status, number> {
  return { PASS: 0, FAIL: 0, REVIEW_REQUIRED: 0, INCONCLUSIVE: 0 };
}
