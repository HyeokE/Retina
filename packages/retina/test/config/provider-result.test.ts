import { describe, expect, it } from 'vitest';
import {
  PROVIDER_FAILURE_STATUS,
  PROVIDER_REASONS,
  providerBlockedCheck,
  providerOutcome,
  runProvider,
  type ProviderResult,
} from '../../src/index.ts';

describe('providerOutcome', () => {
  it('passes a successful result through without assigning a status', () => {
    const result: ProviderResult<{ buildId: string }> = { ok: true, buildId: 'b-1' };
    expect(providerOutcome('buildIdentity', result)).toEqual({
      ok: true,
      provider: 'buildIdentity',
      value: { ok: true, buildId: 'b-1' },
    });
  });

  it('maps a provider failure to INCONCLUSIVE, never PASS', () => {
    const outcome = providerOutcome('auth', { ok: false, reason: 'login rejected' });
    expect(outcome).toEqual({
      ok: false,
      provider: 'auth',
      status: 'INCONCLUSIVE',
      code: PROVIDER_REASONS.failed,
      detail: 'login rejected',
    });
    expect(PROVIDER_FAILURE_STATUS).toBe('INCONCLUSIVE');
  });

  it('maps a missing provider result to INCONCLUSIVE', () => {
    expect(providerOutcome('ready', undefined)).toEqual({
      ok: false,
      provider: 'ready',
      status: 'INCONCLUSIVE',
      code: PROVIDER_REASONS.missing,
    });
  });
});

describe('runProvider', () => {
  it('returns the success of a provider call', async () => {
    const outcome = await runProvider('navigator', async () => ({ ok: true }));
    expect(outcome).toEqual({ ok: true, provider: 'navigator', value: { ok: true } });
  });

  it('is INCONCLUSIVE when the provider is not configured', async () => {
    const outcome = await runProvider('fixture', undefined);
    expect(outcome).toMatchObject({ ok: false, status: 'INCONCLUSIVE', code: PROVIDER_REASONS.missing });
  });

  it('is INCONCLUSIVE when the provider reports a failure', async () => {
    const outcome = await runProvider('data', async () => ({ ok: false, reason: 'seed failed' }));
    expect(outcome).toMatchObject({ ok: false, status: 'INCONCLUSIVE', code: PROVIDER_REASONS.failed, detail: 'seed failed' });
  });

  it('is INCONCLUSIVE when the provider throws, without embedding the error message', async () => {
    const outcome = await runProvider('auth', async () => {
      throw new TypeError('token=sk-secret-value rejected');
    });
    expect(outcome).toMatchObject({ ok: false, status: 'INCONCLUSIVE', code: PROVIDER_REASONS.threw });
    expect(JSON.stringify(outcome)).not.toContain('sk-secret-value');
    expect(JSON.stringify(outcome)).toContain('TypeError');
  });

  it('is INCONCLUSIVE when the provider throws synchronously or returns a malformed result', async () => {
    const sync = await runProvider('env', () => {
      throw new Error('boom');
    });
    expect(sync).toMatchObject({ ok: false, status: 'INCONCLUSIVE', code: PROVIDER_REASONS.threw });

    const malformed = await runProvider('schema', async () => ({ status: 'fine' }) as unknown as ProviderResult);
    expect(malformed).toMatchObject({ ok: false, status: 'INCONCLUSIVE', code: PROVIDER_REASONS.invalidResult });

    const noReason = await runProvider('schema', async () => ({ ok: false }) as unknown as ProviderResult);
    expect(noReason).toMatchObject({ ok: false, status: 'INCONCLUSIVE', code: PROVIDER_REASONS.invalidResult });
  });
});

describe('providerBlockedCheck', () => {
  it('turns a blocked provider into an INCONCLUSIVE check with provider-named reasons', () => {
    const outcome = providerOutcome('ready', { ok: false, reason: 'ready marker never appeared' });
    if (outcome.ok) {
      throw new Error('expected a blocked outcome');
    }
    expect(providerBlockedCheck('appearance', outcome)).toEqual({
      kind: 'appearance',
      status: 'INCONCLUSIVE',
      reasons: ['provider_failed:ready', 'ready marker never appeared'],
    });
  });

  it('omits the detail when there is none', () => {
    const outcome = providerOutcome('locators', undefined);
    if (outcome.ok) {
      throw new Error('expected a blocked outcome');
    }
    expect(providerBlockedCheck('layout', outcome)).toEqual({
      kind: 'layout',
      status: 'INCONCLUSIVE',
      reasons: ['provider_missing:locators'],
    });
  });
});
