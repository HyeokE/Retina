import { SEED_PROFILE, type Profile } from 'retina-example-shared';
import { createInMemoryProfileStore, type ProfileStore } from './profile-store.ts';

export const DEFAULT_MAX_RUN_STORES = 50;

export interface RunStoreRegistry {
  /** The store for a run id, created from the seed on first use. No id means the default store. */
  forRun(runId: string | undefined): ProfileStore;
  /** Number of per-run stores currently held (the default store is not counted). */
  size(): number;
}

interface RegistryOptions {
  readonly seed?: Profile;
  readonly maxRuns?: number;
}

// Concurrent web/iOS/Android runs each get their own store, so one run's save
// or reset never leaks into another. The map is replaced, never mutated:
// re-inserting a run moves it to the most-recent end, and only the newest
// `maxRuns` entries are kept (least recently used runs are evicted).
export function createRunStoreRegistry({
  seed = SEED_PROFILE,
  maxRuns = DEFAULT_MAX_RUN_STORES,
}: RegistryOptions = {}): RunStoreRegistry {
  const defaultStore = createInMemoryProfileStore(seed);
  let runs: ReadonlyMap<string, ProfileStore> = new Map();

  return {
    forRun(runId) {
      if (runId === undefined) return defaultStore;
      const store = runs.get(runId) ?? createInMemoryProfileStore(seed);
      const others = [...runs].filter(([id]) => id !== runId);
      runs = new Map([...others, [runId, store] as const].slice(-maxRuns));
      return store;
    },
    size: () => runs.size,
  };
}
