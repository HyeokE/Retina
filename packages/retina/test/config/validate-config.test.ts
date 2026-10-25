import { describe, expect, it } from 'vitest';
import { defineConfig, validateConfig, type ConfigIssue, type RetinaConfig } from '../../src/index.ts';
import { deepFreeze } from '../helpers/fixtures.ts';

const FRAME_M = 'https://www.figma.com/design/FileKey1/Profile?node-id=12-34';
const FRAME_D = 'https://www.figma.com/design/FileKey1/branch/BranchKey2/Profile?node-id=12-35';

function fullConfig(): RetinaConfig {
  return {
    profiles: {
      'web-desktop': {
        platform: 'web',
        viewport: { width: 1440, height: 900 },
        deviceScaleFactor: 1,
        locale: 'en-US',
        timezone: 'UTC',
        colorScheme: 'light',
        fixtureScope: 'a',
      },
      'web-mobile': {
        platform: 'web',
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        fixtureScope: 'b',
      },
      ios: { platform: 'ios', device: { udid: '00000000-0000-0000-0000-000000000001' }, fixtureScope: 'c' },
      android: { platform: 'android', device: { serial: 'emulator-5554', avdRamMb: 2048 } },
    },
    providers: {
      auth: { authenticate: async () => ({ ok: true }) },
      ready: { waitUntilReady: async () => ({ ok: true }) },
      locators: { 'profile.name': { web: 'profile-name', ios: 'profile-name', android: 'profile_name' } },
    },
    design: {
      frames: [
        { id: 'form-initial-m', url: FRAME_M, checkpoint: 'form/initial', envs: ['web-mobile', 'ios', 'android'] },
        { id: 'form-initial-d', url: FRAME_D, checkpoint: 'form/initial', envs: ['web-desktop'] },
      ],
      fixturesDir: 'retina/design-fixtures',
    },
    report: { open: 'serve' },
    scenarios: ['retina/scenarios/*.test.ts'],
    baselines: '.retina/baselines',
    requiredEnv: ['RETINA_API_TOKEN', 'RETINA_IOS_UDID'],
  };
}

function withChanges(changes: Record<string, unknown>): unknown {
  return { ...fullConfig(), ...changes };
}

function issuesOf(input: unknown): readonly ConfigIssue[] {
  const result = validateConfig(input);
  if (result.ok) {
    throw new Error('expected validation issues');
  }
  return result.issues;
}

function expectIssue(input: unknown, path: string, code: ConfigIssue['code']): void {
  expect(issuesOf(input)).toContainEqual(expect.objectContaining({ path, code }));
}

describe('defineConfig', () => {
  it('returns the same object', () => {
    const config = fullConfig();
    expect(defineConfig(config)).toBe(config);
  });
});

describe('validateConfig: valid input', () => {
  it('accepts a full config with web desktop/mobile, ios and android profiles', () => {
    const input = deepFreeze(fullConfig());
    const result = validateConfig(input);
    expect(result).toEqual({ ok: true, config: input });
  });

  it('accepts a minimal config without optional sections', () => {
    const input = {
      profiles: { web: { platform: 'web', viewport: { width: 800, height: 600 } } },
      scenarios: ['s/*.test.ts'],
      baselines: '.retina/baselines',
    };
    expect(validateConfig(input).ok).toBe(true);
  });

  it('accepts report.open false', () => {
    expect(validateConfig(withChanges({ report: { open: false } })).ok).toBe(true);
  });
});

describe('validateConfig: shape', () => {
  it.each([null, 'config', 42, []])('rejects a non-object config %j', (input) => {
    expect(issuesOf(input)).toEqual([expect.objectContaining({ path: '', code: 'invalid_type' })]);
  });

  it('requires profiles, scenarios and baselines', () => {
    const issues = issuesOf({});
    expect(issues).toContainEqual(expect.objectContaining({ path: 'profiles', code: 'missing' }));
    expect(issues).toContainEqual(expect.objectContaining({ path: 'scenarios', code: 'missing' }));
    expect(issues).toContainEqual(expect.objectContaining({ path: 'baselines', code: 'missing' }));
  });

  it('rejects an empty profile map', () => {
    expectIssue(withChanges({ profiles: {} }), 'profiles', 'no_profiles');
  });

  it('reports unknown top-level keys', () => {
    expectIssue(withChanges({ scenario: ['x'] }), 'scenario', 'unknown_key');
  });
});

describe('validateConfig: profiles', () => {
  it('rejects an unknown platform', () => {
    expectIssue(withChanges({ profiles: { tv: { platform: 'tvos' } } }), 'profiles.tv.platform', 'unknown_platform');
  });

  it('rejects an ios profile without a pinned udid', () => {
    expectIssue(withChanges({ profiles: { ios: { platform: 'ios', device: {} } } }), 'profiles.ios.device.udid', 'device_not_pinned');
    expectIssue(
      withChanges({ profiles: { ios: { platform: 'ios', device: { udid: undefined } } } }),
      'profiles.ios.device.udid',
      'device_not_pinned',
    );
    expectIssue(withChanges({ profiles: { ios: { platform: 'ios' } } }), 'profiles.ios.device', 'device_not_pinned');
  });

  it('rejects an android profile without a pinned serial', () => {
    expectIssue(
      withChanges({ profiles: { android: { platform: 'android', device: { serial: '' } } } }),
      'profiles.android.device.serial',
      'device_not_pinned',
    );
  });

  it('rejects a non-positive-integer avdRamMb', () => {
    expectIssue(
      withChanges({ profiles: { android: { platform: 'android', device: { serial: 'e-1', avdRamMb: 0 } } } }),
      'profiles.android.device.avdRamMb',
      'invalid_value',
    );
  });

  it.each([
    [{ width: 0, height: 900 }, 'profiles.w.viewport.width'],
    [{ width: 1440, height: -1 }, 'profiles.w.viewport.height'],
    [{ width: 390.5, height: 844 }, 'profiles.w.viewport.width'],
    [{ width: '390', height: 844 }, 'profiles.w.viewport.width'],
  ])('rejects web viewport %j', (viewport, path) => {
    expectIssue(withChanges({ profiles: { w: { platform: 'web', viewport } } }), path, 'invalid_viewport');
  });

  it('requires a web viewport', () => {
    expectIssue(withChanges({ profiles: { w: { platform: 'web' } } }), 'profiles.w.viewport', 'invalid_viewport');
  });

  it('checks the optional web fields', () => {
    const issues = issuesOf(
      withChanges({
        profiles: {
          w: {
            platform: 'web',
            viewport: { width: 10, height: 10 },
            deviceScaleFactor: 0,
            isMobile: 'yes',
            colorScheme: 'sepia',
            locale: '',
            fixtureScope: 3,
          },
        },
      }),
    );
    const paths = issues.map((issue) => issue.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        'profiles.w.deviceScaleFactor',
        'profiles.w.isMobile',
        'profiles.w.colorScheme',
        'profiles.w.locale',
        'profiles.w.fixtureScope',
      ]),
    );
  });

  it('reports fields that belong to another platform', () => {
    expectIssue(
      withChanges({ profiles: { ios: { platform: 'ios', device: { udid: 'u-1' }, viewport: { width: 1, height: 1 } } } }),
      'profiles.ios.viewport',
      'unknown_key',
    );
  });
});

describe('validateConfig: design frames', () => {
  const frame = { id: 'f', url: FRAME_M, checkpoint: 'form/initial', envs: ['ios'] };

  it('rejects duplicate frame ids', () => {
    const design = { frames: [frame, { ...frame, envs: ['android'] }], fixturesDir: 'd' };
    expectIssue(withChanges({ design }), 'design.frames[1].id', 'duplicate_frame_id');
  });

  it('rejects envs that reference unknown profile ids', () => {
    const design = { frames: [{ ...frame, envs: ['ios', 'tablet'] }], fixturesDir: 'd' };
    expectIssue(withChanges({ design }), 'design.frames[0].envs[1]', 'unknown_profile_ref');
  });

  it('rejects a frame without envs', () => {
    const design = { frames: [{ ...frame, envs: [] }], fixturesDir: 'd' };
    expectIssue(withChanges({ design }), 'design.frames[0].envs', 'invalid_value');
  });

  it('rejects a Figma URL that does not resolve to a file key and node id', () => {
    const design = { frames: [{ ...frame, url: 'https://www.figma.com/design/FileKey1/Profile' }], fixturesDir: 'd' };
    const issues = issuesOf(withChanges({ design }));
    expect(issues).toContainEqual(expect.objectContaining({ path: 'design.frames[0].url', code: 'invalid_figma_url' }));
    expect(issues.find((issue) => issue.path === 'design.frames[0].url')?.message).toContain('missing_node_id');
  });

  it('requires fixturesDir', () => {
    expectIssue(withChanges({ design: { frames: [] } }), 'design.fixturesDir', 'missing');
  });
});

describe('validateConfig: report, scenarios, baselines, providers', () => {
  it.each(['browser', true, null, 1])('rejects report.open %j', (open) => {
    expectIssue(withChanges({ report: { open } }), 'report.open', 'invalid_report_open');
  });

  it('rejects empty scenarios and blank scenario globs', () => {
    expectIssue(withChanges({ scenarios: [] }), 'scenarios', 'empty_scenarios');
    expectIssue(withChanges({ scenarios: ['ok/*.ts', ''] }), 'scenarios[1]', 'invalid_value');
  });

  it('rejects an empty baselines directory', () => {
    expectIssue(withChanges({ baselines: '' }), 'baselines', 'invalid_value');
  });

  it('rejects unknown and non-object providers', () => {
    expectIssue(withChanges({ providers: { login: {} } }), 'providers.login', 'unknown_provider');
    expectIssue(withChanges({ providers: { auth: 'cookie' } }), 'providers.auth', 'invalid_provider');
  });

  it('rejects a provider without its required method', () => {
    expectIssue(withChanges({ providers: { fixture: { snapshot: async () => ({ ok: true }) } } }), 'providers.fixture.setup', 'invalid_provider');
  });

  it('rejects a locator map entry that is not a platform map of strings', () => {
    expectIssue(withChanges({ providers: { locators: { a: { web: 1 } } } }), 'providers.locators.a.web', 'invalid_provider');
    expectIssue(withChanges({ providers: { locators: { a: { tv: 'x' } } } }), 'providers.locators.a.tv', 'unknown_platform');
  });
});

describe('validateConfig: requiredEnv', () => {
  it('rejects duplicate names', () => {
    expectIssue(withChanges({ requiredEnv: ['A_TOKEN', 'B', 'A_TOKEN'] }), 'requiredEnv[2]', 'duplicate_env_name');
  });

  it.each(['1ABC', 'WITH-DASH', '', 'A B'])('rejects invalid env name %j', (name) => {
    expectIssue(withChanges({ requiredEnv: ['OK', name] }), 'requiredEnv[1]', 'invalid_env_name');
  });
});

describe('validateConfig: multi-issue report', () => {
  it('reports every issue, not just the first', () => {
    const input = {
      profiles: {
        tv: { platform: 'tvos' },
        ios: { platform: 'ios', device: {} },
        w: { platform: 'web', viewport: { width: 0, height: 10 } },
      },
      design: {
        frames: [
          { id: 'f', url: 'https://example.com/x', checkpoint: 'c', envs: ['ghost'] },
          { id: 'f', url: FRAME_M, checkpoint: 'c', envs: ['w'] },
        ],
        fixturesDir: 'd',
      },
      report: { open: 'browser' },
      scenarios: [],
      baselines: '.retina/baselines',
      requiredEnv: ['GOOD', 'bad-name', 'GOOD'],
    };
    const codes = issuesOf(input).map((issue) => `${issue.path}:${issue.code}`);
    expect(codes).toEqual(
      expect.arrayContaining([
        'profiles.tv.platform:unknown_platform',
        'profiles.ios.device.udid:device_not_pinned',
        'profiles.w.viewport.width:invalid_viewport',
        'design.frames[0].url:invalid_figma_url',
        'design.frames[0].envs[0]:unknown_profile_ref',
        'design.frames[1].id:duplicate_frame_id',
        'report.open:invalid_report_open',
        'scenarios:empty_scenarios',
        'requiredEnv[1]:invalid_env_name',
        'requiredEnv[2]:duplicate_env_name',
      ]),
    );
    expect(codes).toHaveLength(10);
  });

  it('gives every issue a non-empty message that does not echo config values', () => {
    const secretUdid = 'udid-sk-live-SECRET';
    const input = withChanges({
      profiles: { ios: { platform: 'ios', device: { udid: secretUdid }, extra: secretUdid } },
      requiredEnv: [`${secretUdid}-name`],
    });
    const issues = issuesOf(input);
    expect(issues.length).toBeGreaterThan(0);
    for (const issue of issues) {
      expect(issue.message.length).toBeGreaterThan(0);
    }
    expect(JSON.stringify(issues)).not.toContain(secretUdid);
  });
});

describe('validateConfig: remaining shape rules', () => {
  const frame = { id: 'f', url: FRAME_M, checkpoint: 'c', envs: ['ios'] };
  const ok = async () => ({ ok: true as const });

  it.each<readonly [string, Record<string, unknown>, string, ConfigIssue['code']]>([
    ['profiles not an object', { profiles: ['web'] }, 'profiles', 'invalid_type'],
    ['a profile not an object', { profiles: { w: 'web' } }, 'profiles.w', 'invalid_type'],
    ['a profile without platform', { profiles: { w: { viewport: { width: 1, height: 1 } } } }, 'profiles.w.platform', 'missing'],
    [
      'an unknown viewport key',
      { profiles: { w: { platform: 'web', viewport: { width: 1, height: 1, depth: 1 } } } },
      'profiles.w.viewport.depth',
      'unknown_key',
    ],
    [
      'an android-only key on an ios device',
      { profiles: { ios: { platform: 'ios', device: { udid: 'u', avdRamMb: 1024 } } } },
      'profiles.ios.device.avdRamMb',
      'unknown_key',
    ],
    ['a blank udid', { profiles: { ios: { platform: 'ios', device: { udid: '  ' } } } }, 'profiles.ios.device.udid', 'device_not_pinned'],
    ['providers not an object', { providers: [] }, 'providers', 'invalid_type'],
    ['env provider without values', { providers: { env: { apply: ok, verify: ok } } }, 'providers.env.values', 'invalid_provider'],
    ['fixture snapshot without restore', { providers: { fixture: { setup: ok, snapshot: ok } } }, 'providers.fixture', 'invalid_provider'],
    ['an optional method that is not a function', { providers: { data: { install: ok, uninstall: 'no' } } }, 'providers.data.uninstall', 'invalid_provider'],
    ['a locator entry not an object', { providers: { locators: { a: 'x' } } }, 'providers.locators.a', 'invalid_provider'],
    ['design not an object', { design: 'figma' }, 'design', 'invalid_type'],
    ['design without frames', { design: { fixturesDir: 'd' } }, 'design.frames', 'missing'],
    ['frames not a list', { design: { frames: {}, fixturesDir: 'd' } }, 'design.frames', 'invalid_type'],
    ['a frame not an object', { design: { frames: ['f'], fixturesDir: 'd' } }, 'design.frames[0]', 'invalid_type'],
    ['an unknown frame key', { design: { frames: [{ ...frame, platform: 'ios' }], fixturesDir: 'd' } }, 'design.frames[0].platform', 'unknown_key'],
    ['a frame without url', { design: { frames: [{ id: 'f', checkpoint: 'c', envs: ['ios'] }], fixturesDir: 'd' } }, 'design.frames[0].url', 'missing'],
    ['a frame url that is not a string', { design: { frames: [{ ...frame, url: 1 }], fixturesDir: 'd' } }, 'design.frames[0].url', 'invalid_figma_url'],
    ['a frame without checkpoint', { design: { frames: [{ ...frame, checkpoint: '' }], fixturesDir: 'd' } }, 'design.frames[0].checkpoint', 'invalid_value'],
    ['a non-string env entry', { design: { frames: [{ ...frame, envs: [1] }], fixturesDir: 'd' } }, 'design.frames[0].envs[0]', 'invalid_value'],
    ['report not an object', { report: 'serve' }, 'report', 'invalid_type'],
    ['report without open', { report: {} }, 'report.open', 'missing'],
    ['an unknown report key', { report: { open: 'print', port: 1 } }, 'report.port', 'unknown_key'],
    ['scenarios not a list', { scenarios: 'retina/*.ts' }, 'scenarios', 'invalid_type'],
    ['requiredEnv not a list', { requiredEnv: 'A' }, 'requiredEnv', 'invalid_type'],
    ['a non-string requiredEnv entry', { requiredEnv: [1] }, 'requiredEnv[0]', 'invalid_env_name'],
  ])('rejects %s', (_label, changes, path, code) => {
    expectIssue(withChanges(changes), path, code);
  });

  it('accepts a fixture provider with both snapshot and restore', () => {
    const providers = { fixture: { setup: ok, snapshot: async () => ({ ok: true as const, snapshot: null }), restore: ok } };
    expect(validateConfig(withChanges({ providers })).ok).toBe(true);
  });
});
