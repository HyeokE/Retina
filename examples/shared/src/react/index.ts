// React hooks for the example apps. The API never imports this entry, so it
// never needs React. The profile client is injected by each app.
export type { ProfileState } from './useProfile.ts';
export { useProfile } from './useProfile.ts';
export type { EditProfileForm } from './useEditProfileForm.ts';
export { useEditProfileForm } from './useEditProfileForm.ts';
