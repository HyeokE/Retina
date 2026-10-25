import type { Platform } from './types.ts';

/**
 * Codes for problems that stop part or all of a run from being judged. The
 * first six are detected by `aggregateRun` itself; the rest are reported by
 * the run layer (configuration, providers, devices, artifacts).
 */
export type ExecutionErrorCode =
  | 'no_required_cases'
  | 'no_results'
  | 'no_declared_platforms'
  | 'duplicate_case_id'
  | 'duplicate_check_kind'
  | 'invalid_expected_checks'
  | 'config_error'
  | 'provider_error'
  | 'provider_timeout'
  | 'setup_failure'
  | 'device_unavailable'
  | 'artifact_error';

/**
 * An execution error is not a status. Any execution error makes the exit code
 * 2; it adds INCONCLUSIVE to the run status, so a FAIL elsewhere stays FAIL.
 */
export interface ExecutionError {
  readonly kind: 'execution_error';
  readonly code: ExecutionErrorCode;
  readonly message: string;
  readonly platform?: Platform;
  readonly caseId?: string;
  /** The component that failed, e.g. a provider name. Never a value. */
  readonly provider?: string;
  /** A structured reason code, e.g. `provider_failed`. Never a value. */
  readonly reason?: string;
}

export interface ExecutionErrorLocation {
  readonly platform?: Platform;
  readonly caseId?: string;
}

/** Structured cause codes. Free-form details stay out, since they may carry values. */
export interface ExecutionErrorCause {
  readonly provider?: string;
  readonly reason?: string;
}

export function executionError(
  code: ExecutionErrorCode,
  message: string,
  location: ExecutionErrorLocation = {},
  cause: ExecutionErrorCause = {},
): ExecutionError {
  return {
    kind: 'execution_error',
    code,
    message,
    ...(location.platform !== undefined ? { platform: location.platform } : {}),
    ...(location.caseId !== undefined ? { caseId: location.caseId } : {}),
    ...(cause.provider !== undefined ? { provider: cause.provider } : {}),
    ...(cause.reason !== undefined ? { reason: cause.reason } : {}),
  };
}
