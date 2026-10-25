import { describe, expect, it } from 'vitest';
import { parseCliArgs } from '../../src/cli/args.ts';

describe('parseCliArgs', () => {
  it('parses --version and help', () => {
    expect(parseCliArgs(['--version'])).toEqual({ kind: 'version' });
    expect(parseCliArgs([])).toEqual({ kind: 'help' });
    expect(parseCliArgs(['--help'])).toEqual({ kind: 'help' });
    expect(parseCliArgs(['run', '--help'])).toEqual({ kind: 'help' });
  });

  it('parses run with defaults', () => {
    expect(parseCliArgs(['run'])).toEqual({ kind: 'run', selection: { mode: 'validate', platforms: [], profiles: [] } });
  });

  it('parses run with every option, repeated filters and = syntax', () => {
    expect(
      parseCliArgs(['run', '--config', 'cfg/retina.config.ts', '--mode=dev', '--platform', 'web', '--platform', 'ios', '--profile', 'a', '--profile=b']),
    ).toEqual({
      kind: 'run',
      configPath: 'cfg/retina.config.ts',
      selection: { mode: 'dev', platforms: ['web', 'ios'], profiles: ['a', 'b'] },
    });
  });

  it('removes repeated filter values', () => {
    expect(parseCliArgs(['run', '--platform', 'web', '--platform', 'web'])).toMatchObject({
      selection: { platforms: ['web'] },
    });
  });

  it.each([
    [['run', '--mode', 'ci'], 'mode'],
    [['run', '--platform', 'tvos'], 'platform'],
    [['run', '--profile', ''], 'profile'],
    [['run', '--config'], 'config'],
    [['run', '--unknown'], 'unknown'],
    [['run', 'extra'], 'extra'],
    [['deploy'], 'deploy'],
  ])('rejects %j as a usage error', (argv, mentioned) => {
    const parsed = parseCliArgs(argv);
    expect(parsed.kind).toBe('usage_error');
    expect(parsed.kind === 'usage_error' && parsed.message).toContain(mentioned);
  });
});
