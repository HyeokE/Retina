// Public domain API: verdict model, aggregation, exit codes and pixel comparison.

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
export { KNOWN_PLATFORMS, VERDICT_REASONS } from './domain/verdict/types.ts';
export { caseStatus, mergeStatus, STATUS_SEVERITY_ORDER, worstStatus } from './domain/verdict/status.ts';
export type { ResolvedCase } from './domain/verdict/resolve-case.ts';
export { resolveCase } from './domain/verdict/resolve-case.ts';
export type {
  ExecutionError,
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
