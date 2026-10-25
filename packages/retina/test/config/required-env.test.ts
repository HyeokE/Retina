import { describe, expect, it } from 'vitest';
import { checkRequiredEnv, isValidEnvName } from '../../src/index.ts';

describe('checkRequiredEnv', () => {
  it('returns only the names that are missing or empty, in declaration order', () => {
    const env = { PRESENT: 'value', EMPTY: '', UNSET: undefined };
    expect(checkRequiredEnv(['UNSET', 'PRESENT', 'EMPTY', 'ABSENT'], env)).toEqual(['UNSET', 'EMPTY', 'ABSENT']);
  });

  it('returns an empty list when every name has a value', () => {
    expect(checkRequiredEnv(['A', 'B'], { A: '1', B: '2' })).toEqual([]);
    expect(checkRequiredEnv([], {})).toEqual([]);
  });

  it('reports a repeated missing name once', () => {
    expect(checkRequiredEnv(['A', 'A'], {})).toEqual(['A']);
  });

  it('does not read inherited object properties as values', () => {
    expect(checkRequiredEnv(['toString', 'constructor'], {})).toEqual(['toString', 'constructor']);
  });

  it('never returns or embeds values', () => {
    const secret = 'sk-live-0123456789abcdef-SECRET';
    const env = { API_TOKEN: secret, OTHER_TOKEN: '' };
    const missing = checkRequiredEnv(['API_TOKEN', 'OTHER_TOKEN', 'MISSING_TOKEN'], env);
    expect(missing).toEqual(['OTHER_TOKEN', 'MISSING_TOKEN']);
    expect(JSON.stringify(missing)).not.toContain(secret);
    expect(JSON.stringify(missing)).not.toContain('sk-live');
  });
});

describe('isValidEnvName', () => {
  it.each(['A', 'API_TOKEN', '_PRIVATE', 'lower_case', 'X1'])('accepts %s', (name) => {
    expect(isValidEnvName(name)).toBe(true);
  });

  it.each(['', '1ABC', 'WITH-DASH', 'WITH SPACE', 'A=B', 'DOT.NAME'])('rejects %j', (name) => {
    expect(isValidEnvName(name)).toBe(false);
  });
});
