import { existsSync } from 'node:fs';
import { extname, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { LoadedConfig } from '../../domain/run/run-retina.ts';

/** Looked up in the working directory, in this order, when `--config` is not given. */
export const CONFIG_FILE_NAMES: readonly string[] = ['retina.config.ts', 'retina.config.js', 'retina.config.mjs'];

const SUPPORTED_EXTENSIONS: ReadonlySet<string> = new Set(['.ts', '.mts', '.js', '.mjs']);
const TYPESCRIPT_EXTENSIONS: ReadonlySet<string> = new Set(['.ts', '.mts']);
const ERROR_CODE = /^ERR_[A-Z0-9_]+$/;

type Located = { readonly ok: true; readonly file: string } | { readonly ok: false; readonly reason: string; readonly file?: string };

function locate(cwd: string, configPath: string | undefined): Located {
  if (configPath !== undefined) {
    const file = resolve(cwd, configPath);
    return existsSync(file) ? { ok: true, file } : { ok: false, reason: 'config_not_found', file };
  }
  const found = CONFIG_FILE_NAMES.map((name) => resolve(cwd, name)).filter((file) => existsSync(file));
  if (found.length > 1) {
    return { ok: false, reason: 'ambiguous_config' };
  }
  const [file] = found;
  return file !== undefined ? { ok: true, file } : { ok: false, reason: 'config_not_found' };
}

/** Node strips types only outside node_modules (ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING). */
function unsupportedReason(file: string): string | undefined {
  const extension = extname(file);
  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    return 'unsupported_config_extension';
  }
  const inNodeModules = file.split(sep).includes('node_modules');
  return inNodeModules && TYPESCRIPT_EXTENSIONS.has(extension) ? 'typescript_config_in_node_modules' : undefined;
}

/** An `ERR_*` code from a thrown error, never its message (which may quote values). */
function errorCode(error: unknown): string | undefined {
  if (error === null || typeof error !== 'object' || !('code' in error)) {
    return undefined;
  }
  const code: unknown = error.code;
  return typeof code === 'string' && ERROR_CODE.test(code) ? code : undefined;
}

/**
 * Loads `retina.config.(ts|js|mjs)` with a dynamic import. A `.ts` config
 * relies on Node's built-in type stripping (Node >= 22.18). Failures are
 * returned as codes.
 */
export async function loadConfigFile(source: { readonly cwd: string; readonly configPath?: string }): Promise<LoadedConfig> {
  const located = locate(source.cwd, source.configPath);
  if (!located.ok) {
    return located;
  }
  const unsupported = unsupportedReason(located.file);
  if (unsupported !== undefined) {
    return { ok: false, reason: unsupported, file: located.file };
  }
  try {
    const module: unknown = await import(pathToFileURL(located.file).href);
    const value = module !== null && typeof module === 'object' && 'default' in module ? module.default : undefined;
    return value === undefined
      ? { ok: false, reason: 'no_default_export', file: located.file }
      : { ok: true, file: located.file, value };
  } catch (error) {
    const detail = errorCode(error);
    return { ok: false, reason: 'config_import_failed', file: located.file, ...(detail !== undefined ? { detail } : {}) };
  }
}
