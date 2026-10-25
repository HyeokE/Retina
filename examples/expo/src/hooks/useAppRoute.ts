import * as Linking from 'expo-linking';
import { useCallback, useEffect, useState } from 'react';
import { BackHandler } from 'react-native';
import { captureRetinaRunFromUrl } from '../infrastructure/retina-run';

export type Route = 'profile' | 'edit';

export interface Navigation {
  readonly route: Route;
  /** Changes on every navigation so a screen remounts (and re-fetches) on re-entry. */
  readonly entryKey: number;
  navigate: (to: Route) => void;
}

const ROUTES: ReadonlySet<string> = new Set<Route>(['profile', 'edit']);

/**
 * Deep links (scheme "retina-example"):
 *   retina-example://profile   retina-example://edit
 *   retina-example:///edit     exp://<host>:8081/--/edit (Expo Go)
 * The last path segment picks the screen; anything else opens Profile.
 * Test builds also accept ?run=<id> (see infrastructure/retina-run.ts).
 */
export function routeFromUrl(url: string | null): Route | undefined {
  if (!url) return undefined;
  const { hostname, path } = Linking.parse(url);
  const segments = [hostname ?? '', ...(path ?? '').split('/')].filter(
    (segment) => segment.length > 0 && segment !== '--',
  );
  const last = segments[segments.length - 1];
  return last !== undefined && ROUTES.has(last) ? (last as Route) : undefined;
}

export function useAppRoute(): Navigation {
  const [state, setState] = useState<{ route: Route; entryKey: number }>(() => {
    const initialUrl = Linking.getLinkingURL();
    // Capture the run id before the first screen mounts and fetches.
    captureRetinaRunFromUrl(initialUrl);
    return { route: routeFromUrl(initialUrl) ?? 'profile', entryKey: 0 };
  });

  const navigate = useCallback((to: Route) => {
    setState((previous) => ({ route: to, entryKey: previous.entryKey + 1 }));
  }, []);

  // Every opened URL counts, even when it repeats the current one.
  useEffect(() => {
    const subscription = Linking.addEventListener('url', ({ url }) => {
      captureRetinaRunFromUrl(url);
      const route = routeFromUrl(url);
      if (route) navigate(route);
    });
    return () => subscription.remove();
  }, [navigate]);

  // Android hardware back leaves Edit for Profile instead of closing the app.
  useEffect(() => {
    if (state.route !== 'edit') return undefined;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      navigate('profile');
      return true;
    });
    return () => subscription.remove();
  }, [state.route, navigate]);

  return { route: state.route, entryKey: state.entryKey, navigate };
}
