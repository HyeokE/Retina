import { describe, expect, it } from 'vitest';
import { validateConfig, type ConfigIssue } from '../../src/index.ts';

function config(required: unknown): unknown {
  return {
    profiles: {
      'web-desktop': { platform: 'web', viewport: { width: 1440, height: 900 } },
      'web-mobile': { platform: 'web', viewport: { width: 390, height: 844 } },
      ios: { platform: 'ios', device: { udid: 'sim-1' } },
    },
    scenarios: ['s/*.test.ts'],
    baselines: '.retina/baselines',
    required,
  };
}

function issuesOf(required: unknown): readonly ConfigIssue[] {
  const result = validateConfig(config(required));
  return result.ok ? [] : result.issues;
}

function expectIssue(required: unknown, path: string, code: ConfigIssue['code']): void {
  expect(issuesOf(required)).toContainEqual(expect.objectContaining({ path, code }));
}

describe('validateConfig: required', () => {
  it('accepts a list of required cases, with or without a profile', () => {
    const required = [
      { caseId: 'form/web-desktop/initial', platform: 'web', profile: 'web-desktop', expectedChecks: ['functional'] },
      { caseId: 'form/ios/initial', platform: 'ios', expectedChecks: ['functional', 'regression'] },
    ];
    expect(validateConfig(config(required)).ok).toBe(true);
  });

  it('accepts an absent required field', () => {
    expect(validateConfig(config(undefined)).ok).toBe(true);
  });

  it('rejects a non-list', () => {
    expectIssue({ caseId: 'a' }, 'required', 'invalid_type');
  });

  it('rejects a non-object entry and unknown keys', () => {
    expectIssue(['a'], 'required[0]', 'invalid_type');
    expectIssue([{ caseId: 'a', platform: 'web', expectedChecks: ['functional'], extra: 1 }], 'required[0].extra', 'unknown_key');
  });

  it('requires a non-empty caseId', () => {
    expectIssue([{ platform: 'web', expectedChecks: ['functional'] }], 'required[0].caseId', 'missing');
    expectIssue([{ caseId: ' ', platform: 'web', expectedChecks: ['functional'] }], 'required[0].caseId', 'invalid_value');
  });

  it('rejects an unknown platform', () => {
    expectIssue([{ caseId: 'a', platform: 'tvos', expectedChecks: ['functional'] }], 'required[0].platform', 'unknown_platform');
  });

  it('requires a non-empty list of known, unique check kinds', () => {
    expectIssue([{ caseId: 'a', platform: 'web', expectedChecks: [] }], 'required[0].expectedChecks', 'invalid_value');
    expectIssue([{ caseId: 'a', platform: 'web' }], 'required[0].expectedChecks', 'missing');
    expectIssue([{ caseId: 'a', platform: 'web', expectedChecks: ['pixel'] }], 'required[0].expectedChecks[0]', 'invalid_value');
    expectIssue(
      [{ caseId: 'a', platform: 'web', expectedChecks: ['functional', 'functional'] }],
      'required[0].expectedChecks[1]',
      'invalid_value',
    );
  });

  it('rejects a profile that is not declared or on another platform', () => {
    expectIssue([{ caseId: 'a', platform: 'web', profile: 'tablet', expectedChecks: ['functional'] }], 'required[0].profile', 'unknown_profile_ref');
    expectIssue(
      [{ caseId: 'a', platform: 'web', profile: 'ios', expectedChecks: ['functional'] }],
      'required[0].profile',
      'profile_platform_mismatch',
    );
  });

  it('rejects the same case id declared twice on one platform', () => {
    const entry = { caseId: 'a', platform: 'web', expectedChecks: ['functional'] };
    expectIssue([entry, entry], 'required[1]', 'duplicate_required_case');
    expect(issuesOf([entry, { ...entry, platform: 'ios' }])).toEqual([]);
  });
});
