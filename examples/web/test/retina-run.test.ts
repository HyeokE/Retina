import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// vi.resetModules() reloads retina-example-shared, so match the error by
// message rather than by class identity.
const BLOCKED = /^Retina run is blocked/

type RetinaRunModule = typeof import('../src/infrastructure/retina-run.ts')

interface StorageFailures {
  readonly set?: boolean
  readonly remove?: boolean
}

function fakeSessionStorage(initial: Record<string, string> = {}, fail: StorageFailures = {}) {
  let data: Readonly<Record<string, string>> = { ...initial }
  return {
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      if (fail.set) throw new Error('QuotaExceededError')
      data = { ...data, [key]: value }
    },
    removeItem: (key: string) => {
      if (fail.remove) throw new Error('SecurityError')
      data = Object.fromEntries(Object.entries(data).filter(([k]) => k !== key))
    },
    snapshot: () => data,
  }
}

type FakeStorage = ReturnType<typeof fakeSessionStorage>

/** A browser tab: location + history + sessionStorage that outlive module reloads. */
function fakeTab(url: string, storage: FakeStorage) {
  let current = new URL(url, 'http://app.test')
  const location = {
    get pathname() {
      return current.pathname
    },
    get search() {
      return current.search
    },
  }
  const go = (_state: unknown, _unused: string, next?: string | URL | null) => {
    if (next != null) current = new URL(String(next), current)
  }
  const window = { location, history: { pushState: go, replaceState: go }, sessionStorage: storage }
  return { window, href: () => `${current.pathname}${current.search}` }
}

type FakeTab = ReturnType<typeof fakeTab>

/** Simulates a page load: a fresh module instance captures from the current URL. */
async function load(tab: FakeTab): Promise<RetinaRunModule> {
  vi.resetModules()
  vi.stubGlobal('window', tab.window)
  const module = await import('../src/infrastructure/retina-run.ts')
  module.captureRetinaRunFromLocation()
  return module
}

beforeEach(() => {
  vi.stubGlobal('__RETINA_TEST_MODE__', true)
  vi.spyOn(console, 'warn').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('web retina-run (test mode)', () => {
  it('uses the stored run when the URL has no retinaRun, and then keeps it in the URL', async () => {
    const tab = fakeTab('/', fakeSessionStorage({ retinaRun: 'run-A' }))
    const run = await load(tab)
    expect(run.readRetinaRunId()).toBe('run-A')
    run.pushAppPath('/edit')
    expect(tab.href()).toBe('/edit?retinaRun=run-A')
  })

  it('lets an explicit valid retinaRun win over the stored run', async () => {
    const storage = fakeSessionStorage({ retinaRun: 'run-A' })
    const run = await load(fakeTab('/?retinaRun=run-B', storage))
    expect(run.readRetinaRunId()).toBe('run-B')
    expect(storage.snapshot()['retinaRun']).toBe('run-B')
  })

  it('setItem fails: navigate keeps retinaRun=run-B and a reload still uses run-B, never run-A', async () => {
    const storage = fakeSessionStorage({ retinaRun: 'run-A' }, { set: true })
    const tab = fakeTab('/?retinaRun=run-B', storage)

    const first = await load(tab)
    expect(first.readRetinaRunId()).toBe('run-B')
    expect(storage.snapshot()['retinaRun']).toBeUndefined()

    first.pushAppPath('/edit')
    first.pushAppPath('/')
    expect(tab.href()).toBe('/?retinaRun=run-B')

    const reloaded = await load(tab)
    expect(reloaded.readRetinaRunId()).toBe('run-B')
  })

  it('setItem and removeItem both fail: the URL alone still gives run-B after navigation and reload', async () => {
    const storage = fakeSessionStorage({ retinaRun: 'run-A' }, { set: true, remove: true })
    const tab = fakeTab('/?retinaRun=run-B', storage)

    const first = await load(tab)
    first.pushAppPath('/edit')
    expect(storage.snapshot()['retinaRun']).toBe('run-A')

    const reloaded = await load(tab)
    expect(tab.href()).toBe('/edit?retinaRun=run-B')
    expect(reloaded.readRetinaRunId()).toBe('run-B')
  })

  it('keeps the param on replaceState for unknown paths', async () => {
    const tab = fakeTab('/unknown?retinaRun=run-B', fakeSessionStorage())
    const run = await load(tab)
    run.replaceAppPath('/')
    expect(tab.href()).toBe('/?retinaRun=run-B')
  })

  it('an explicit invalid id with stored run-A stays blocked after navigation and reload', async () => {
    const storage = fakeSessionStorage({ retinaRun: 'run-A' })
    const tab = fakeTab('/?retinaRun=bad%20id!', storage)

    const first = await load(tab)
    expect(() => first.readRetinaRunId()).toThrow(BLOCKED)
    expect(storage.snapshot()['retinaRun']).toBeUndefined()

    first.pushAppPath('/edit')
    expect(new URLSearchParams(tab.href().split('?')[1]).get('retinaRun')).toBe('bad id!')

    const reloaded = await load(tab)
    expect(() => reloaded.readRetinaRunId()).toThrow(BLOCKED)
  })

  it('an explicit invalid id stays blocked even when clearing the stored run-A fails', async () => {
    const storage = fakeSessionStorage({ retinaRun: 'run-A' }, { remove: true })
    const tab = fakeTab('/?retinaRun=bad%20id!', storage)
    const first = await load(tab)
    first.pushAppPath('/')
    const reloaded = await load(tab)
    expect(() => reloaded.readRetinaRunId()).toThrow(BLOCKED)
  })

  it('blocks on an empty explicit retinaRun', async () => {
    const run = await load(fakeTab('/?retinaRun=', fakeSessionStorage({ retinaRun: 'run-A' })))
    expect(() => run.readRetinaRunId()).toThrow(BLOCKED)
  })

  it('blocks when the stored run id is corrupt', async () => {
    const run = await load(fakeTab('/', fakeSessionStorage({ retinaRun: 'bad id!' })))
    expect(() => run.readRetinaRunId()).toThrow(BLOCKED)
  })

  it('sends no run id and adds no param when nothing was given', async () => {
    const tab = fakeTab('/', fakeSessionStorage())
    const run = await load(tab)
    expect(run.readRetinaRunId()).toBeUndefined()
    run.pushAppPath('/edit')
    expect(tab.href()).toBe('/edit')
  })
})

describe('web retina-run (production build)', () => {
  it('neither reads nor preserves retinaRun', async () => {
    vi.stubGlobal('__RETINA_TEST_MODE__', false)
    const storage = fakeSessionStorage({ retinaRun: 'run-A' })
    const tab = fakeTab('/?retinaRun=run-B', storage)
    const run = await load(tab)

    expect(run.readRetinaRunId()).toBeUndefined()
    run.pushAppPath('/edit')
    expect(tab.href()).toBe('/edit')
    run.replaceAppPath('/')
    expect(tab.href()).toBe('/')
    expect(storage.snapshot()).toEqual({ retinaRun: 'run-A' })
  })
})
