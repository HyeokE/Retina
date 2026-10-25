import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  aggregateRun,
  exitCodeFor,
  PROVIDER_FAILURE_STATUS,
  PROVIDER_REASONS,
  providerBlockedCheck,
  providerBlockedError,
  providerOutcome,
  runProvider,
  type ProviderBlocked,
  type ProviderResult,
} from '../../src/index.ts';
import { caseResult, check } from '../helpers/fixtures.ts';

function blockedOf(outcome: ReturnType<typeof providerOutcome>): ProviderBlocked {
  if (outcome.ok) {
    throw new Error('expected a blocked outcome');
  }
  return outcome;
}

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

const LIMIT = { timeoutMs: 1_000 } as const;

describe('runProvider', () => {
  it('returns the success of a provider call', async () => {
    const outcome = await runProvider('navigator', async () => ({ ok: true }), LIMIT);
    expect(outcome).toEqual({ ok: true, provider: 'navigator', value: { ok: true } });
  });

  it('is INCONCLUSIVE when the provider is not configured', async () => {
    const outcome = await runProvider('fixture', undefined, LIMIT);
    expect(outcome).toMatchObject({ ok: false, status: 'INCONCLUSIVE', code: PROVIDER_REASONS.missing });
  });

  it('is INCONCLUSIVE when the provider reports a failure', async () => {
    const outcome = await runProvider('data', async () => ({ ok: false, reason: 'seed failed' }), LIMIT);
    expect(outcome).toMatchObject({ ok: false, status: 'INCONCLUSIVE', code: PROVIDER_REASONS.failed, detail: 'seed failed' });
  });

  it('is INCONCLUSIVE when the provider throws, without embedding the error message', async () => {
    const outcome = await runProvider(
      'auth',
      async () => {
        throw new TypeError('token=sk-secret-value rejected');
      },
      LIMIT,
    );
    expect(outcome).toMatchObject({ ok: false, status: 'INCONCLUSIVE', code: PROVIDER_REASONS.threw });
    expect(JSON.stringify(outcome)).not.toContain('sk-secret-value');
    expect(JSON.stringify(outcome)).toContain('TypeError');
  });

  it('is INCONCLUSIVE when the provider throws synchronously or returns a malformed result', async () => {
    const sync = await runProvider(
      'env',
      () => {
        throw new Error('boom');
      },
      LIMIT,
    );
    expect(sync).toMatchObject({ ok: false, status: 'INCONCLUSIVE', code: PROVIDER_REASONS.threw });

    const malformed = await runProvider('schema', async () => ({ status: 'fine' }) as unknown as ProviderResult, LIMIT);
    expect(malformed).toMatchObject({ ok: false, status: 'INCONCLUSIVE', code: PROVIDER_REASONS.invalidResult });

    const noReason = await runProvider('schema', async () => ({ ok: false }) as unknown as ProviderResult, LIMIT);
    expect(noReason).toMatchObject({ ok: false, status: 'INCONCLUSIVE', code: PROVIDER_REASONS.invalidResult });
  });
});

describe('runProvider: deadline and cancellation', () => {
  beforeEach(() => {
    // setImmediate stays real so a test can let Node report unhandled rejections.
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('times out a provider that never settles, aborts its signal and does not hang', async () => {
    const signals: AbortSignal[] = [];
    const pending = runProvider(
      'ready',
      (signal) => {
        signals.push(signal);
        return new Promise<ProviderResult>(() => {});
      },
      { timeoutMs: 30_000 },
    );
    await vi.advanceTimersByTimeAsync(29_999);
    expect(signals[0]?.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const outcome = await pending;
    expect(outcome).toMatchObject({ ok: false, status: 'INCONCLUSIVE', provider: 'ready', code: 'provider_timeout' });
    expect(signals[0]?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears its timer when the provider succeeds and leaves the signal unaborted', async () => {
    const signals: AbortSignal[] = [];
    const outcome = await runProvider(
      'auth',
      async (signal) => {
        signals.push(signal);
        return { ok: true };
      },
      { timeoutMs: 60_000 },
    );
    expect(outcome.ok).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    expect(signals[0]?.aborted).toBe(false);
  });

  it('clears its timer when the provider fails or throws', async () => {
    await runProvider('auth', async () => ({ ok: false, reason: 'no' }), { timeoutMs: 60_000 });
    await runProvider(
      'auth',
      async () => {
        throw new Error('x');
      },
      { timeoutMs: 60_000 },
    );
    expect(vi.getTimerCount()).toBe(0);
  });

  it('ignores a late rejection after the timeout without an unhandled rejection', async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown): void => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);
    try {
      const pending = runProvider(
        'fixture',
        () =>
          new Promise<ProviderResult>((_resolve, reject) => {
            setTimeout(() => reject(new Error('late failure')), 5_000);
          }),
        { timeoutMs: 1_000 },
      );
      await vi.advanceTimersByTimeAsync(1_000);
      expect(await pending).toMatchObject({ code: 'provider_timeout' });
      await vi.advanceTimersByTimeAsync(5_000);
      await new Promise((resolve) => setImmediate(resolve));
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  it('uses the context deadline (epoch ms) and the earlier of deadline and timeoutMs', async () => {
    const byDeadline = runProvider('data', () => new Promise<ProviderResult>(() => {}), { deadline: Date.now() + 500 });
    await vi.advanceTimersByTimeAsync(500);
    expect(await byDeadline).toMatchObject({ code: 'provider_timeout' });

    const earlier = runProvider('data', () => new Promise<ProviderResult>(() => {}), {
      deadline: Date.now() + 10_000,
      timeoutMs: 200,
    });
    await vi.advanceTimersByTimeAsync(200);
    expect(await earlier).toMatchObject({ code: 'provider_timeout' });
  });

  it('does not call the provider when the deadline has already passed', async () => {
    let called = false;
    const outcome = await runProvider(
      'navigator',
      async () => {
        called = true;
        return { ok: true };
      },
      { deadline: Date.now() - 1 },
    );
    expect(called).toBe(false);
    expect(outcome).toMatchObject({ ok: false, code: 'provider_timeout' });
    expect(vi.getTimerCount()).toBe(0);
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

describe('providerBlockedError', () => {
  it('maps a blocked provider to a provider_error carrying the provider and reason code only', () => {
    const error = providerBlockedError(blockedOf(providerOutcome('auth', { ok: false, reason: 'password=hunter2 rejected' })), {
      platform: 'ios',
      caseId: 'a/ios',
    });
    expect(error).toEqual({
      kind: 'execution_error',
      code: 'provider_error',
      message: expect.any(String),
      platform: 'ios',
      caseId: 'a/ios',
      provider: 'auth',
      reason: 'provider_failed',
    });
    expect(JSON.stringify(error)).not.toContain('hunter2');
  });

  it('maps a timed-out provider to provider_timeout', () => {
    const timedOut: ProviderBlocked = {
      ok: false,
      provider: 'ready',
      status: 'INCONCLUSIVE',
      code: PROVIDER_REASONS.timeout,
      detail: 'provider exceeded 30000 ms',
    };
    expect(providerBlockedError(timedOut)).toMatchObject({ code: 'provider_timeout', provider: 'ready', reason: 'provider_timeout' });
    expect(providerBlockedError(timedOut)).not.toHaveProperty('platform');
  });

  it('keeps a FAIL and a provider execution error side by side: status FAIL, exit 2', () => {
    const blocked = blockedOf(providerOutcome('auth', { ok: false, reason: 'login rejected' }));
    const run = aggregateRun({
      mode: 'validate',
      declaredPlatforms: ['web', 'ios'],
      projectPlatforms: ['web', 'ios'],
      requiredCases: [
        { caseId: 'a/web', platform: 'web', expectedChecks: ['functional'] },
        { caseId: 'a/ios', platform: 'ios', expectedChecks: ['functional'] },
      ],
      results: [
        caseResult('a/web', 'web', [check('functional', 'FAIL', { reasons: ['saved value not shown'] })]),
        caseResult('a/ios', 'ios', [providerBlockedCheck('functional', blocked)]),
      ],
      executionErrors: [providerBlockedError(blocked, { platform: 'ios', caseId: 'a/ios' })],
    });
    expect(run.status).toBe('FAIL');
    expect(exitCodeFor(run)).toBe(2);
    expect(run.cases.find((c) => c.caseId === 'a/web')?.reasons).toEqual(['saved value not shown']);
    expect(run.cases.find((c) => c.caseId === 'a/ios')).toMatchObject({ status: 'INCONCLUSIVE', reasons: ['provider_failed:auth', 'login rejected'] });
    expect(run.executionErrors).toEqual([expect.objectContaining({ code: 'provider_error', provider: 'auth', caseId: 'a/ios' })]);
    expect(run.gateEligible).toBe(false);
  });
});
