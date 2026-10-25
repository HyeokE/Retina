import { useCallback, useState } from 'react';
import { validateProfile, type Profile, type ProfileField, type ProfileFieldErrors } from '../profile.ts';
import type { ProfileClient } from '../profile-client.ts';

export interface EditProfileForm {
  readonly values: Profile;
  readonly fieldErrors: ProfileFieldErrors;
  readonly submitError: string | undefined;
  readonly saving: boolean;
  setField: (field: ProfileField, value: string) => void;
  /** Resolves to true only when the API stored the profile. */
  submit: () => Promise<boolean>;
}

export function useEditProfileForm(client: ProfileClient, initial: Profile): EditProfileForm {
  const [values, setValues] = useState<Profile>(initial);
  const [fieldErrors, setFieldErrors] = useState<ProfileFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const setField = useCallback((field: ProfileField, value: string) => {
    setValues((previous) => ({ ...previous, [field]: value }));
  }, []);

  const submit = useCallback(async () => {
    setSubmitError(undefined);
    const validation = validateProfile(values);
    if (!validation.ok) {
      setFieldErrors(validation.fieldErrors);
      return false;
    }

    setFieldErrors({});
    setSaving(true);
    try {
      const result = await client.updateProfile(validation.profile);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        return false;
      }
      return true;
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Saving the profile failed.');
      return false;
    } finally {
      setSaving(false);
    }
  }, [client, values]);

  return { values, fieldErrors, submitError, saving, setField, submit };
}
