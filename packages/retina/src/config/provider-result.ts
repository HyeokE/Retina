import {
  executionError,
  type ExecutionError,
  type ExecutionErrorLocation,
} from '../domain/verdict/execution-error.ts';
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
  timeout: 'provider_timeout',
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
 * Time budget of one provider call. Unlimited waiting is not allowed, so at
 * least one bound is required; with both, the earlier one wins. `deadline` is
 * epoch milliseconds, usually `ProviderContext.deadline`.
 */
export type ProviderTimeLimit =
  | { readonly timeoutMs: number; readonly deadline?: number }
  | { readonly deadline: number; readonly timeoutMs?: number };

const TIMED_OUT = Symbol('timed-out');

type Settled = { readonly kind: 'returned'; readonly value: unknown } | { readonly kind: 'threw'; readonly name: string };

function budgetMs(limit: ProviderTimeLimit): number {
  const bounds = [limit.timeoutMs, limit.deadline === undefined ? undefined : limit.deadline - Date.now()];
  return Math.min(...bounds.filter((bound): bound is number => bound !== undefined));
}

/** Never rejects, so a provider that rejects after the timeout causes no unhandled rejection. */
async function settle(call: () => Promise<unknown>): Promise<Settled> {
  try {
    return { kind: 'returned', value: await call() };
  } catch (error) {
    return { kind: 'threw', name: error instanceof Error ? error.name : typeof error };
  }
}

/** Resolves after `ms` and aborts `controller`; `clear` cancels both. */
function startTimer(ms: number, controller: AbortController): { readonly elapsed: Promise<typeof TIMED_OUT>; readonly clear: () => void } {
  let id: ReturnType<typeof setTimeout> | undefined;
  const elapsed = new Promise<typeof TIMED_OUT>((resolve) => {
    id = setTimeout(() => {
      controller.abort();
      resolve(TIMED_OUT);
    }, ms);
  });
  return { elapsed, clear: () => clearTimeout(id) };
}

function interpret<T extends object>(provider: ProviderName, settled: Settled): ProviderOutcome<T> {
  if (settled.kind === 'threw') {
    return blocked(provider, PROVIDER_REASONS.threw, `provider threw ${settled.name}`);
  }
  if (!isProviderResult(settled.value)) {
    return blocked(provider, PROVIDER_REASONS.invalidResult);
  }
  return providerOutcome(provider, settled.value as ProviderResult<T>);
}

/**
 * Calls a provider defensively within a time budget. A missing provider, a
 * reported failure, a thrown error, a malformed result or an elapsed budget
 * are all INCONCLUSIVE. On timeout the signal passed to `call` is aborted and
 * the caller returns at once, even if the provider ignores the signal. The
 * timer is always cleared. A thrown error is recorded by its name only,
 * because its message may carry secret values.
 */
export async function runProvider<T extends object>(
  provider: ProviderName,
  call: ((signal: AbortSignal) => Promise<ProviderResult<T>>) | undefined,
  limit: ProviderTimeLimit,
): Promise<ProviderOutcome<T>> {
  if (call === undefined) {
    return blocked(provider, PROVIDER_REASONS.missing);
  }
  const ms = budgetMs(limit);
  if (!(ms > 0)) {
    return blocked(provider, PROVIDER_REASONS.timeout, 'deadline passed before the call');
  }
  const controller = new AbortController();
  const timer = startTimer(ms, controller);
  try {
    const settled = await Promise.race([settle(() => call(controller.signal)), timer.elapsed]);
    return settled === TIMED_OUT
      ? blocked(provider, PROVIDER_REASONS.timeout, `provider exceeded ${ms} ms`)
      : interpret<T>(provider, settled);
  } finally {
    timer.clear();
  }
}

/** The INCONCLUSIVE check a blocked provider stands for. */
export function providerBlockedCheck(kind: CheckKind, outcome: ProviderBlocked): CheckResult {
  return {
    kind,
    status: outcome.status,
    reasons: [`${outcome.code}:${outcome.provider}`, ...(outcome.detail !== undefined ? [outcome.detail] : [])],
  };
}

/**
 * The execution error a blocked provider stands for (exit code 2). It carries
 * the provider name and reason code only, never `detail`. The run layer adds
 * it to `executionErrors` next to the INCONCLUSIVE check from
 * `providerBlockedCheck`.
 */
export function providerBlockedError(outcome: ProviderBlocked, location: ExecutionErrorLocation = {}): ExecutionError {
  const code = outcome.code === PROVIDER_REASONS.timeout ? 'provider_timeout' : 'provider_error';
  return executionError(code, `Provider "${outcome.provider}" blocked the run (${outcome.code}).`, location, {
    provider: outcome.provider,
    reason: outcome.code,
  });
}
