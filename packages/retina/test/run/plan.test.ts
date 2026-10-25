import { describe, expect, it } from 'vitest';
import { buildRunPlan, type PlanContext, type RunSelection } from '../../src/domain/run/plan.ts';
import type { ValidatedConfig } from '../../src/index.ts';

const config: ValidatedConfig = {
  profiles: {
    'web-desktop': { platform: 'web', viewport: { width: 1440, height: 900 } },
    'web-mobile': { platform: 'web', viewport: { width: 390, height: 844 } },
    ios: { platform: 'ios', device: { udid: 'sim-1' } },
  },
  scenarios: ['retina/scenarios/*.test.ts'],
  baselines: '.retina/baselines',
  requiredEnv: ['API_TOKEN'],
  required: [
    { caseId: 'form/web-desktop/initial', platform: 'web', profile: 'web-desktop', expectedChecks: ['functional'] },
    { caseId: 'form/web-mobile/initial', platform: 'web', profile: 'web-mobile', expectedChecks: ['functional'] },
    { caseId: 'form/ios/initial', platform: 'ios', expectedChecks: ['functional', 'regression'] },
  ],
};

const context: PlanContext = {
  runId: 'run-1',
  createdAt: '2026-10-25T00:00:00.000Z',
  retinaVersion: '0.0.0',
  env: { API_TOKEN: 'value-that-must-not-leak' },
};

function selection(changes: Partial<RunSelection> = {}): RunSelection {
  return { mode: 'validate', platforms: [], profiles: [], ...changes };
}

function planOf(changes: Partial<RunSelection> = {}) {
  const result = buildRunPlan(config, selection(changes), context);
  if (!result.ok) {
    throw new Error(`expected a plan, got ${result.errors.map((e) => e.reason).join(', ')}`);
  }
  return result.plan;
}

function errorReasons(changes: Partial<RunSelection>): readonly (string | undefined)[] {
  const result = buildRunPlan(config, selection(changes), context);
  return result.ok ? [] : result.errors.map((error) => error.reason);
}

describe('buildRunPlan', () => {
  it('selects every profile by default and is full', () => {
    const plan = planOf();
    expect(plan.scope).toBe('full');
    expect(plan.selectedProfiles.map((p) => p.id)).toEqual(['web-desktop', 'web-mobile', 'ios']);
    expect(plan.declaredPlatforms).toEqual(['web', 'ios']);
    expect(plan.projectPlatforms).toEqual(['web', 'ios']);
    expect(plan.requiredCases.map((c) => c.caseId)).toEqual([
      'form/web-desktop/initial',
      'form/web-mobile/initial',
      'form/ios/initial',
    ]);
    expect(plan.excluded).toEqual({ profiles: [], requiredCases: [] });
    expect(plan).toMatchObject({ schemaVersion: 1, runId: 'run-1', attempt: 1, mode: 'validate' });
  });

  it('records required env names and presence only', () => {
    const plan = planOf();
    expect(plan.requiredEnv).toEqual([{ name: 'API_TOKEN', present: true }]);
    expect(JSON.stringify(plan)).not.toContain('value-that-must-not-leak');
  });

  it('narrows by platform and becomes partial', () => {
    const plan = planOf({ platforms: ['web'] });
    expect(plan.scope).toBe('partial');
    expect(plan.declaredPlatforms).toEqual(['web']);
    expect(plan.projectPlatforms).toEqual(['web', 'ios']);
    expect(plan.excluded.profiles).toEqual([{ id: 'ios', platform: 'ios', reason: 'not_selected' }]);
    expect(plan.excluded.requiredCases).toEqual([
      { caseId: 'form/ios/initial', platform: 'ios', reason: 'platform_not_selected' },
    ]);
  });

  it('narrows by profile within one platform: partial, and the other profile cases are excluded', () => {
    const plan = planOf({ profiles: ['web-desktop'] });
    expect(plan.scope).toBe('partial');
    expect(plan.declaredPlatforms).toEqual(['web']);
    expect(plan.requiredCases.map((c) => c.caseId)).toEqual(['form/web-desktop/initial']);
    expect(plan.excluded.requiredCases).toContainEqual({
      caseId: 'form/web-mobile/initial',
      platform: 'web',
      reason: 'profile_not_selected',
    });
  });

  it('accepts a profile and platform filter that agree', () => {
    expect(planOf({ platforms: ['web'], profiles: ['web-mobile'] }).selectedProfiles.map((p) => p.id)).toEqual(['web-mobile']);
  });

  it('rejects an unknown profile, a conflicting platform and a platform without profiles', () => {
    expect(errorReasons({ profiles: ['tablet'] })).toEqual(['unknown_profile']);
    expect(errorReasons({ platforms: ['web'], profiles: ['ios'] })).toEqual(['profile_platform_conflict']);
    expect(errorReasons({ platforms: ['android'] })).toEqual(['platform_without_profiles']);
    expect(errorReasons({ platforms: ['web', 'ios'], profiles: ['web-mobile'] })).toEqual(['platform_without_profiles']);
  });

  it('reports selection errors as selection_error execution errors', () => {
    const result = buildRunPlan(config, selection({ profiles: ['tablet'] }), context);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0]).toMatchObject({ kind: 'execution_error', code: 'selection_error' });
    }
  });

  it('treats an absent required list as no required cases', () => {
    const { required: _required, ...withoutRequired } = config;
    const result = buildRunPlan(withoutRequired, selection(), context);
    expect(result.ok && result.plan.requiredCases).toEqual([]);
  });
});
