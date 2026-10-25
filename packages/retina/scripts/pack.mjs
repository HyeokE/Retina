// Packs the built package without the workspace-only `retina-source` export
// condition. The tarball ships `dist/` only, so a consumer tool that enabled
// that condition would resolve a file that is not there. The package.json in
// the repository is never modified: the tarball is made from a staging copy.
//
// Usage: node scripts/pack.mjs [--pack-destination <dir>]
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SOURCE_CONDITION = 'retina-source';
const packageDir = fileURLToPath(new URL('..', import.meta.url));

function destinationFromArgs(argv) {
  const index = argv.indexOf('--pack-destination');
  return index >= 0 && argv[index + 1] ? resolve(argv[index + 1]) : packageDir;
}

function withoutSourceCondition(exportsField) {
  return Object.fromEntries(
    Object.entries(exportsField).map(([subpath, target]) => {
      if (target === null || typeof target !== 'object') {
        return [subpath, target];
      }
      return [subpath, Object.fromEntries(Object.entries(target).filter(([condition]) => condition !== SOURCE_CONDITION))];
    }),
  );
}

function publishedManifest(manifest) {
  const { scripts: _scripts, devDependencies: _devDependencies, ...rest } = manifest;
  return { ...rest, exports: withoutSourceCondition(manifest.exports) };
}

if (!existsSync(join(packageDir, 'dist', 'index.js'))) {
  process.stderr.write('dist/ is missing; run the build first\n');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(join(packageDir, 'package.json'), 'utf8'));
const staging = mkdtempSync(join(tmpdir(), 'retina-pack-'));
try {
  writeFileSync(join(staging, 'package.json'), `${JSON.stringify(publishedManifest(manifest), null, 2)}\n`);
  cpSync(join(packageDir, 'dist'), join(staging, 'dist'), { recursive: true });
  const output = execFileSync('npm', ['pack', '--pack-destination', destinationFromArgs(process.argv.slice(2))], {
    cwd: staging,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  process.stdout.write(output);
} finally {
  rmSync(staging, { recursive: true, force: true });
}
