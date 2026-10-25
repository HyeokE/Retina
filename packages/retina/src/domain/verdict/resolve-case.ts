import { worstStatus } from './status.ts';
import {
  VERDICT_REASONS,
  type Acceptance,
  type CaseResult,
  type CheckKind,
  type CheckResult,
  type Platform,
  type RunMode,
  type Status,
} from './types.ts';

/** A case after the run mode and any user acceptances have been applied. */
export interface ResolvedCase {
  readonly caseId: string;
  readonly platform: Platform;
  readonly profile: string;
  readonly required: boolean;
  /** Expected check kinds the result did not report; each counts as an INCONCLUSIVE check. */
  readonly missingChecks: readonly CheckKind[];
  /** Worst of the checks (including missing expected ones), before acceptance. */
  readonly autoStatus: Status;
  /** PASS when every non-PASS check was validly accepted, otherwise `autoStatus`. */
  readonly status: Status;
  /** True when the case became PASS through acceptance. */
  readonly accepted: boolean;
  /** Checks whose acceptance is valid, even when the case as a whole is not accepted. */
  readonly acceptedChecks: readonly CheckKind[];
  readonly reasons: readonly string[];
}

/**
 * Why an acceptance cannot apply to a check, or `undefined` when it can:
 * the run must be `dev`, the check REVIEW_REQUIRED, and the accepted diff hash
 * must equal the check's recorded diff hash.
 */
export function acceptanceBlocker(check: CheckResult, acceptance: Acceptance, mode: RunMode): string | undefined {
  if (mode !== 'dev') {
    return VERDICT_REASONS.acceptanceRequiresDevMode;
  }
  if (check.status !== 'REVIEW_REQUIRED') {
    return VERDICT_REASONS.acceptanceRequiresReviewRequired;
  }
  const recordedDiff = check.imageHashes?.diff;
  if (recordedDiff === undefined || recordedDiff !== acceptance.diffHash) {
    return VERDICT_REASONS.acceptanceHashMismatch;
  }
  return undefined;
}

function isAccepted(check: CheckResult, mode: RunMode): boolean {
  return check.acceptance !== undefined && acceptanceBlocker(check, check.acceptance, mode) === undefined;
}

function checkReasons(result: CaseResult, checks: readonly CheckResult[]): readonly string[] {
  const failing = checks.filter((check) => check.status !== 'PASS').flatMap((check) => check.reasons);
  return result.checks.length === 0 ? [VERDICT_REASONS.noChecks, ...failing] : failing;
}

function missingCheck(kind: CheckKind): CheckResult {
  return { kind, status: 'INCONCLUSIVE', reasons: [VERDICT_REASONS.checkMissing] };
}

function ignoredAcceptanceReasons(result: CaseResult, mode: RunMode): readonly string[] {
  const blockers = result.checks.flatMap((check) => {
    const blocker = check.acceptance ? acceptanceBlocker(check, check.acceptance, mode) : undefined;
    return blocker === undefined ? [] : [blocker];
  });
  return [...new Set(blockers)];
}

/**
 * Applies the run mode to one case. Each kind in `expectedChecks` that the
 * result does not report is added as an INCONCLUSIVE `check_missing` check.
 * The case becomes PASS only when it is REVIEW_REQUIRED (no FAIL, no
 * INCONCLUSIVE) and every non-PASS check carries a valid acceptance of its
 * own. Invalid acceptances are ignored and the reason is recorded.
 */
export function resolveCase(
  result: CaseResult,
  mode: RunMode,
  required: boolean,
  expectedChecks: readonly CheckKind[] = [],
): ResolvedCase {
  const present = new Set(result.checks.map((check) => check.kind));
  const missingChecks = [...new Set(expectedChecks)].filter((kind) => !present.has(kind));
  const checks = [...result.checks, ...missingChecks.map(missingCheck)];
  const autoStatus = worstStatus(checks.map((check) => check.status));
  const acceptedChecks = result.checks.filter((check) => isAccepted(check, mode)).map((check) => check.kind);
  const accepted =
    autoStatus === 'REVIEW_REQUIRED' && checks.every((check) => check.status === 'PASS' || isAccepted(check, mode));
  return {
    caseId: result.caseId,
    platform: result.platform,
    profile: result.profile,
    required,
    missingChecks,
    autoStatus,
    status: accepted ? 'PASS' : autoStatus,
    accepted,
    acceptedChecks,
    reasons: [...checkReasons(result, checks), ...ignoredAcceptanceReasons(result, mode)],
  };
}
