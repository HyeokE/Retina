// Public API: verdict model, aggregation, exit codes, pixel comparison and config.

export type {
  Acceptance,
  CaseResult,
  CheckKind,
  CheckResult,
  ImageHashes,
  Platform,
  RequiredCase,
  RunMode,
  Status,
  VerdictReason,
} from './domain/verdict/types.ts';
export { CHECK_KINDS, KNOWN_PLATFORMS, STATUSES, VERDICT_REASONS } from './domain/verdict/types.ts';
export { caseStatus, mergeStatus, STATUS_SEVERITY_ORDER, worstStatus } from './domain/verdict/status.ts';
export type { ResolvedCase } from './domain/verdict/resolve-case.ts';
export { resolveCase } from './domain/verdict/resolve-case.ts';
export type {
  ExecutionError,
  ExecutionErrorCause,
  ExecutionErrorCode,
  ExecutionErrorLocation,
} from './domain/verdict/execution-error.ts';
export { executionError } from './domain/verdict/execution-error.ts';
export type {
  AggregateInput,
  MissingCase,
  PlatformCoverage,
  RunAggregate,
  RunOutcome,
  RunScope,
} from './domain/verdict/aggregate.ts';
export { aggregateRun } from './domain/verdict/aggregate.ts';
export type { ExitCode } from './domain/verdict/exit-code.ts';
export { EXIT_CODES, exitCodeFor } from './domain/verdict/exit-code.ts';
export type {
  CaseReview,
  ReviewMergeContext,
  ReviewMergeOutcome,
  ReviewRejectionCode,
} from './domain/verdict/review-merge.ts';
export { mergeReview } from './domain/verdict/review-merge.ts';

export type { InvalidInput, Rect, RgbaImage, Size } from './domain/compare/types.ts';
export type { RgbaTuple } from './domain/compare/color-distance.ts';
export { COLOR_DISTANCE_FORMULA, colorDistance } from './domain/compare/color-distance.ts';
export type {
  CompareOptions,
  CompareOutcome,
  CompareThresholds,
  NothingCompared,
  PixelComparison,
  SizeMismatch,
} from './domain/compare/compare-pixels.ts';
export { comparePixels } from './domain/compare/compare-pixels.ts';
export type { DiffRegion, DiffRegionList, DiffRegionOptions, DiffRegionsOutcome } from './domain/compare/diff-regions.ts';
export { diffRegions } from './domain/compare/diff-regions.ts';

// Public config API: retina.config.ts shape, validation and provider contracts (proposals).

export type {
  AndroidDevice,
  AndroidProfile,
  ColorScheme,
  ConfigIssue,
  ConfigIssueCode,
  ConfigValidation,
  DesignConfig,
  DesignFrame,
  IosDevice,
  IosProfile,
  Profile,
  ReportConfig,
  ReportOpen,
  RequiredCaseConfig,
  RetinaConfig,
  ValidatedConfig,
  WebProfile,
  WebViewport,
} from './config/types.ts';
export { REPORT_OPEN_VALUES } from './config/types.ts';
export { defineConfig } from './config/define-config.ts';
export { validateConfig } from './config/validate-config.ts';
export type { FigmaFrameRef, FigmaUrlErrorCode } from './config/figma-url.ts';
export { parseFigmaFrameUrl } from './config/figma-url.ts';
export { checkRequiredEnv, isValidEnvName } from './config/required-env.ts';
export type {
  ProviderBlocked,
  ProviderFailure,
  ProviderFailureStatus,
  ProviderName,
  ProviderOutcome,
  ProviderProceed,
  ProviderReason,
  ProviderResult,
  ProviderSuccess,
  ProviderTimeLimit,
} from './config/provider-result.ts';
export {
  PROVIDER_FAILURE_STATUS,
  PROVIDER_NAMES,
  PROVIDER_REASONS,
  providerBlockedCheck,
  providerBlockedError,
  providerOutcome,
  runProvider,
} from './config/provider-result.ts';
export type {
  AuthProvider,
  BuildIdentity,
  BuildIdentityProvider,
  CheckpointContext,
  DataProvider,
  EnvOverrides,
  EnvOverrideValues,
  FixtureContext,
  FixtureHooks,
  JsonValue,
  LocatorMap,
  LocatorResolution,
  NavigationContext,
  Navigator,
  PlatformLocators,
  ProviderContext,
  ReadyContext,
  ReadySignal,
  RetinaProviders,
  SchemaIssue,
  SchemaSubject,
  SchemaValidator,
} from './config/providers.ts';
export { resolveLocator } from './config/providers.ts';

// Scenario helpers: a scenario test declares and records its Retina case in
// Vitest task meta; `retina run` reads it back through its reporter.

export type { ScenarioContext } from './infrastructure/vitest/record-case.ts';
export { declareCase, recordCase } from './infrastructure/vitest/record-case.ts';
export type { CaseIdentity } from './domain/run/case-shape.ts';

// Files written by `retina run` (proposals).

export type {
  ExclusionReason,
  PlanExclusions,
  PlannedProfile,
  PlannedRequiredCase,
  RunPlan,
  RunSelection,
} from './domain/run/plan.ts';
export type { RunResultFile } from './domain/run/result-file.ts';
export type { TestCounts } from './domain/run/map-outcomes.ts';
export { RUN_REASONS } from './domain/run/map-outcomes.ts';
