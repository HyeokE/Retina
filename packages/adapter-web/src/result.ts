import type { ProviderFailure } from 'retina';

/** Why a web adapter call did not succeed. Codes are stable; `reason` is a short, value-free text. */
export type WebAdapterFailureCode =
  | 'invalid_input'
  | 'launch_failed'
  | 'disposed'
  | 'navigation_failed'
  | 'http_error'
  | 'timeout'
  | 'not_found'
  | 'capture_failed'
  | 'decode_failed'
  | 'browser_error';

/** A `ProviderFailure` with a machine-readable code, so callers can map it to a verdict. */
export interface WebAdapterFailure extends ProviderFailure {
  readonly code: WebAdapterFailureCode;
}

export type WebAdapterSuccess<T extends object> = Readonly<T> & { readonly ok: true };

/** `ProviderResult`-compatible outcome. Adapter calls return it instead of throwing. */
export type WebAdapterResult<T extends object = Record<never, never>> = WebAdapterSuccess<T> | WebAdapterFailure;

export function failure(code: WebAdapterFailureCode, reason: string): WebAdapterFailure {
  return { ok: false, code, reason };
}

const NET_ERROR = /net::ERR_[A-Z_]+/;

/**
 * Error description safe to record: the error name plus, at most, a Chromium
 * `net::ERR_*` code. Full messages are not copied because they can contain
 * URLs, selectors or page text supplied by the consumer.
 */
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) {
    return typeof error;
  }
  const netError = NET_ERROR.exec(error.message)?.[0];
  return netError === undefined ? error.name : `${error.name} (${netError})`;
}

export function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && error.name === 'TimeoutError';
}
