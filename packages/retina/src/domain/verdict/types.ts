/**
 * Result model for Retina verdicts. Pure data: no I/O, no framework types.
 */

export type Status = 'PASS' | 'FAIL' | 'REVIEW_REQUIRED' | 'INCONCLUSIVE';

export type CheckKind = 'functional' | 'layout' | 'appearance' | 'design' | 'regression';

export type Platform = 'web' | 'ios' | 'android';

/** Every platform Retina knows about. Used as the default project scope. */
export const KNOWN_PLATFORMS: readonly Platform[] = ['web', 'ios', 'android'];

/** `dev` is the informational development loop, `validate` is the gate run. */
export type RunMode = 'dev' | 'validate';

/** Content hashes of the images a check was judged on (e.g. `sha256:…`). */
export interface ImageHashes {
  readonly expected?: string;
  readonly actual?: string;
  readonly diff?: string;
}

/**
 * A user's acceptance of one check's difference during a dev run. Only valid
 * when the run mode is `dev`, the check is REVIEW_REQUIRED and `diffHash`
 * equals the check's recorded `imageHashes.diff`. It never makes a run gate
 * eligible.
 */
export interface Acceptance {
  readonly by: 'user';
  readonly diffHash: string;
}

export interface CheckResult {
  readonly kind: CheckKind;
  readonly status: Status;
  readonly reasons: readonly string[];
  readonly imageHashes?: ImageHashes;
  readonly acceptance?: Acceptance;
}

/**
 * The automatic result of one case. `caseId` is the identity of the case in a
 * run and must be unique across results (encode scenario/profile/checkpoint in
 * it, e.g. `checkout-form/web-mobile/after-submit`).
 */
export interface CaseResult {
  readonly caseId: string;
  readonly platform: Platform;
  readonly profile: string;
  readonly checks: readonly CheckResult[];
}

/** A case the project requires, on the platform where it must run. */
export interface RequiredCase {
  readonly caseId: string;
  readonly platform: Platform;
}

/** Reason codes the verdict domain adds on its own. */
export const VERDICT_REASONS = {
  missing: 'missing',
  platformMissing: 'platform_missing',
  executionError: 'execution_error',
  noChecks: 'no_checks',
  acceptanceRequiresDevMode: 'acceptance_requires_dev_mode',
  acceptanceRequiresReviewRequired: 'acceptance_requires_review_required',
  acceptanceHashMismatch: 'acceptance_hash_mismatch',
} as const;

export type VerdictReason = (typeof VERDICT_REASONS)[keyof typeof VERDICT_REASONS];
