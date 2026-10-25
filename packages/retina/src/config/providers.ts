import type { Platform } from '../domain/verdict/types.ts';
import type { ProviderResult } from './provider-result.ts';

/*
 * Extension points a consuming project implements (plan 6.2). Every interface
 * here is a proposal and may change before the first release. They are
 * platform-agnostic: the adapter's driver or page handle is an opaque
 * `handle: unknown` that each adapter narrows to its own type.
 */

/** JSON-serializable data, so state can be stored and read by a later run. */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

/**
 * What every provider call receives. Proposal.
 */
export interface ProviderContext {
  readonly runId: string;
  readonly profileId: string;
  readonly platform: Platform;
  /** Adapter-specific driver or page handle. Opaque here; adapters narrow it. */
  readonly handle: unknown;
}

/** A provider call made for one capture point of a scenario. Proposal. */
export interface CheckpointContext extends ProviderContext {
  readonly scenario: string;
  readonly checkpoint: string;
}

/** Puts the app into the test user's session. Proposal. */
export interface AuthProvider {
  readonly authenticate: (context: ProviderContext) => Promise<ProviderResult>;
}

/** Fixture call context. Profiles with the same `fixtureScope` never run concurrently. Proposal. */
export interface FixtureContext extends ProviderContext {
  readonly fixtureScope?: string;
}

/**
 * Fixture lifecycle. Proposal.
 * - `setup` is idempotent: running it any number of times yields the same initial state.
 * - `snapshot` / `restore` are for shared state: after a forced stop, the next run
 *   restores the stored snapshot first. Runners without durable storage rely on
 *   the idempotent `setup` instead.
 */
export interface FixtureHooks {
  readonly setup: (context: FixtureContext) => Promise<ProviderResult>;
  readonly snapshot?: (context: FixtureContext) => Promise<ProviderResult<{ readonly snapshot: JsonValue }>>;
  readonly restore?: (context: FixtureContext, snapshot: JsonValue) => Promise<ProviderResult>;
}

/** Supplies the data a screen shows (route interception, mock server, backend seed). Proposal. */
export interface DataProvider {
  readonly install: (context: CheckpointContext) => Promise<ProviderResult>;
  readonly uninstall?: (context: CheckpointContext) => Promise<ProviderResult>;
}

/** Values the test mode pins. `now` is an ISO 8601 instant. Proposal. */
export interface EnvOverrideValues {
  readonly now?: string;
  readonly locale?: string;
  readonly timezone?: string;
  readonly currency?: string;
  readonly numberFormat?: string;
  readonly featureFlags?: Readonly<Record<string, boolean | number | string>>;
}

/** Declares and applies the pinned environment, then reports what the app actually uses. Proposal. */
export interface EnvOverrides {
  readonly values: EnvOverrideValues;
  readonly apply: (context: ProviderContext) => Promise<ProviderResult>;
  readonly verify: (context: ProviderContext) => Promise<ProviderResult<{ readonly applied: EnvOverrideValues }>>;
}

/** One fixture to check against the real API contract. Proposal. */
export interface SchemaSubject {
  readonly fixtureId: string;
  readonly data: JsonValue;
  readonly schemaRef?: string;
}

export interface SchemaIssue {
  readonly path: string;
  readonly message: string;
}

/**
 * Validates fixtures (OpenAPI, JSON Schema, a schema library, ...). A success
 * with issues means the validator ran and the fixture does not match. Proposal.
 */
export interface SchemaValidator {
  readonly validate: (subject: SchemaSubject) => Promise<ProviderResult<{ readonly issues: readonly SchemaIssue[] }>>;
}

/** Identity of the running build. `bundleId` is the JS bundle or update id of a native app. Proposal. */
export interface BuildIdentity {
  readonly buildId: string;
  readonly bundleId?: string;
  readonly commit?: string;
}

export interface BuildIdentityProvider {
  readonly read: (context: ProviderContext) => Promise<ProviderResult<{ readonly identity: BuildIdentity }>>;
}

/** Moves to a screen. `target` is project-defined: a URL, a deep link or a script id. Proposal. */
export interface NavigationContext extends CheckpointContext {
  readonly target: string;
}

export interface Navigator {
  readonly navigate: (context: NavigationContext) => Promise<ProviderResult>;
}

/** Waits until the screen may be captured; resolves a failure on timeout. Proposal. */
export interface ReadyContext extends CheckpointContext {
  readonly timeoutMs: number;
}

export interface ReadySignal {
  readonly waitUntilReady: (context: ReadyContext) => Promise<ProviderResult>;
}

/** Per-platform identifier of one logical element (`data-testid`, `testID`, accessibility id). */
export type PlatformLocators = Readonly<Partial<Record<Platform, string>>>;

/** Logical element id (e.g. `checkout-form.submit`) to per-platform identifiers. Proposal. */
export type LocatorMap = Readonly<Record<string, PlatformLocators>>;

export type LocatorResolution =
  | { readonly ok: true; readonly locator: string }
  | { readonly ok: false; readonly reason: 'unknown_locator' | 'locator_missing_for_platform' };

/** Resolves a logical id for one platform. Inherited object keys are never ids. */
export function resolveLocator(map: LocatorMap, logicalId: string, platform: Platform): LocatorResolution {
  if (!Object.hasOwn(map, logicalId)) {
    return { ok: false, reason: 'unknown_locator' };
  }
  const locators = map[logicalId];
  const locator = locators !== undefined && Object.hasOwn(locators, platform) ? locators[platform] : undefined;
  return locator === undefined ? { ok: false, reason: 'locator_missing_for_platform' } : { ok: true, locator };
}

/** Every provider is optional; a check that needs a missing one is INCONCLUSIVE. */
export interface RetinaProviders {
  readonly auth?: AuthProvider;
  readonly fixture?: FixtureHooks;
  readonly data?: DataProvider;
  readonly env?: EnvOverrides;
  readonly schema?: SchemaValidator;
  readonly buildIdentity?: BuildIdentityProvider;
  readonly navigator?: Navigator;
  readonly ready?: ReadySignal;
  readonly locators?: LocatorMap;
}
