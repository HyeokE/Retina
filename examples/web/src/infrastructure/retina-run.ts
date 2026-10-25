import { isValidRetinaRunId } from 'retina-example-shared'

// Test mode only. A Retina run opens the app with ?retinaRun=<id>; the id is
// kept in sessionStorage so it survives in-app navigation and reloads within
// the tab, and the profile client sends it as the X-Retina-Run header.
const QUERY_PARAM = 'retinaRun'
const STORAGE_KEY = 'retinaRun'

function readStorage(): string | undefined {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) ?? undefined
  } catch {
    return undefined
  }
}

export function captureRetinaRunFromLocation(): void {
  if (!__RETINA_TEST_MODE__) return
  const fromQuery = new URLSearchParams(window.location.search).get(QUERY_PARAM)
  if (fromQuery === null) return
  if (!isValidRetinaRunId(fromQuery)) {
    console.warn(`[retina] ignoring invalid ${QUERY_PARAM} value`)
    return
  }
  try {
    window.sessionStorage.setItem(STORAGE_KEY, fromQuery)
  } catch {
    console.warn('[retina] sessionStorage is unavailable; the run id is not kept')
  }
}

export function readRetinaRunId(): string | undefined {
  if (!__RETINA_TEST_MODE__) return undefined
  const stored = readStorage()
  return isValidRetinaRunId(stored) ? stored : undefined
}
