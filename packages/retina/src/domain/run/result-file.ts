import type { ConfigIssueCode } from '../../config/types.ts';
import type { RunAggregate } from '../verdict/aggregate.ts';
import type { ExecutionError } from '../verdict/execution-error.ts';
import type { ExitCode } from '../verdict/exit-code.ts';
import type { RunMode, Status } from '../verdict/types.ts';
import type { TestCounts } from './map-outcomes.ts';

export const RESULT_SCHEMA_VERSION = 1;

/**
 * `result.json` (implementation contracts, chapter 5; field names are
 * proposals). Written for every `retina run` that got past argument parsing,
 * including config and selection errors. It holds names and codes, never
 * environment values.
 */
export interface RunResultFile {
  readonly schemaVersion: typeof RESULT_SCHEMA_VERSION;
  readonly schemaStatus: 'proposal';
  readonly runId: string;
  readonly attempt: number;
  readonly retinaVersion: string;
  readonly mode: RunMode;
  readonly startedAt: string;
  readonly finishedAt: string;
  readonly status: Status;
  readonly exitCode: ExitCode;
  /** `unknown` when the run stopped before a plan existed. */
  readonly scope: 'full' | 'partial' | 'unknown';
  /** Only a full `validate` run without acceptances or execution errors. */
  readonly gateEligible: boolean;
  readonly execution: {
    /** `not_started` when no test ran (config, selection or plan errors). */
    readonly state: 'completed' | 'not_started';
    readonly errors: readonly ExecutionError[];
  };
  readonly config: {
    readonly file?: string;
    readonly issues: readonly { readonly path: string; readonly code: ConfigIssueCode }[];
    readonly missingEnv: readonly string[];
  };
  readonly tests?: TestCounts;
  readonly aggregate?: RunAggregate;
}
