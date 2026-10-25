import * as Linking from 'expo-linking';
import {
  NO_RETINA_RUN,
  applyRetinaRunParam,
  retinaRunIdOrThrow,
  type RetinaRunState,
} from 'retina-example-shared';

// Test mode only. A Retina run opens the app with a deep link such as
// retina-example://profile?run=<id>. Native env vars are baked in at bundle
// time, so the run id has to arrive at runtime; it is kept in memory and the
// profile client sends it as the X-Retina-Run header.
// Fail-closed: a link with an invalid run clears the previous id and blocks
// requests until a link with a valid run arrives. A link without run keeps
// the current state (in-app links do not end a run).
let state: RetinaRunState = NO_RETINA_RUN;

export function captureRetinaRunFromUrl(url: string | null): void {
  if (process.env.EXPO_PUBLIC_RETINA_TEST_MODE !== '1' || !url) return;
  state = applyRetinaRunParam(state, Linking.parse(url).queryParams?.['run']);
}

/** Run id for the X-Retina-Run header. Throws RetinaRunBlockedError when blocked. */
export function readRetinaRunId(): string | undefined {
  return process.env.EXPO_PUBLIC_RETINA_TEST_MODE === '1' ? retinaRunIdOrThrow(state) : undefined;
}
