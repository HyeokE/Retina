// Per-run isolation contract between a Retina run and the example API.
// The API honours this header only when it runs with TEST_MODE=1.
export const RETINA_RUN_HEADER = 'X-Retina-Run';

export const RETINA_RUN_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

export function isValidRetinaRunId(value: unknown): value is string {
  return typeof value === 'string' && RETINA_RUN_ID_PATTERN.test(value);
}
