import type { Profile, ProfileFieldErrors } from './profile.ts';
import { RETINA_RUN_HEADER } from './retina-run.ts';

export type UpdateProfileResult =
  | { readonly ok: true; readonly profile: Profile }
  | { readonly ok: false; readonly fieldErrors: ProfileFieldErrors };

export interface ProfileClient {
  getProfile(signal?: AbortSignal): Promise<Profile>;
  updateProfile(profile: Profile): Promise<UpdateProfileResult>;
}

export interface ProfileClientOptions {
  /**
   * Returns the current Retina run id, if any. It is read on every request
   * because a run id is injected at runtime, not at build time.
   */
  readonly runId?: () => string | undefined;
}

export class ProfileApiError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ProfileApiError';
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseProfile(value: unknown): Profile {
  if (
    isRecord(value) &&
    typeof value['name'] === 'string' &&
    typeof value['email'] === 'string' &&
    typeof value['city'] === 'string'
  ) {
    return { name: value['name'], email: value['email'], city: value['city'] };
  }
  throw new ProfileApiError('The API returned an unexpected profile shape.');
}

function parseFieldErrors(value: unknown): ProfileFieldErrors {
  if (!isRecord(value) || !isRecord(value['fieldErrors'])) return {};
  const raw = value['fieldErrors'];
  return Object.fromEntries(
    (['name', 'email', 'city'] as const)
      .filter((field) => typeof raw[field] === 'string')
      .map((field) => [field, raw[field] as string]),
  );
}

async function requestJson(url: string, init: RequestInit): Promise<{ status: number; body: unknown }> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') throw error;
    throw new ProfileApiError(`Could not reach the profile API at ${url}.`);
  }
  const body: unknown = await response.json().catch(() => undefined);
  return { status: response.status, body };
}

function runHeaders(options: ProfileClientOptions): Record<string, string> {
  const runId = options.runId?.();
  return runId ? { [RETINA_RUN_HEADER]: runId } : {};
}

export function createProfileClient(baseUrl: string, options: ProfileClientOptions = {}): ProfileClient {
  const profileUrl = `${baseUrl.replace(/\/+$/, '')}/profile`;

  return {
    async getProfile(signal) {
      const init: RequestInit = { headers: runHeaders(options) };
      const { status, body } = await requestJson(profileUrl, signal ? { ...init, signal } : init);
      if (status !== 200) throw new ProfileApiError(`Loading the profile failed (HTTP ${status}).`, status);
      return parseProfile(body);
    },

    async updateProfile(profile) {
      const { status, body } = await requestJson(profileUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...runHeaders(options) },
        body: JSON.stringify(profile),
      });
      if (status === 200) return { ok: true, profile: parseProfile(body) };
      if (status === 400) {
        const fieldErrors = parseFieldErrors(body);
        if (Object.keys(fieldErrors).length > 0) return { ok: false, fieldErrors };
      }
      throw new ProfileApiError(`Saving the profile failed (HTTP ${status}).`, status);
    },
  };
}
