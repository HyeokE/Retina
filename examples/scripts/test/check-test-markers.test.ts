import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(here, '..', 'check-test-markers.mjs');
const ROOT_PACKAGE = join(here, '..', '..', '..', 'package.json');

const tempRoots: string[] = [];

function fixture(files: Readonly<Record<string, string | Uint8Array>>): string {
  const root = mkdtempSync(join(tmpdir(), 'retina-markers-'));
  tempRoots.push(root);
  for (const [relativePath, content] of Object.entries(files)) {
    const path = join(root, relativePath);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  }
  return root;
}

function hermesLike(...strings: string[]): Uint8Array {
  return Buffer.concat([Buffer.from([0xc6, 0x1f, 0xbc, 0x03, 0x00]), ...strings.map((s) => Buffer.from(`${s}\0`))]);
}

function runCheck(expect: 'absent' | 'present', dirs: readonly string[]) {
  const result = spawnSync(process.execPath, [SCRIPT, `--expect=${expect}`, ...dirs], { encoding: 'utf8' });
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

afterEach(() => {
  for (const root of tempRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('check-test-markers.mjs', () => {
  const markerBundle = hermesLike('retina-ready-', 'retina-build-id');

  it('fails --expect=present when one platform has the markers and another has none', () => {
    const root = fixture({ 'ios/index.hbc': markerBundle, 'android/index.hbc': hermesLike('profile-name') });
    const result = runCheck('present', [join(root, 'ios'), join(root, 'android')]);
    expect(result.status).toBe(1);
    expect(result.output).toContain('expected "retina-ready" but found none');
  });

  it('passes --expect=present only when every directory has every required marker', () => {
    const root = fixture({ 'ios/index.hbc': markerBundle, 'android/index.hbc': markerBundle });
    expect(runCheck('present', [join(root, 'ios'), join(root, 'android')]).status).toBe(0);
  });

  it('fails --expect=absent per directory, reading binary files as bytes', () => {
    const root = fixture({ 'ios/index.hbc': hermesLike('profile-name'), 'android/index.hbc': markerBundle });
    const result = runCheck('absent', [join(root, 'ios'), join(root, 'android')]);
    expect(result.status).toBe(1);
    expect(result.output).toContain('android');
  });

  it('exits 2 for a missing or empty platform directory', () => {
    const root = fixture({ 'ios/index.hbc': markerBundle });
    mkdirSync(join(root, 'empty'));
    expect(runCheck('present', [join(root, 'ios'), join(root, 'android')]).status).toBe(2);
    expect(runCheck('absent', [join(root, 'ios'), join(root, 'empty')]).status).toBe(2);
  });

  it('root check scripts scan each platform output separately', () => {
    const scripts = (JSON.parse(readFileSync(ROOT_PACKAGE, 'utf8')) as { scripts: Record<string, string> }).scripts;
    for (const name of ['example:check:prod', 'example:check:test']) {
      const dirs = (scripts[name] ?? '').split(/\s+/).filter((token) => token.startsWith('examples/') && !token.endsWith('.mjs'));
      expect(dirs, name).toEqual(['examples/web/dist', 'examples/expo/dist/ios', 'examples/expo/dist/android']);
    }
  });
});
