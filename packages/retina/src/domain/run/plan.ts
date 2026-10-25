import type { RequiredCaseConfig, ValidatedConfig } from '../../config/types.ts';
import { executionError, type ExecutionError } from '../verdict/execution-error.ts';
import type { CheckKind, Platform, RequiredCase, RunMode } from '../verdict/types.ts';

/*
 * The run plan written to `plan.json` before any test runs (implementation
 * contracts, chapter 2). Field names are proposals; `schemaStatus` says so in
 * the file itself.
 */

export const PLAN_SCHEMA_VERSION = 1;

/** CLI selection. Empty lists mean "no filter". */
export interface RunSelection {
  readonly mode: RunMode;
  readonly platforms: readonly Platform[];
  readonly profiles: readonly string[];
}

export interface PlanContext {
  readonly runId: string;
  readonly createdAt: string;
  readonly retinaVersion: string;
  /** Only presence is read; values never enter the plan. */
  readonly env: Readonly<Record<string, string | undefined>>;
}

export interface PlannedProfile {
  readonly id: string;
  readonly platform: Platform;
}

export interface PlannedRequiredCase {
  readonly caseId: string;
  readonly platform: Platform;
  readonly profile?: string;
  readonly expectedChecks: readonly CheckKind[];
}

export type ExclusionReason = 'not_selected' | 'platform_not_selected' | 'profile_not_selected';

export interface PlanExclusions {
  readonly profiles: readonly (PlannedProfile & { readonly reason: 'not_selected' })[];
  readonly requiredCases: readonly {
    readonly caseId: string;
    readonly platform: Platform;
    readonly reason: 'platform_not_selected' | 'profile_not_selected';
  }[];
}

export interface RunPlan {
  readonly schemaVersion: typeof PLAN_SCHEMA_VERSION;
  readonly schemaStatus: 'proposal';
  readonly runId: string;
  readonly attempt: number;
  readonly createdAt: string;
  readonly retinaVersion: string;
  readonly mode: RunMode;
  /** `partial` whenever a CLI filter left out a configured profile. Never gate eligible. */
  readonly scope: 'full' | 'partial';
  readonly projectPlatforms: readonly Platform[];
  readonly declaredPlatforms: readonly Platform[];
  readonly selectedProfiles: readonly PlannedProfile[];
  /** Required cases expected in this run, with their expected check kinds. */
  readonly requiredCases: readonly PlannedRequiredCase[];
  readonly excluded: PlanExclusions;
  readonly scenarios: readonly string[];
  readonly requiredEnv: readonly { readonly name: string; readonly present: boolean }[];
}

export type PlanResult = { readonly ok: true; readonly plan: RunPlan } | { readonly ok: false; readonly errors: readonly ExecutionError[] };

function unique<T>(values: readonly T[]): readonly T[] {
  return [...new Set(values)];
}

function selectionError(reason: string, message: string, platform?: Platform): ExecutionError {
  return executionError('selection_error', message, platform !== undefined ? { platform } : {}, { reason });
}

function profileErrors(all: readonly PlannedProfile[], selection: RunSelection): readonly ExecutionError[] {
  const byId = new Map(all.map((profile) => [profile.id, profile] as const));
  return selection.profiles.flatMap((id) => {
    const profile = byId.get(id);
    if (profile === undefined) {
      return [selectionError('unknown_profile', `Profile "${id}" is not configured.`)];
    }
    return selection.platforms.length > 0 && !selection.platforms.includes(profile.platform)
      ? [selectionError('profile_platform_conflict', `Profile "${id}" is not on a selected platform.`, profile.platform)]
      : [];
  });
}

function pickProfiles(all: readonly PlannedProfile[], selection: RunSelection): readonly PlannedProfile[] {
  if (selection.profiles.length > 0) {
    return all.filter((profile) => selection.profiles.includes(profile.id));
  }
  return selection.platforms.length > 0 ? all.filter((profile) => selection.platforms.includes(profile.platform)) : all;
}

function emptyPlatformErrors(selected: readonly PlannedProfile[], selection: RunSelection): readonly ExecutionError[] {
  return unique(selection.platforms)
    .filter((platform) => !selected.some((profile) => profile.platform === platform))
    .map((platform) =>
      selectionError('platform_without_profiles', `Platform "${platform}" has no selected profile.`, platform),
    );
}

function exclusionReason(entry: RequiredCaseConfig, selected: readonly PlannedProfile[]): ExclusionReason | undefined {
  if (!selected.some((profile) => profile.platform === entry.platform)) {
    return 'platform_not_selected';
  }
  if (entry.profile !== undefined && !selected.some((profile) => profile.id === entry.profile)) {
    return 'profile_not_selected';
  }
  return undefined;
}

function plannedCase(entry: RequiredCaseConfig): PlannedRequiredCase {
  return {
    caseId: entry.caseId,
    platform: entry.platform,
    ...(entry.profile !== undefined ? { profile: entry.profile } : {}),
    expectedChecks: [...entry.expectedChecks],
  };
}

function splitRequired(
  required: readonly RequiredCaseConfig[],
  selected: readonly PlannedProfile[],
): Pick<RunPlan, 'requiredCases'> & { readonly excluded: PlanExclusions['requiredCases'] } {
  const withReason = required.map((entry) => ({ entry, reason: exclusionReason(entry, selected) }));
  return {
    requiredCases: withReason.filter((item) => item.reason === undefined).map((item) => plannedCase(item.entry)),
    excluded: withReason.flatMap(({ entry, reason }) =>
      reason === 'platform_not_selected' || reason === 'profile_not_selected'
        ? [{ caseId: entry.caseId, platform: entry.platform, reason }]
        : [],
    ),
  };
}

function envPresence(names: readonly string[], env: PlanContext['env']): RunPlan['requiredEnv'] {
  return unique(names).map((name) => ({ name, present: typeof env[name] === 'string' && env[name] !== '' }));
}

/**
 * Builds the run plan from a validated config and the CLI selection. Unknown
 * profiles, a profile outside the selected platforms and a selected platform
 * without profiles are `selection_error` execution errors.
 */
export function buildRunPlan(config: ValidatedConfig, selection: RunSelection, context: PlanContext): PlanResult {
  const all = Object.entries(config.profiles).map(([id, profile]) => ({ id, platform: profile.platform }));
  const selected = pickProfiles(all, selection);
  // A bad profile name explains an empty platform too, so report it alone.
  const badProfiles = profileErrors(all, selection);
  const errors = badProfiles.length > 0 ? badProfiles : emptyPlatformErrors(selected, selection);
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  const required = splitRequired(config.required ?? [], selected);
  return {
    ok: true,
    plan: {
      schemaVersion: PLAN_SCHEMA_VERSION,
      schemaStatus: 'proposal',
      runId: context.runId,
      attempt: 1,
      createdAt: context.createdAt,
      retinaVersion: context.retinaVersion,
      mode: selection.mode,
      scope: selected.length === all.length ? 'full' : 'partial',
      projectPlatforms: unique(all.map((profile) => profile.platform)),
      declaredPlatforms: unique(selected.map((profile) => profile.platform)),
      selectedProfiles: selected,
      requiredCases: required.requiredCases,
      excluded: {
        profiles: all.filter((profile) => !selected.includes(profile)).map((profile) => ({ ...profile, reason: 'not_selected' })),
        requiredCases: required.excluded,
      },
      scenarios: [...config.scenarios],
      requiredEnv: envPresence(config.requiredEnv ?? [], context.env),
    },
  };
}

/** The aggregate's view of the plan's required cases. */
export function planRequiredCases(plan: RunPlan): readonly RequiredCase[] {
  return plan.requiredCases.map((entry) => ({ caseId: entry.caseId, platform: entry.platform, expectedChecks: entry.expectedChecks }));
}
