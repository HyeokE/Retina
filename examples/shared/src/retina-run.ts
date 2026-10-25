// Per-run isolation contract between a Retina run and the example API.
// The API honours this header only when it runs with TEST_MODE=1.
export const RETINA_RUN_HEADER = 'X-Retina-Run';

export const RETINA_RUN_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

export function isValidRetinaRunId(value: unknown): value is string {
  return typeof value === 'string' && RETINA_RUN_ID_PATTERN.test(value);
}

/**
 * Which run an app instance belongs to.
 * - none: no run id was given; requests use the API's default store.
 * - active: requests carry this run id.
 * - blocked: a run id was given but was invalid. Requests are refused so the
 *   run ends up inconclusive instead of silently writing to another run.
 */
export type RetinaRunState =
  | { readonly kind: 'none' }
  | { readonly kind: 'active'; readonly runId: string }
  | { readonly kind: 'blocked'; readonly reason: string };

export const NO_RETINA_RUN: RetinaRunState = Object.freeze({ kind: 'none' });

export class RetinaRunBlockedError extends Error {
  constructor(reason: string) {
    super(`Retina run is blocked: ${reason}. No API request was sent, so this run is inconclusive.`);
    this.name = 'RetinaRunBlockedError';
  }
}

/**
 * Applies a run parameter taken from a URL. An explicit parameter always wins
 * over the previous state: a valid id becomes active, anything else (empty,
 * malformed, repeated) blocks. `undefined`/`null` means "not given" and keeps
 * the previous state.
 */
export function applyRetinaRunParam(previous: RetinaRunState, param: unknown): RetinaRunState {
  if (param === undefined || param === null) return previous;
  if (isValidRetinaRunId(param)) return { kind: 'active', runId: param };
  return { kind: 'blocked', reason: 'the run id in the URL does not match ^[A-Za-z0-9._-]{1,64}$' };
}

/** Run id to send, or undefined for none. Throws RetinaRunBlockedError when blocked. */
export function retinaRunIdOrThrow(state: RetinaRunState): string | undefined {
  switch (state.kind) {
    case 'none':
      return undefined;
    case 'active':
      return state.runId;
    case 'blocked':
      throw new RetinaRunBlockedError(state.reason);
  }
}
