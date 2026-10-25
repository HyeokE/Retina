import { acceptanceBlocker } from './resolve-case.ts';
import { caseStatus, mergeStatus } from './status.ts';
import {
  VERDICT_REASONS,
  type Acceptance,
  type CaseResult,
  type CheckKind,
  type CheckResult,
  type ImageHashes,
  type RunMode,
  type Status,
} from './types.ts';

/** A separate review of one check of one case (the domain shape of `review.json`). */
export interface CaseReview {
  readonly caseId: string;
  readonly checkKind: CheckKind;
  /** Must equal the hashes recorded on the reviewed check, key for key. */
  readonly imageHashes: ImageHashes;
  readonly verdict: Status;
  readonly reviewer: 'agent' | 'user';
  readonly reasons?: readonly string[];
  readonly acceptance?: Acceptance | null;
}

export interface ReviewMergeContext {
  readonly mode: RunMode;
}

export type ReviewRejectionCode =
  | 'case_mismatch'
  | 'check_not_found'
  | 'hash_mismatch'
  | 'agent_cannot_accept'
  | 'acceptance_not_allowed';

export type ReviewMergeOutcome =
  | { readonly kind: 'merged'; readonly result: CaseResult }
  | { readonly kind: 'rejected'; readonly code: ReviewRejectionCode; readonly message: string };

type ReviewRejection = Extract<ReviewMergeOutcome, { readonly kind: 'rejected' }>;

type TargetLookup = ReviewRejection | { readonly kind: 'target'; readonly check: CheckResult };

const HASH_KEYS = ['expected', 'actual', 'diff'] as const;

function reject(code: ReviewRejectionCode, message: string): ReviewRejection {
  return { kind: 'rejected', code, message };
}

function sameHashes(recorded: ImageHashes | undefined, reviewed: ImageHashes): boolean {
  if (recorded === undefined || HASH_KEYS.every((key) => recorded[key] === undefined)) {
    return false;
  }
  return HASH_KEYS.every((key) => recorded[key] === reviewed[key]);
}

function mergeCheck(check: CheckResult, review: CaseReview): CheckResult {
  return {
    ...check,
    status: mergeStatus(check.status, review.verdict),
    reasons: [...check.reasons, ...(review.reasons ?? [])],
  };
}

function findTarget(auto: CaseResult, review: CaseReview): TargetLookup {
  if (review.caseId !== auto.caseId) {
    return reject('case_mismatch', `Review is for "${review.caseId}", not "${auto.caseId}".`);
  }
  const target = auto.checks.find((check) => check.kind === review.checkKind);
  if (target === undefined) {
    return reject('check_not_found', `Case "${auto.caseId}" has no ${review.checkKind} check.`);
  }
  if (!sameHashes(target.imageHashes, review.imageHashes)) {
    return reject('hash_mismatch', 'Review image hashes do not match the artifacts of this case.');
  }
  return { kind: 'target', check: target };
}

function validateAcceptance(
  merged: CaseResult,
  mergedTarget: CheckResult,
  review: CaseReview,
  context: ReviewMergeContext,
): ReviewRejection | undefined {
  const acceptance = review.acceptance;
  if (acceptance === undefined || acceptance === null) {
    return undefined;
  }
  if (review.reviewer !== 'user' || acceptance.by !== 'user') {
    return reject('agent_cannot_accept', 'Only the user can accept a difference.');
  }
  const blocker = acceptanceBlocker(mergedTarget, acceptance, context.mode);
  if (blocker === VERDICT_REASONS.acceptanceHashMismatch) {
    return reject('hash_mismatch', 'Accepted diff hash does not match the recorded diff of this check.');
  }
  if (blocker !== undefined) {
    return reject('acceptance_not_allowed', `Acceptance is not allowed: ${blocker}.`);
  }
  if (caseStatus(merged) !== 'REVIEW_REQUIRED') {
    const reason = VERDICT_REASONS.acceptanceRequiresReviewRequired;
    return reject('acceptance_not_allowed', `Acceptance is not allowed: ${reason}.`);
  }
  return undefined;
}

/**
 * Merges a separate review into the automatic result of a case. The review
 * can only make a check worse (FAIL > INCONCLUSIVE > REVIEW_REQUIRED > PASS),
 * never better. The single exception is a user acceptance of a
 * REVIEW_REQUIRED check in a dev run: it must carry the check's recorded diff
 * hash, it is written onto the reviewed check, and `aggregateRun` applies it
 * (the case passes only when each of its non-PASS checks is accepted; never
 * gate eligible). Invalid reviews are returned as a typed rejection; the
 * automatic result is never modified.
 */
export function mergeReview(auto: CaseResult, review: CaseReview, context: ReviewMergeContext): ReviewMergeOutcome {
  const lookup = findTarget(auto, review);
  if (lookup.kind === 'rejected') {
    return lookup;
  }
  const mergedTarget = mergeCheck(lookup.check, review);
  const checks = auto.checks.map((check) => (check === lookup.check ? mergedTarget : check));
  const merged: CaseResult = { ...auto, checks };
  const rejection = validateAcceptance(merged, mergedTarget, review, context);
  if (rejection) {
    return rejection;
  }
  const acceptance = review.acceptance;
  if (!acceptance) {
    return { kind: 'merged', result: merged };
  }
  const accepted: CheckResult = { ...mergedTarget, acceptance: { by: acceptance.by, diffHash: acceptance.diffHash } };
  return {
    kind: 'merged',
    result: { ...merged, checks: merged.checks.map((check) => (check === mergedTarget ? accepted : check)) },
  };
}
