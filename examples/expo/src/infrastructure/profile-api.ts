import { createProfileClient } from 'retina-example-shared';
import { config } from '../config';
import { readRetinaRunId } from './retina-run';

export const profileApi = createProfileClient(
  config.apiBaseUrl,
  process.env.EXPO_PUBLIC_RETINA_TEST_MODE === '1' ? { runId: readRetinaRunId } : {},
);
