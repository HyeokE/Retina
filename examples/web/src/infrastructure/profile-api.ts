import { createProfileClient } from 'retina-example-shared'
import { config } from '../config.ts'
import { captureRetinaRunFromLocation, readRetinaRunId } from './retina-run.ts'

if (__RETINA_TEST_MODE__) captureRetinaRunFromLocation()

export const profileApi = createProfileClient(
  config.apiBaseUrl,
  __RETINA_TEST_MODE__ ? { runId: readRetinaRunId } : {},
)
