import * as Linking from 'expo-linking';
import { isValidRetinaRunId } from 'retina-example-shared';

// Test mode only. A Retina run opens the app with a deep link such as
// retina-example://profile?run=<id>. Native env vars are baked in at bundle
// time, so the run id has to arrive at runtime; it is kept in memory and the
// profile client sends it as the X-Retina-Run header.
let currentRunId: string | undefined;

export function captureRetinaRunFromUrl(url: string | null): void {
  if (process.env.EXPO_PUBLIC_RETINA_TEST_MODE !== '1' || !url) return;
  const run = Linking.parse(url).queryParams?.['run'];
  if (run === undefined) return;
  if (isValidRetinaRunId(run)) {
    currentRunId = run;
  } else {
    console.warn('[retina] ignoring invalid run query parameter');
  }
}

export function readRetinaRunId(): string | undefined {
  return process.env.EXPO_PUBLIC_RETINA_TEST_MODE === '1' ? currentRunId : undefined;
}
