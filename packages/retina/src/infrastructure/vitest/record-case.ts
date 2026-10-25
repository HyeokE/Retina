import { parseCaseIdentity, parseCaseResult, type CaseIdentity } from '../../domain/run/case-shape.ts';
import { RETINA_META_KEY, RETINA_META_VERSION } from '../../domain/run/test-outcome.ts';
import type { CaseResult } from '../../domain/verdict/types.ts';

/**
 * The part of a Vitest test context the helpers need. Structural on purpose:
 * Retina does not augment Vitest's `TaskMeta` type (see the Vitest
 * compatibility report), so the meta write is cast inside this module only.
 */
export interface ScenarioContext {
  readonly task: { readonly meta: object };
}

type MetaRecord = Record<string, unknown>;

interface StoredMeta {
  readonly version: typeof RETINA_META_VERSION;
  readonly declared?: CaseIdentity;
  readonly result?: CaseResult;
}

function metaOf(context: ScenarioContext): MetaRecord {
  return context.task.meta as MetaRecord;
}

function storedOf(context: ScenarioContext): StoredMeta | undefined {
  return metaOf(context)[RETINA_META_KEY] as StoredMeta | undefined;
}

function sameIdentity(a: CaseIdentity, b: CaseIdentity): boolean {
  return a.caseId === b.caseId && a.platform === b.platform && a.profile === b.profile;
}

function store(context: ScenarioContext, value: StoredMeta): void {
  // Vitest's task meta is the one mutable channel from a test to reporters.
  metaOf(context)[RETINA_META_KEY] = Object.freeze(value);
}

/**
 * Declares which Retina case this test stands for, before any check runs.
 * If the test then fails, Retina reports a FAIL `functional` check for this
 * case instead of an unattributed failure.
 */
export function declareCase(context: ScenarioContext, identity: CaseIdentity): void {
  const parsed = parseCaseIdentity(identity);
  if (!parsed.ok) {
    throw new TypeError(`declareCase: ${parsed.problems.join('; ')}`);
  }
  const stored = storedOf(context);
  if (stored !== undefined) {
    throw new TypeError('declareCase: this test already declared or recorded a Retina case');
  }
  store(context, { version: RETINA_META_VERSION, declared: parsed.value });
}

/**
 * Records the case result of this test. One case per test; a declared case
 * must keep its identity. Throws a `TypeError` for an invalid shape, which
 * fails the test.
 */
export function recordCase(context: ScenarioContext, result: CaseResult): void {
  const parsed = parseCaseResult(result);
  if (!parsed.ok) {
    throw new TypeError(`recordCase: ${parsed.problems.join('; ')}`);
  }
  const stored = storedOf(context);
  if (stored?.result !== undefined) {
    throw new TypeError('recordCase: this test already recorded a Retina case');
  }
  if (stored?.declared !== undefined && !sameIdentity(stored.declared, parsed.value)) {
    throw new TypeError('recordCase: the result does not match the declared case');
  }
  store(context, { version: RETINA_META_VERSION, ...(stored?.declared ? { declared: stored.declared } : {}), result: parsed.value });
}
