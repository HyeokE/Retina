// Contract shared by the example API and both example apps, so the server and
// the UI validate a profile with exactly the same rules and messages.
// This entry is framework-free; React hooks live in "retina-example-shared/react".
export type { Profile, ProfileField, ProfileFieldErrors, ProfileValidationResult } from './profile.ts';
export { SEED_PROFILE, PROFILE_LIMITS, validateProfile, hasFieldErrors } from './profile.ts';
export type { ProfileClient, ProfileClientOptions, UpdateProfileResult } from './profile-client.ts';
export { createProfileClient, ProfileApiError } from './profile-client.ts';
export { RETINA_RUN_HEADER, RETINA_RUN_ID_PATTERN, isValidRetinaRunId } from './retina-run.ts';
