export interface Profile {
  readonly name: string;
  readonly email: string;
  readonly city: string;
}

export type ProfileField = keyof Profile;

export type ProfileFieldErrors = Partial<Record<ProfileField, string>>;

export type ProfileValidationResult =
  | { readonly ok: true; readonly profile: Profile }
  | { readonly ok: false; readonly fieldErrors: ProfileFieldErrors };

// Neutral synthetic seed data. Never put real people or company data here.
export const SEED_PROFILE: Profile = Object.freeze({
  name: 'Alex Kim',
  email: 'alex@example.com',
  city: 'Springfield',
});

export const PROFILE_LIMITS = Object.freeze({
  nameMaxLength: 80,
  emailMaxLength: 254,
  cityMaxLength: 80,
});

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function validateName(name: string): string | undefined {
  if (name.length === 0) return 'Name is required.';
  if (name.length > PROFILE_LIMITS.nameMaxLength) {
    return `Name must be ${PROFILE_LIMITS.nameMaxLength} characters or fewer.`;
  }
  return undefined;
}

function validateEmail(email: string): string | undefined {
  if (email.length > PROFILE_LIMITS.emailMaxLength || !EMAIL_PATTERN.test(email)) {
    return 'Enter a valid email address.';
  }
  return undefined;
}

function validateCity(city: string): string | undefined {
  if (city.length > PROFILE_LIMITS.cityMaxLength) {
    return `City must be ${PROFILE_LIMITS.cityMaxLength} characters or fewer.`;
  }
  return undefined;
}

function withError(
  errors: ProfileFieldErrors,
  field: ProfileField,
  message: string | undefined,
): ProfileFieldErrors {
  return message === undefined ? errors : { ...errors, [field]: message };
}

export function hasFieldErrors(errors: ProfileFieldErrors): boolean {
  return Object.keys(errors).length > 0;
}

/**
 * Validates untrusted input (a form state or a JSON request body).
 * Rules: name is required, email must look valid, city is optional.
 * Values are trimmed before validation and in the returned profile.
 */
export function validateProfile(input: unknown): ProfileValidationResult {
  const source = typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  const profile: Profile = {
    name: asTrimmedString(source['name']),
    email: asTrimmedString(source['email']),
    city: asTrimmedString(source['city']),
  };

  let fieldErrors: ProfileFieldErrors = {};
  fieldErrors = withError(fieldErrors, 'name', validateName(profile.name));
  fieldErrors = withError(fieldErrors, 'email', validateEmail(profile.email));
  fieldErrors = withError(fieldErrors, 'city', validateCity(profile.city));

  return hasFieldErrors(fieldErrors) ? { ok: false, fieldErrors } : { ok: true, profile };
}
