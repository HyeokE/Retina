import { SEED_PROFILE, type Profile } from 'retina-example-shared';

export interface ProfileStore {
  read(): Profile;
  write(profile: Profile): Profile;
  reset(): Profile;
}

// In-memory store. State lives only for the lifetime of the process, which is
// what a visual-verification run wants: every run can reset to the same seed.
export function createInMemoryProfileStore(seed: Profile = SEED_PROFILE): ProfileStore {
  let current: Profile = seed;
  return {
    read: () => current,
    write: (profile) => {
      current = { ...profile };
      return current;
    },
    reset: () => {
      current = seed;
      return current;
    },
  };
}
