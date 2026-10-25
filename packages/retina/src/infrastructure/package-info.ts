import { readFileSync } from 'node:fs';

/**
 * The installed package version. `src/infrastructure/` and
 * `dist/infrastructure/` both sit two levels below the package root.
 */
export function readPackageVersion(): string {
  const manifest: unknown = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
  const version = manifest !== null && typeof manifest === 'object' && 'version' in manifest ? manifest.version : undefined;
  return typeof version === 'string' ? version : 'unknown';
}
