import { describe, expect, it } from 'vitest';
import { formatSummary } from '../../src/cli/summary.ts';
import type { RunOutcome } from '../../src/domain/run/run-retina.ts';
import { aggregateRun } from '../../src/index.ts';

const base: RunOutcome = {
  exitCode: 2,
  resultWrite: { ok: true, path: '.retina/runs/r/attempt-1/result.json' },
  result: {
    schemaVersion: 1,
    schemaStatus: 'proposal',
    runId: 'r',
    attempt: 1,
    retinaVersion: '0.0.0',
    mode: 'validate',
    startedAt: 'a',
    finishedAt: 'b',
    status: 'INCONCLUSIVE',
    exitCode: 2,
    scope: 'unknown',
    gateEligible: false,
    execution: {
      state: 'not_started',
      errors: [{ kind: 'execution_error', code: 'config_error', message: 'Config issue at "profiles.ios.device.udid": device_not_pinned.', reason: 'device_not_pinned' }],
    },
    config: { issues: [{ path: 'profiles.ios.device.udid', code: 'device_not_pinned' }], missingEnv: ['API_TOKEN'] },
  },
};

describe('formatSummary', () => {
  it('prints status, exit code, scope, config issues, missing env names and the result path', () => {
    const { out, err } = formatSummary(base);
    expect(out.join('\n')).toContain('retina run: INCONCLUSIVE (exit 2)');
    expect(out.join('\n')).toContain('scope unknown');
    expect(out.join('\n')).toContain('result: .retina/runs/r/attempt-1/result.json');
    expect(err).toContain('  config issue: profiles.ios.device.udid device_not_pinned');
    expect(err).toContain('  missing env: API_TOKEN');
    expect(err.some((line) => line.includes('config_error'))).toBe(true);
  });

  it('prints counts for a finished run', () => {
    const outcome: RunOutcome = {
      ...base,
      exitCode: 0,
      result: {
        ...base.result,
        status: 'PASS',
        exitCode: 0,
        scope: 'full',
        gateEligible: true,
        execution: { state: 'completed', errors: [] },
        config: { issues: [], missingEnv: [] },
        tests: { total: 2, passed: 2, failed: 0, skipped: 0 },
        aggregate: aggregateRun({
          mode: 'validate',
          declaredPlatforms: ['web'],
          projectPlatforms: ['web'],
          requiredCases: [{ caseId: 'a', platform: 'web', expectedChecks: ['functional'] }],
          results: [{ caseId: 'a', platform: 'web', profile: 'web', checks: [{ kind: 'functional', status: 'PASS', reasons: [] }] }],
        }),
      },
    };
    const text = formatSummary(outcome).out.join('\n');
    expect(text).toContain('retina run: PASS (exit 0)');
    expect(text).toContain('cases: PASS 1, FAIL 0, REVIEW_REQUIRED 0, INCONCLUSIVE 0, missing 0');
    expect(text).toContain('tests: 2 total, 2 passed, 0 failed, 0 skipped');
    expect(text).toContain('gate eligible: yes');
  });

  it('reports a result write failure', () => {
    const outcome: RunOutcome = { ...base, resultWrite: { ok: false, path: 'x/result.json', reason: 'ENOSPC' } };
    expect(formatSummary(outcome).err).toContain('  result.json could not be written: x/result.json (ENOSPC)');
  });
});
