import { isValidEnvName } from './required-env.ts';
import {
  indexPath,
  isNonEmptyString,
  isRecord,
  issue,
  repeatedIndices,
  requiredStringIssues,
  unknownKeyIssues,
} from './issues.ts';
import { REPORT_OPEN_VALUES, type ConfigIssue, type ConfigValidation, type ValidatedConfig } from './types.ts';
import { validateDesign } from './validate-design.ts';
import { validateProfiles } from './validate-profiles.ts';
import { validateProviders } from './validate-providers.ts';
import { validateRequired } from './validate-required.ts';

const TOP_LEVEL_KEYS: ReadonlySet<string> = new Set([
  'profiles',
  'providers',
  'design',
  'report',
  'scenarios',
  'baselines',
  'requiredEnv',
  'required',
]);
const REPORT_KEYS: ReadonlySet<string> = new Set(['open']);
const REPORT_OPEN: ReadonlySet<unknown> = new Set(REPORT_OPEN_VALUES);

function reportIssues(value: unknown): ConfigIssue[] {
  if (value === undefined) {
    return [];
  }
  if (!isRecord(value)) {
    return [issue('report', 'invalid_type', 'report must be an object')];
  }
  const open = value['open'];
  const openIssues =
    open === undefined
      ? [issue('report.open', 'missing', 'report.open is required')]
      : REPORT_OPEN.has(open)
        ? []
        : [issue('report.open', 'invalid_report_open', 'report.open must be "os", "print", "serve" or false')];
  return [...unknownKeyIssues(value, REPORT_KEYS, 'report'), ...openIssues];
}

function scenariosIssues(value: unknown): ConfigIssue[] {
  if (value === undefined) {
    return [issue('scenarios', 'missing', 'scenarios is required')];
  }
  if (!Array.isArray(value)) {
    return [issue('scenarios', 'invalid_type', 'scenarios must be a list of globs')];
  }
  if (value.length === 0) {
    return [issue('scenarios', 'empty_scenarios', 'declare at least one scenario glob')];
  }
  return value.flatMap((glob: unknown, index) =>
    isNonEmptyString(glob) ? [] : [issue(indexPath('scenarios', index), 'invalid_value', 'a scenario glob must be a non-empty string')],
  );
}

/** Names only: invalid identifiers and repeats. Values are never looked at here. */
function requiredEnvIssues(value: unknown): ConfigIssue[] {
  if (value === undefined) {
    return [];
  }
  if (!Array.isArray(value)) {
    return [issue('requiredEnv', 'invalid_type', 'requiredEnv must be a list of names')];
  }
  const names: readonly unknown[] = value;
  const invalid = names.flatMap((name, index) =>
    typeof name === 'string' && isValidEnvName(name)
      ? []
      : [issue(indexPath('requiredEnv', index), 'invalid_env_name', 'not a valid environment variable name')],
  );
  const repeated = repeatedIndices(names).map((index) =>
    issue(indexPath('requiredEnv', index), 'duplicate_env_name', 'environment variable name is declared twice'),
  );
  return [...invalid, ...repeated];
}

function configIssues(input: Readonly<Record<string, unknown>>): ConfigIssue[] {
  const profiles = validateProfiles(input['profiles']);
  return [
    ...unknownKeyIssues(input, TOP_LEVEL_KEYS, ''),
    ...profiles.issues,
    ...validateProviders(input['providers']),
    ...validateDesign(input['design'], profiles.ids),
    ...reportIssues(input['report']),
    ...scenariosIssues(input['scenarios']),
    ...requiredStringIssues(input, 'baselines', ''),
    ...requiredEnvIssues(input['requiredEnv']),
    ...validateRequired(input['required'], input['profiles']),
  ];
}

/**
 * Validates an untrusted config value. Pure: no environment or filesystem
 * access, and user errors are returned, never thrown. Every issue is reported.
 */
export function validateConfig(input: unknown): ConfigValidation {
  if (!isRecord(input)) {
    return { ok: false, issues: [issue('', 'invalid_type', 'config must be an object')] };
  }
  const issues = configIssues(input);
  if (issues.length > 0) {
    return { ok: false, issues };
  }
  // Every data field was checked above; provider methods were checked for
  // presence only, and `runProvider` guards their calls at run time.
  return { ok: true, config: input as unknown as ValidatedConfig };
}
