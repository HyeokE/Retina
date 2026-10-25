import { parseArgs } from 'node:util';
import type { RunSelection } from '../domain/run/plan.ts';
import { KNOWN_PLATFORMS, type Platform, type RunMode } from '../domain/verdict/types.ts';

export type CliCommand =
  | { readonly kind: 'version' }
  | { readonly kind: 'help' }
  | { readonly kind: 'run'; readonly configPath?: string; readonly selection: RunSelection }
  | { readonly kind: 'usage_error'; readonly message: string };

export const USAGE = [
  'Usage:',
  '  retina run [--config <path>] [--mode dev|validate] [--platform <web|ios|android>]... [--profile <id>]...',
  '  retina --version',
  '',
  'Exit codes: 0 every required result PASS, 1 a FAIL, 2 execution error, 3 review required or inconclusive.',
].join('\n');

const MODES: readonly RunMode[] = ['dev', 'validate'];
/** `validate` is the strict default: dev-mode acceptances never apply unless asked for. */
const DEFAULT_MODE: RunMode = 'validate';

const OPTIONS = {
  config: { type: 'string' },
  mode: { type: 'string' },
  platform: { type: 'string', multiple: true },
  profile: { type: 'string', multiple: true },
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean' },
} as const;

function usageError(message: string): CliCommand {
  return { kind: 'usage_error', message };
}

function isPlatform(value: string): value is Platform {
  return (KNOWN_PLATFORMS as readonly string[]).includes(value);
}

function isMode(value: string): value is RunMode {
  return (MODES as readonly string[]).includes(value);
}

type Values = {
  readonly config?: string | undefined;
  readonly mode?: string | undefined;
  readonly platform?: readonly string[] | undefined;
  readonly profile?: readonly string[] | undefined;
};

function runCommand(values: Values): CliCommand {
  const mode = values.mode ?? DEFAULT_MODE;
  if (!isMode(mode)) {
    return usageError(`--mode must be one of ${MODES.join(', ')}`);
  }
  const platforms = [...new Set(values.platform ?? [])];
  const badPlatform = platforms.find((platform) => !isPlatform(platform));
  if (badPlatform !== undefined) {
    return usageError(`--platform must be one of ${KNOWN_PLATFORMS.join(', ')}`);
  }
  const profiles = [...new Set(values.profile ?? [])];
  if (profiles.some((profile) => profile.trim() === '')) {
    return usageError('--profile needs a profile id');
  }
  if (values.config !== undefined && values.config.trim() === '') {
    return usageError('--config needs a path');
  }
  return {
    kind: 'run',
    ...(values.config !== undefined ? { configPath: values.config } : {}),
    selection: { mode, platforms: platforms.filter(isPlatform), profiles },
  };
}

/** Parses `retina` arguments (without `node` and the script path). Pure. */
export function parseCliArgs(argv: readonly string[]): CliCommand {
  try {
    const { values, positionals } = parseArgs({ args: [...argv], options: OPTIONS, allowPositionals: true, strict: true });
    if (values.version === true) {
      return { kind: 'version' };
    }
    const [command, ...rest] = positionals;
    if (values.help === true || command === undefined) {
      return { kind: 'help' };
    }
    if (command !== 'run') {
      return usageError(`unknown command "${command}"`);
    }
    if (rest.length > 0) {
      return usageError(`unexpected argument "${rest[0]}"`);
    }
    return runCommand(values);
  } catch (error) {
    return usageError(error instanceof Error ? error.message : 'invalid arguments');
  }
}
