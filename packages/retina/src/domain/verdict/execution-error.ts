import type { Platform } from './types.ts';

/**
 * Codes for problems that stop part or all of a run from being judged. The
 * first four are detected by `aggregateRun` itself; the rest are reported by
 * the run layer (configuration, providers, devices, artifacts).
 */
export type ExecutionErrorCode =
  | 'no_required_cases'
  | 'no_results'
  | 'no_declared_platforms'
  | 'duplicate_case_id'
  | 'config_error'
  | 'provider_error'
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
}

export interface ExecutionErrorLocation {
  readonly platform?: Platform;
  readonly caseId?: string;
}

export function executionError(
  code: ExecutionErrorCode,
  message: string,
  location: ExecutionErrorLocation = {},
): ExecutionError {
  return {
    kind: 'execution_error',
    code,
    message,
    ...(location.platform !== undefined ? { platform: location.platform } : {}),
    ...(location.caseId !== undefined ? { caseId: location.caseId } : {}),
  };
}
