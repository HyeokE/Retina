import type { CheckKind, CheckResult, Status } from '../domain/verdict/types.ts';

/**
 * Result contract shared by every provider method (proposal). Providers return
 * a discriminated result instead of throwing; `reason` is a short, value-free
 * description (never a secret, token or credential).
 */
export interface ProviderFailure {
  readonly ok: false;
  readonly reason: string;
}

export type ProviderSuccess<T extends object = Record<never, never>> = Readonly<T> & { readonly ok: true };

export type ProviderResult<T extends object = Record<never, never>> = ProviderSuccess<T> | ProviderFailure;

/** The provider slots of `RetinaConfig.providers`. */
export const PROVIDER_NAMES = [
  'auth',
  'fixture',
  'data',
  'env',
  'schema',
  'buildIdentity',
  'navigator',
  'ready',
  'locators',
] as const;

export type ProviderName = (typeof PROVIDER_NAMES)[number];

/** Reason codes for a provider that blocks a check. */
export const PROVIDER_REASONS = {
  missing: 'provider_missing',
  failed: 'provider_failed',
  threw: 'provider_threw',
  invalidResult: 'provider_invalid_result',
} as const;

export type ProviderReason = (typeof PROVIDER_REASONS)[keyof typeof PROVIDER_REASONS];

/**
 * A missing or failed provider never lets a check pass: the only status it can
 * produce is INCONCLUSIVE (plan 6.1).
 */
export const PROVIDER_FAILURE_STATUS = 'INCONCLUSIVE' satisfies Status;

export type ProviderFailureStatus = typeof PROVIDER_FAILURE_STATUS;

/** A provider that is missing or failed. Its status is INCONCLUSIVE by type. */
export interface ProviderBlocked {
  readonly ok: false;
  readonly provider: ProviderName;
  readonly status: ProviderFailureStatus;
  readonly code: ProviderReason;
  readonly detail?: string;
}

/** A provider that succeeded. It carries no status: success only lets the check go on. */
export interface ProviderProceed<T extends object> {
  readonly ok: true;
  readonly provider: ProviderName;
  readonly value: ProviderSuccess<T>;
}

export type ProviderOutcome<T extends object = Record<never, never>> = ProviderProceed<T> | ProviderBlocked;

function blocked(provider: ProviderName, code: ProviderReason, detail?: string): ProviderBlocked {
  return {
    ok: false,
    provider,
    status: PROVIDER_FAILURE_STATUS,
    code,
    ...(detail !== undefined ? { detail } : {}),
  };
}

/** Maps a provider result (or its absence) to proceed / INCONCLUSIVE. */
export function providerOutcome<T extends object>(
  provider: ProviderName,
  result: ProviderResult<T> | undefined,
): ProviderOutcome<T> {
  if (result === undefined) {
    return blocked(provider, PROVIDER_REASONS.missing);
  }
  if (result.ok) {
    return { ok: true, provider, value: result };
  }
  return blocked(provider, PROVIDER_REASONS.failed, result.reason);
}

function isProviderResult(value: unknown): value is ProviderResult<object> {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const { ok, reason } = value as { readonly ok?: unknown; readonly reason?: unknown };
  return ok === true || (ok === false && typeof reason === 'string');
}

/**
 * Calls a provider defensively. A missing provider, a reported failure, a
 * thrown error or a malformed result are all INCONCLUSIVE. A thrown error is
 * recorded by its name only, because its message may carry secret values.
 */
export async function runProvider<T extends object>(
  provider: ProviderName,
  call: (() => Promise<ProviderResult<T>>) | undefined,
): Promise<ProviderOutcome<T>> {
  if (call === undefined) {
    return blocked(provider, PROVIDER_REASONS.missing);
  }
  let result: unknown;
  try {
    result = await call();
  } catch (error) {
    const name = error instanceof Error ? error.name : typeof error;
    return blocked(provider, PROVIDER_REASONS.threw, `provider threw ${name}`);
  }
  if (!isProviderResult(result)) {
    return blocked(provider, PROVIDER_REASONS.invalidResult);
  }
  return providerOutcome(provider, result as ProviderResult<T>);
}

/** The INCONCLUSIVE check a blocked provider stands for. */
export function providerBlockedCheck(kind: CheckKind, outcome: ProviderBlocked): CheckResult {
  return {
    kind,
    status: outcome.status,
    reasons: [`${outcome.code}:${outcome.provider}`, ...(outcome.detail !== undefined ? [outcome.detail] : [])],
  };
}
