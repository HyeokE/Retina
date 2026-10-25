import { SEED_PROFILE, type Profile } from 'retina-example-shared';
import { createInMemoryProfileStore, type ProfileStore } from './profile-store.ts';

export const DEFAULT_MAX_RUN_STORES = 50;
export const DEFAULT_RUN_IDLE_TTL_MS = 30 * 60 * 1000;

/** Thrown when a new run id cannot get a store without disturbing an active run. */
export class RunCapacityError extends Error {
  readonly maxRuns: number;

  constructor(maxRuns: number) {
    super(`All ${maxRuns} run stores are in use by active runs.`);
    this.name = 'RunCapacityError';
    this.maxRuns = maxRuns;
  }
}

export interface RunStoreRegistry {
  /**
   * The store for a run id, created from the seed on first use. No id means
   * the default store. Throws RunCapacityError when a new run cannot be admitted.
   */
  forRun(runId: string | undefined): ProfileStore;
  /** Releases a run's store. Returns false when the run was not held. */
  end(runId: string): boolean;
  /** Number of per-run stores currently held (the default store is not counted). */
  size(): number;
}

export interface RegistryOptions {
  readonly seed?: Profile;
  readonly maxRuns?: number;
  /** A run unused for this long may be reclaimed to admit a new run. */
  readonly idleTtlMs?: number;
  /** Milliseconds clock; injectable for tests. */
  readonly now?: () => number;
}

interface RunEntry {
  readonly store: ProfileStore;
  readonly lastUsedAt: number;
}

// Concurrent web/iOS/Android runs each get their own store, so one run's save
// or reset never leaks into another. A run used within the idle TTL is never
// evicted: when the registry is full, idle runs are reclaimed first, and if
// none is idle the NEW run is rejected rather than resetting an active one.
// The map is replaced on every change, never mutated.
export function createRunStoreRegistry({
  seed = SEED_PROFILE,
  maxRuns = DEFAULT_MAX_RUN_STORES,
  idleTtlMs = DEFAULT_RUN_IDLE_TTL_MS,
  now = Date.now,
}: RegistryOptions = {}): RunStoreRegistry {
  const defaultStore = createInMemoryProfileStore(seed);
  let runs: ReadonlyMap<string, RunEntry> = new Map();

  const withEntry = (runId: string, entry: RunEntry): ReadonlyMap<string, RunEntry> =>
    new Map([...runs, [runId, entry]]);

  const withoutIdle = (at: number): ReadonlyMap<string, RunEntry> =>
    new Map([...runs].filter(([, entry]) => at - entry.lastUsedAt < idleTtlMs));

  return {
    forRun(runId) {
      if (runId === undefined) return defaultStore;
      const at = now();
      const existing = runs.get(runId);
      if (existing) {
        runs = withEntry(runId, { ...existing, lastUsedAt: at });
        return existing.store;
      }

      if (runs.size >= maxRuns) runs = withoutIdle(at);
      if (runs.size >= maxRuns) throw new RunCapacityError(maxRuns);

      const store = createInMemoryProfileStore(seed);
      runs = withEntry(runId, { store, lastUsedAt: at });
      return store;
    },
    end(runId) {
      if (!runs.has(runId)) return false;
      runs = new Map([...runs].filter(([id]) => id !== runId));
      return true;
    },
    size: () => runs.size,
  };
}
