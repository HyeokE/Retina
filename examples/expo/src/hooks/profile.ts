import type { Profile } from 'retina-example-shared';
import {
  useEditProfileForm as useSharedEditProfileForm,
  useProfile as useSharedProfile,
} from 'retina-example-shared/react';
import { profileApi } from '../infrastructure/profile-api';

// App-level hooks: bind the shared hooks to this app's profile client so
// screens never reach into the infrastructure layer.
export function useProfile() {
  return useSharedProfile(profileApi);
}

export function useEditProfileForm(initial: Profile) {
  return useSharedEditProfileForm(profileApi, initial);
}
