import { describe, expect, it } from 'vitest';
import { parseCaseIdentity, parseCaseResult } from '../../src/domain/run/case-shape.ts';

const valid = {
  caseId: 'form/web-desktop/initial',
  platform: 'web',
  profile: 'web-desktop',
  checks: [
    { kind: 'functional', status: 'PASS', reasons: [] },
    { kind: 'regression', status: 'REVIEW_REQUIRED', reasons: ['diff'], imageHashes: { diff: 'sha256:a' } },
  ],
};

function problemsOf(value: unknown): readonly string[] {
  const parsed = parseCaseResult(value);
  return parsed.ok ? [] : parsed.problems;
}

describe('parseCaseResult', () => {
  it('accepts a valid case result and returns an equal copy', () => {
    const parsed = parseCaseResult(valid);
    expect(parsed).toEqual({ ok: true, value: valid });
  });

  it('accepts a dev acceptance on a check', () => {
    const value = {
      ...valid,
      checks: [{ kind: 'regression', status: 'REVIEW_REQUIRED', reasons: [], acceptance: { by: 'user', diffHash: 'sha256:a' } }],
    };
    expect(parseCaseResult(value).ok).toBe(true);
  });

  it.each([null, 'x', 1, []])('rejects a non-object %j', (value) => {
    expect(problemsOf(value)).toEqual(['case result must be an object']);
  });

  it('names each invalid field without echoing values', () => {
    const problems = problemsOf({
      caseId: '',
      platform: 'tvos',
      profile: 3,
      checks: [{ kind: 'pixel', status: 'OK', reasons: ['secret-value', 5] }],
      extra: true,
    });
    expect(problems).toEqual(
      expect.arrayContaining([
        'caseId must be a non-empty string',
        'platform must be one of web, ios, android',
        'profile must be a non-empty string',
        'checks[0].kind is not a check kind',
        'checks[0].status is not a status',
        'checks[0].reasons must be a list of strings',
        'unknown key "extra"',
      ]),
    );
    expect(problems.join(' ')).not.toContain('secret-value');
  });

  it('rejects a missing checks list and invalid image hashes or acceptance', () => {
    expect(problemsOf({ ...valid, checks: undefined })).toContain('checks must be a list');
    expect(
      problemsOf({ ...valid, checks: [{ kind: 'functional', status: 'PASS', reasons: [], imageHashes: { diff: 1 } }] }),
    ).toContain('checks[0].imageHashes.diff must be a string');
    expect(
      problemsOf({ ...valid, checks: [{ kind: 'functional', status: 'PASS', reasons: [], acceptance: { by: 'bot', diffHash: 'x' } }] }),
    ).toContain('checks[0].acceptance must be { by: "user", diffHash }');
  });
});

describe('parseCaseIdentity', () => {
  it('accepts caseId, platform and profile', () => {
    expect(parseCaseIdentity({ caseId: 'a', platform: 'ios', profile: 'ios' })).toEqual({
      ok: true,
      value: { caseId: 'a', platform: 'ios', profile: 'ios' },
    });
  });

  it('rejects checks on an identity', () => {
    const parsed = parseCaseIdentity({ caseId: 'a', platform: 'ios', profile: 'ios', checks: [] });
    expect(parsed.ok).toBe(false);
  });
});
