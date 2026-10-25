import { KNOWN_PLATFORMS } from '../domain/verdict/types.ts';
import { isNonEmptyString, isRecord, issue, keyPath, type UnknownRecord } from './issues.ts';
import { PROVIDER_NAMES, type ProviderName } from './provider-result.ts';
import type { ConfigIssue } from './types.ts';

/*
 * Shallow checks of `providers`: each slot is known, is an object and carries
 * its methods. Signatures cannot be checked at runtime; `runProvider` turns a
 * misbehaving call into INCONCLUSIVE.
 */

type MethodProvider = Exclude<ProviderName, 'locators'>;

const REQUIRED_METHODS: Readonly<Record<MethodProvider, readonly string[]>> = {
  auth: ['authenticate'],
  fixture: ['setup'],
  data: ['install'],
  env: ['apply', 'verify'],
  schema: ['validate'],
  buildIdentity: ['read'],
  navigator: ['navigate'],
  ready: ['waitUntilReady'],
};

const OPTIONAL_METHODS: Readonly<Partial<Record<MethodProvider, readonly string[]>>> = {
  fixture: ['snapshot', 'restore'],
  data: ['uninstall'],
};

const KNOWN_NAMES: ReadonlySet<string> = new Set(PROVIDER_NAMES);
const PLATFORMS: ReadonlySet<string> = new Set(KNOWN_PLATFORMS);

function methodIssues(provider: UnknownRecord, name: MethodProvider, base: string): ConfigIssue[] {
  const required = REQUIRED_METHODS[name].filter((method) => typeof provider[method] !== 'function');
  const optional = (OPTIONAL_METHODS[name] ?? []).filter(
    (method) => provider[method] !== undefined && typeof provider[method] !== 'function',
  );
  return [...required, ...optional].map((method) =>
    issue(keyPath(base, method), 'invalid_provider', `${name}.${method} must be a function`),
  );
}

/** Snapshot without restore (or the reverse) cannot recover shared state. */
function fixturePairIssues(provider: UnknownRecord, base: string): ConfigIssue[] {
  const hasSnapshot = provider['snapshot'] !== undefined;
  const hasRestore = provider['restore'] !== undefined;
  return hasSnapshot === hasRestore
    ? []
    : [issue(base, 'invalid_provider', 'fixture.snapshot and fixture.restore must be provided together')];
}

function envValuesIssues(provider: UnknownRecord, base: string): ConfigIssue[] {
  return isRecord(provider['values']) ? [] : [issue(keyPath(base, 'values'), 'invalid_provider', 'env.values must be an object')];
}

function platformLocatorIssues(value: unknown, base: string): ConfigIssue[] {
  if (!isRecord(value)) {
    return [issue(base, 'invalid_provider', 'a locator entry must map platforms to identifiers')];
  }
  return Object.keys(value).flatMap((platform) => {
    const path = keyPath(base, platform);
    if (!PLATFORMS.has(platform)) {
      return [issue(path, 'unknown_platform', `locator platform must be one of ${KNOWN_PLATFORMS.join(', ')}`)];
    }
    return isNonEmptyString(value[platform]) ? [] : [issue(path, 'invalid_provider', 'a locator must be a non-empty string')];
  });
}

function locatorMapIssues(value: UnknownRecord, base: string): ConfigIssue[] {
  return Object.keys(value).flatMap((logicalId) => platformLocatorIssues(value[logicalId], keyPath(base, logicalId)));
}

function slotIssues(name: ProviderName, value: unknown, base: string): ConfigIssue[] {
  if (!isRecord(value)) {
    return [issue(base, 'invalid_provider', `${name} must be an object`)];
  }
  if (name === 'locators') {
    return locatorMapIssues(value, base);
  }
  const extra = name === 'fixture' ? fixturePairIssues(value, base) : name === 'env' ? envValuesIssues(value, base) : [];
  return [...methodIssues(value, name, base), ...extra];
}

function isProviderName(name: string): name is ProviderName {
  return KNOWN_NAMES.has(name);
}

/** The optional `providers` section (plan 6.2). Every slot is optional. */
export function validateProviders(value: unknown): ConfigIssue[] {
  if (value === undefined) {
    return [];
  }
  if (!isRecord(value)) {
    return [issue('providers', 'invalid_type', 'providers must be an object')];
  }
  return Object.keys(value).flatMap((name) => {
    const path = keyPath('providers', name);
    if (!isProviderName(name)) {
      return [issue(path, 'unknown_provider', `unknown provider "${name}"; known: ${PROVIDER_NAMES.join(', ')}`)];
    }
    return value[name] === undefined ? [] : slotIssues(name, value[name], path);
  });
}
