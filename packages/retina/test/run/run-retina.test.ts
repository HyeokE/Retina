import { describe, expect, it } from 'vitest';
import { runRetina, type RunPorts, type RunRequest, type RunResultFile } from '../../src/domain/run/run-retina.ts';
import type { RunPlan } from '../../src/domain/run/plan.ts';
import { RETINA_META_VERSION, type RunnerReport, type TestOutcome } from '../../src/domain/run/test-outcome.ts';
import type { CaseResult, CheckResult } from '../../src/index.ts';

const SECRET = 'very-secret-token-value';

function webConfig(changes: Record<string, unknown> = {}): unknown {
  return {
    profiles: { web: { platform: 'web', viewport: { width: 800, height: 600 } } },
    scenarios: ['retina/*.test.ts'],
    baselines: '.retina/baselines',
    required: [{ caseId: 'form/web/initial', platform: 'web', expectedChecks: ['functional', 'regression'] }],
    ...changes,
  };
}

function caseWith(checks: readonly CheckResult[]): CaseResult {
  return { caseId: 'form/web/initial', platform: 'web', profile: 'web', checks };
}

const pass = (kind: CheckResult['kind']): CheckResult => ({ kind, status: 'PASS', reasons: [] });

function test(result: CaseResult | undefined, changes: Partial<TestOutcome> = {}): TestOutcome {
  return {
    file: 'retina/form.test.ts',
    name: 'form',
    state: 'passed',
    retina: result === undefined ? undefined : { version: RETINA_META_VERSION, result },
    ...changes,
  };
}

function runnerReport(tests: readonly TestOutcome[], changes: Partial<RunnerReport> = {}): RunnerReport {
  return { testFiles: 1, tests, moduleProblems: [], unhandledErrors: 0, interrupted: false, ...changes };
}

interface Recorder {
  readonly plans: RunPlan[];
  readonly results: RunResultFile[];
  readonly runs: { root: string; include: readonly string[] }[];
}

function ports(
  config: unknown,
  report: RunnerReport,
  overrides: Partial<RunPorts> = {},
): { readonly ports: RunPorts; readonly recorder: Recorder } {
  const recorder: Recorder = { plans: [], results: [], runs: [] };
  const base: RunPorts = {
    loadConfig: async () => ({ ok: true, file: '/project/retina.config.ts', value: config }),
    runScenarios: async (input) => {
      recorder.runs.push(input);
      return report;
    },
    writePlan: async (plan) => {
      recorder.plans.push(plan);
      return { ok: true, path: `.retina/runs/${plan.runId}/attempt-1/plan.json` };
    },
    writeResult: async (result) => {
      recorder.results.push(result);
      return { ok: true, path: `.retina/runs/${result.runId}/attempt-1/result.json` };
    },
    now: () => new Date('2026-10-25T00:00:00.000Z'),
    newRunId: () => 'run-1',
    env: { TOKEN: SECRET },
    retinaVersion: '0.0.0',
  };
  return { ports: { ...base, ...overrides }, recorder };
}

const request: RunRequest = { cwd: '/project', selection: { mode: 'validate', platforms: [], profiles: [] } };

describe('runRetina: exit codes', () => {
  it('returns 0 when every required case passes, and is gate eligible', async () => {
    const { ports: p, recorder } = ports(webConfig(), runnerReport([test(caseWith([pass('functional'), pass('regression')]))]));
    const outcome = await runRetina(request, p);
    expect(outcome.exitCode).toBe(0);
    expect(outcome.result).toMatchObject({ status: 'PASS', exitCode: 0, gateEligible: true, scope: 'full' });
    expect(recorder.results).toHaveLength(1);
    expect(recorder.runs).toEqual([{ root: '/project', include: ['retina/*.test.ts'] }]);
  });

  it('returns 1 for an assertion failure of a declared case', async () => {
    const failed = test(caseWith([pass('regression')]), { state: 'failed', failure: 'assertion' });
    const outcome = await runRetina(request, ports(webConfig(), runnerReport([failed])).ports);
    expect(outcome.exitCode).toBe(1);
    expect(outcome.result.status).toBe('FAIL');
  });

  it('returns 2 for a test timeout', async () => {
    const timedOut = test(caseWith([]), { state: 'failed', failure: 'timeout' });
    const outcome = await runRetina(request, ports(webConfig(), runnerReport([timedOut])).ports);
    expect(outcome.exitCode).toBe(2);
    expect(outcome.result.execution.errors.map((e) => e.code)).toContain('test_timeout');
  });

  it('returns 2 for zero test files', async () => {
    const outcome = await runRetina(request, ports(webConfig(), runnerReport([], { testFiles: 0 })).ports);
    expect(outcome.exitCode).toBe(2);
    expect(outcome.result.execution.errors.map((e) => e.code)).toEqual(expect.arrayContaining(['no_test_files', 'no_results']));
  });

  it('returns 3 when a required case misses an expected check', async () => {
    const outcome = await runRetina(request, ports(webConfig(), runnerReport([test(caseWith([pass('functional')]))])).ports);
    expect(outcome.exitCode).toBe(3);
    expect(outcome.result.status).toBe('INCONCLUSIVE');
  });

  it('is never gate eligible for a partial run, even when it passes', async () => {
    const config = webConfig({
      profiles: {
        web: { platform: 'web', viewport: { width: 800, height: 600 } },
        'web-wide': { platform: 'web', viewport: { width: 1600, height: 900 } },
      },
    });
    const selection = { mode: 'validate' as const, platforms: [], profiles: ['web'] };
    const run = ports(config, runnerReport([test(caseWith([pass('functional'), pass('regression')]))]));
    const outcome = await runRetina({ cwd: '/project', selection }, run.ports);
    expect(outcome.exitCode).toBe(0);
    expect(outcome.result).toMatchObject({ scope: 'partial', gateEligible: false });
  });
});

describe('runRetina: errors before the run', () => {
  it('returns 2 and writes a result without running tests when the config is invalid', async () => {
    const config = webConfig({ profiles: { ios: { platform: 'ios', device: { udid: undefined } } } });
    const run = ports(config, runnerReport([]));
    const outcome = await runRetina(request, run.ports);
    expect(outcome.exitCode).toBe(2);
    expect(run.recorder.runs).toEqual([]);
    expect(run.recorder.plans).toEqual([]);
    expect(outcome.result.config.issues).toContainEqual({ path: 'profiles.ios.device.udid', code: 'device_not_pinned' });
    expect(run.recorder.results[0]?.execution.errors).toContainEqual(
      expect.objectContaining({ code: 'config_error', reason: 'device_not_pinned' }),
    );
  });

  it('returns 2 when the config cannot be loaded', async () => {
    const run = ports(undefined, runnerReport([]), {
      loadConfig: async () => ({ ok: false, reason: 'config_not_found' }),
    });
    const outcome = await runRetina(request, run.ports);
    expect(outcome.exitCode).toBe(2);
    expect(outcome.result.execution.errors).toEqual([expect.objectContaining({ code: 'config_error', reason: 'config_not_found' })]);
  });

  it('returns 2 for missing required env and records names only', async () => {
    const run = ports(webConfig({ requiredEnv: ['TOKEN', 'MISSING_ONE'] }), runnerReport([]));
    const outcome = await runRetina(request, run.ports);
    expect(outcome.exitCode).toBe(2);
    expect(outcome.result.config.missingEnv).toEqual(['MISSING_ONE']);
    expect(run.recorder.runs).toEqual([]);
    expect(JSON.stringify(outcome.result)).not.toContain(SECRET);
  });

  it('returns 2 for a selection error', async () => {
    const selection = { mode: 'validate' as const, platforms: [], profiles: ['nope'] };
    const outcome = await runRetina({ cwd: '/project', selection }, ports(webConfig(), runnerReport([])).ports);
    expect(outcome.exitCode).toBe(2);
    expect(outcome.result.execution.errors).toEqual([expect.objectContaining({ code: 'selection_error' })]);
  });

  it('writes the plan before running and never puts env values in it', async () => {
    const order: string[] = [];
    const run = ports(webConfig({ requiredEnv: ['TOKEN'] }), runnerReport([test(caseWith([pass('functional'), pass('regression')]))]));
    const outcome = await runRetina(request, {
      ...run.ports,
      writePlan: async (plan) => {
        order.push('plan');
        return run.ports.writePlan(plan);
      },
      runScenarios: async (input) => {
        order.push('run');
        return run.ports.runScenarios(input);
      },
    });
    expect(order).toEqual(['plan', 'run']);
    expect(outcome.exitCode).toBe(0);
    expect(JSON.stringify(run.recorder.plans)).not.toContain(SECRET);
  });

  it('returns 2 without running tests when the plan cannot be written', async () => {
    const run = ports(webConfig(), runnerReport([]), {
      writePlan: async () => ({ ok: false, path: 'plan.json', reason: 'EACCES' }),
    });
    const outcome = await runRetina(request, run.ports);
    expect(outcome.exitCode).toBe(2);
    expect(run.recorder.runs).toEqual([]);
    expect(outcome.result.execution.errors).toEqual([expect.objectContaining({ code: 'artifact_error' })]);
  });

  it('returns 2 when the result cannot be written, even for a passing run', async () => {
    const run = ports(webConfig(), runnerReport([test(caseWith([pass('functional'), pass('regression')]))]), {
      writeResult: async () => ({ ok: false, path: 'result.json', reason: 'ENOSPC' }),
    });
    const outcome = await runRetina(request, run.ports);
    expect(outcome.exitCode).toBe(2);
    expect(outcome.resultWrite).toEqual({ ok: false, path: 'result.json', reason: 'ENOSPC' });
  });

  it('maps a throwing test runner to runner_error', async () => {
    const run = ports(webConfig(), runnerReport([]), {
      runScenarios: async () => {
        throw new Error(SECRET);
      },
    });
    const outcome = await runRetina(request, run.ports);
    expect(outcome.exitCode).toBe(2);
    expect(outcome.result.execution.errors.map((e) => e.code)).toContain('runner_error');
    expect(JSON.stringify(outcome.result)).not.toContain(SECRET);
  });
});
