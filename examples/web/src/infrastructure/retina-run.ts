import {
  NO_RETINA_RUN,
  applyRetinaRunParam,
  isValidRetinaRunId,
  retinaRunIdOrThrow,
  type RetinaRunState,
} from 'retina-example-shared'

// Test mode only. A Retina run opens the app with ?retinaRun=<id>.
// Fail-closed rules:
// - the URL is the authoritative source: an explicit retinaRun always wins,
//   and every in-app navigation keeps the param (see pushAppPath), so a
//   reload after navigating still carries the same value, valid or not;
// - sessionStorage is only a fallback for a URL without the param. A valid id
//   is held in memory first and persisted best-effort; if persisting fails the
//   old stored value is removed so it cannot come back later;
// - an explicit but invalid id (or a corrupt stored one) blocks: the profile
//   client refuses to send requests, so the run is inconclusive instead of
//   silently writing to another run's data.
const QUERY_PARAM = 'retinaRun'
const STORAGE_KEY = 'retinaRun'

let state: RetinaRunState = NO_RETINA_RUN
/** Exact retinaRun value from the startup URL, kept on every navigation. */
let urlParam: string | undefined

function tryStorage(action: (storage: Storage) => void): boolean {
  try {
    action(window.sessionStorage)
    return true
  } catch {
    return false
  }
}

function readStoredState(): RetinaRunState {
  let stored: string | null = null
  try {
    stored = window.sessionStorage.getItem(STORAGE_KEY)
  } catch {
    return NO_RETINA_RUN
  }
  if (stored === null) return NO_RETINA_RUN
  return isValidRetinaRunId(stored)
    ? { kind: 'active', runId: stored }
    : { kind: 'blocked', reason: 'the stored run id is invalid' }
}

function persist(next: RetinaRunState): void {
  if (next.kind === 'active') {
    const runId = next.runId
    if (tryStorage((storage) => storage.setItem(STORAGE_KEY, runId))) return
    console.warn('[retina] could not store the run id; it is kept in memory and in the URL')
  }
  // Never leave a stale stored run that a later load could pick up.
  if (!tryStorage((storage) => storage.removeItem(STORAGE_KEY))) {
    console.warn('[retina] could not clear the stored run id; the URL still decides the run')
  }
}

export function captureRetinaRunFromLocation(): void {
  if (!__RETINA_TEST_MODE__) return
  const param = new URLSearchParams(window.location.search).get(QUERY_PARAM)
  if (param === null) {
    // No param in the URL: fall back to storage, and keep that id in the URL
    // from now on so later reloads do not depend on storage.
    state = readStoredState()
    if (state.kind === 'active') urlParam = state.runId
    return
  }
  urlParam = param
  state = applyRetinaRunParam(state, param)
  persist(state)
}

/** Run id for the X-Retina-Run header. Throws RetinaRunBlockedError when blocked. */
export function readRetinaRunId(): string | undefined {
  if (!__RETINA_TEST_MODE__) return undefined
  return retinaRunIdOrThrow(state)
}

/** App path plus the retinaRun query in test mode; the bare path otherwise. */
export function withRetinaRunParam(path: string): string {
  if (!__RETINA_TEST_MODE__ || urlParam === undefined) return path
  return `${path}?${new URLSearchParams({ [QUERY_PARAM]: urlParam }).toString()}`
}

export function pushAppPath(path: string): void {
  window.history.pushState(null, '', withRetinaRunParam(path))
}

export function replaceAppPath(path: string): void {
  window.history.replaceState(null, '', withRetinaRunParam(path))
}
