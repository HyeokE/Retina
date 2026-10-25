import { useCallback, useEffect, useState } from 'react';
import type { Profile } from '../profile.ts';
import type { ProfileClient } from '../profile-client.ts';

export type ProfileState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly profile: Profile }
  | { readonly status: 'error'; readonly message: string };

// Fetches the profile every time the calling screen mounts, so returning to
// Profile after a save always shows what the API has stored.
export function useProfile(client: ProfileClient): { state: ProfileState; reload: () => void } {
  const [state, setState] = useState<ProfileState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setState({ status: 'loading' });
    client
      .getProfile(controller.signal)
      .then((profile) => setState({ status: 'ready', profile }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const message = error instanceof Error ? error.message : 'Loading the profile failed.';
        setState({ status: 'error', message });
      });
    return () => controller.abort();
  }, [client, attempt]);

  const reload = useCallback(() => setAttempt((count) => count + 1), []);

  return { state, reload };
}
