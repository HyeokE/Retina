import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// vi.resetModules() reloads retina-example-shared, so match the error by
// message rather than by class identity.
const BLOCKED = /^Retina run is blocked/;

// expo-linking pulls in React Native, which cannot load in Node. Only its URL
// parser is used here, so a minimal stand-in keeps the test on the real
// capture logic.
vi.mock('expo-linking', () => ({
  parse: (url: string) => {
    const parsed = new URL(url);
    const params = [...parsed.searchParams.keys()];
    const queryParams = Object.fromEntries(
      params.map((key) => {
        const values = parsed.searchParams.getAll(key);
        return [key, values.length > 1 ? values : values[0]];
      }),
    );
    return { hostname: parsed.hostname, path: parsed.pathname, queryParams };
  },
}));

type RetinaRunModule = typeof import('../src/infrastructure/retina-run');

async function load(): Promise<RetinaRunModule> {
  return import('../src/infrastructure/retina-run');
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('EXPO_PUBLIC_RETINA_TEST_MODE', '1');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('expo retina-run (test mode)', () => {
  it('captures a valid run id from the deep link', async () => {
    const run = await load();
    run.captureRetinaRunFromUrl('retina-example://profile?run=ios-1');
    expect(run.readRetinaRunId()).toBe('ios-1');
  });

  it('keeps the current run for a link without a run param', async () => {
    const run = await load();
    run.captureRetinaRunFromUrl('retina-example://profile?run=ios-1');
    run.captureRetinaRunFromUrl('retina-example://edit');
    expect(run.readRetinaRunId()).toBe('ios-1');
  });

  it('clears the previous id and blocks on an invalid run param', async () => {
    const run = await load();
    run.captureRetinaRunFromUrl('retina-example://profile?run=ios-1');
    run.captureRetinaRunFromUrl('retina-example://profile?run=bad%20id!');
    expect(() => run.readRetinaRunId()).toThrow(BLOCKED);
  });

  it('blocks on an empty or repeated run param', async () => {
    const run = await load();
    run.captureRetinaRunFromUrl('retina-example://profile?run=');
    expect(() => run.readRetinaRunId()).toThrow(BLOCKED);
    run.captureRetinaRunFromUrl('retina-example://profile?run=a&run=b');
    expect(() => run.readRetinaRunId()).toThrow(BLOCKED);
  });

  it('an app restart without a run param means no run id, not a cached one', async () => {
    const first = await load();
    first.captureRetinaRunFromUrl('retina-example://profile?run=ios-1');
    expect(first.readRetinaRunId()).toBe('ios-1');

    vi.resetModules();
    const restarted = await load();
    restarted.captureRetinaRunFromUrl('retina-example://profile');
    expect(restarted.readRetinaRunId()).toBeUndefined();
  });

  it('an app restart after a blocked link starts unblocked with no run id', async () => {
    const first = await load();
    first.captureRetinaRunFromUrl('retina-example://profile?run=bad%20id!');
    expect(() => first.readRetinaRunId()).toThrow(BLOCKED);

    vi.resetModules();
    const restarted = await load();
    restarted.captureRetinaRunFromUrl(null);
    expect(restarted.readRetinaRunId()).toBeUndefined();
  });

  it('recovers when a later link carries a valid run', async () => {
    const run = await load();
    run.captureRetinaRunFromUrl('retina-example://profile?run=bad%20id!');
    run.captureRetinaRunFromUrl('retina-example://profile?run=ios-2');
    expect(run.readRetinaRunId()).toBe('ios-2');
  });
});

describe('expo retina-run (production build)', () => {
  it('ignores the run param entirely', async () => {
    vi.stubEnv('EXPO_PUBLIC_RETINA_TEST_MODE', '0');
    const run = await load();
    run.captureRetinaRunFromUrl('retina-example://profile?run=bad%20id!');
    expect(run.readRetinaRunId()).toBeUndefined();
  });
});
