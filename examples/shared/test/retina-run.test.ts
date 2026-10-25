import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  NO_RETINA_RUN,
  RetinaRunBlockedError,
  applyRetinaRunParam,
  createProfileClient,
  retinaRunIdOrThrow,
} from '../src/index.ts';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('applyRetinaRunParam', () => {
  const active = applyRetinaRunParam(NO_RETINA_RUN, 'run-A');

  it('keeps the previous state when no param is given', () => {
    expect(applyRetinaRunParam(active, undefined)).toBe(active);
    expect(applyRetinaRunParam(active, null)).toBe(active);
  });

  it('lets an explicit valid param replace the previous run', () => {
    expect(applyRetinaRunParam(active, 'run-B')).toEqual({ kind: 'active', runId: 'run-B' });
  });

  it.each(['', 'bad id!', 'a'.repeat(65), ['run-B', 'run-C']])('blocks on an explicit invalid param %j', (param) => {
    const next = applyRetinaRunParam(active, param);
    expect(next.kind).toBe('blocked');
    expect(() => retinaRunIdOrThrow(next)).toThrow(RetinaRunBlockedError);
  });
});

describe('createProfileClient with a run id provider', () => {
  it('sends the run header', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ name: 'A', email: 'a@example.com', city: '' })));
    vi.stubGlobal('fetch', fetchMock);
    await createProfileClient('http://api.test', { runId: () => 'run-A' }).getProfile();
    expect(fetchMock).toHaveBeenCalledWith('http://api.test/profile', { headers: { 'X-Retina-Run': 'run-A' } });
  });

  it('sends no request at all when the provider is blocked', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const blocked = applyRetinaRunParam(NO_RETINA_RUN, 'bad id!');
    const client = createProfileClient('http://api.test', { runId: () => retinaRunIdOrThrow(blocked) });

    await expect(client.getProfile()).rejects.toBeInstanceOf(RetinaRunBlockedError);
    await expect(client.updateProfile({ name: 'A', email: 'a@example.com', city: '' })).rejects.toBeInstanceOf(
      RetinaRunBlockedError,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
