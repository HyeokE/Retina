import { checkRequiredEnv } from '../../config/required-env.ts';
import type { ConfigIssue, ValidatedConfig } from '../../config/types.ts';
import { validateConfig } from '../../config/validate-config.ts';
import { aggregateRun, type RunAggregate } from '../verdict/aggregate.ts';
import { executionError, type ExecutionError } from '../verdict/execution-error.ts';
import { exitCodeFor, EXIT_CODES, type ExitCode } from '../verdict/exit-code.ts';
import { mapRunnerReport, type TestCounts } from './map-outcomes.ts';
import { buildRunPlan, planRequiredCases, type RunPlan, type RunSelection } from './plan.ts';
import { RESULT_SCHEMA_VERSION, type RunResultFile } from './result-file.ts';
import type { RunnerReport } from './test-outcome.ts';

/*
 * The `retina run` use case: load and validate the config, check required
 * env names, fix the plan, run the scenarios, map and aggregate the results,
 * write result.json. All I/O goes through `RunPorts`.
 */

export type { RunResultFile } from './result-file.ts';

export type LoadedConfig =
  | { readonly ok: true; readonly file: string; readonly value: unknown }
  /**
   * `reason` is a code (e.g. `config_not_found`) and `detail` an error code
   * such as `ERR_MODULE_NOT_FOUND`; neither is ever an error message.
   */
  | { readonly ok: false; readonly reason: string; readonly detail?: string; readonly file?: string };

export type WriteOutcome = { readonly ok: true; readonly path: string } | { readonly ok: false; readonly path: string; readonly reason: string };

export interface RunPorts {
  loadConfig(source: { readonly cwd: string; readonly configPath?: string }): Promise<LoadedConfig>;
  runScenarios(input: { readonly root: string; readonly include: readonly string[] }): Promise<RunnerReport>;
  writePlan(plan: RunPlan): Promise<WriteOutcome>;
  writeResult(result: RunResultFile): Promise<WriteOutcome>;
  now(): Date;
  newRunId(now: Date): string;
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly retinaVersion: string;
}

export interface RunRequest {
  readonly cwd: string;
  readonly configPath?: string;
  readonly selection: RunSelection;
}

export interface RunOutcome {
  /** The process exit code: `result.exitCode`, or 2 when result.json could not be written. */
  readonly exitCode: ExitCode;
  readonly result: RunResultFile;
  readonly resultWrite: WriteOutcome;
  readonly planPath?: string;
}

interface RunIdentity {
  readonly runId: string;
  readonly startedAt: string;
  readonly request: RunRequest;
  readonly ports: RunPorts;
}

interface StoppedRun {
  readonly errors: readonly ExecutionError[];
  readonly configFile?: string;
  readonly issues?: readonly ConfigIssue[];
  readonly missingEnv?: readonly string[];
}

interface FinishedRun {
  readonly plan: RunPlan;
  readonly aggregate: RunAggregate;
  readonly counts: TestCounts;
  readonly configFile: string;
}

function baseResult(identity: RunIdentity): Omit<RunResultFile, 'status' | 'exitCode' | 'scope' | 'gateEligible' | 'execution' | 'config'> {
  return {
    schemaVersion: RESULT_SCHEMA_VERSION,
    schemaStatus: 'proposal',
    runId: identity.runId,
    attempt: 1,
    retinaVersion: identity.ports.retinaVersion,
    mode: identity.request.selection.mode,
    startedAt: identity.startedAt,
    finishedAt: identity.ports.now().toISOString(),
  };
}

function stoppedResult(identity: RunIdentity, stopped: StoppedRun): RunResultFile {
  return {
    ...baseResult(identity),
    status: 'INCONCLUSIVE',
    exitCode: EXIT_CODES.executionError,
    scope: 'unknown',
    gateEligible: false,
    execution: { state: 'not_started', errors: stopped.errors },
    config: {
      ...(stopped.configFile !== undefined ? { file: stopped.configFile } : {}),
      issues: (stopped.issues ?? []).map((entry) => ({ path: entry.path, code: entry.code })),
      missingEnv: stopped.missingEnv ?? [],
    },
  };
}

function finishedResult(identity: RunIdentity, run: FinishedRun): RunResultFile {
  return {
    ...baseResult(identity),
    status: run.aggregate.status,
    exitCode: exitCodeFor(run.aggregate),
    scope: run.plan.scope,
    // The aggregate only compares platforms; a profile filter also makes the run partial.
    gateEligible: run.aggregate.gateEligible && run.plan.scope === 'full',
    execution: { state: 'completed', errors: run.aggregate.executionErrors },
    config: { file: run.configFile, issues: [], missingEnv: [] },
    tests: run.counts,
    aggregate: run.aggregate,
  };
}

function configIssueError(entry: ConfigIssue): ExecutionError {
  return executionError('config_error', `Config issue at "${entry.path}": ${entry.code}.`, {}, { reason: entry.code });
}

function missingEnvError(name: string): ExecutionError {
  return executionError('config_error', `Required environment variable "${name}" is not set.`, {}, { reason: 'required_env_missing' });
}

type Prepared = { readonly ok: true; readonly config: ValidatedConfig; readonly file: string } | { readonly ok: false; readonly stopped: StoppedRun };

async function prepareConfig(identity: RunIdentity): Promise<Prepared> {
  const { request, ports } = identity;
  const loaded = await ports.loadConfig({ cwd: request.cwd, ...(request.configPath !== undefined ? { configPath: request.configPath } : {}) });
  if (!loaded.ok) {
    const detail = loaded.detail !== undefined ? `, ${loaded.detail}` : '';
    const message = `The config could not be loaded (${loaded.reason}${detail}).`;
    const error = executionError('config_error', message, {}, { reason: loaded.reason });
    return { ok: false, stopped: { errors: [error], ...(loaded.file !== undefined ? { configFile: loaded.file } : {}) } };
  }
  const validation = validateConfig(loaded.value);
  if (!validation.ok) {
    return { ok: false, stopped: { errors: validation.issues.map(configIssueError), configFile: loaded.file, issues: validation.issues } };
  }
  const missingEnv = checkRequiredEnv(validation.config.requiredEnv ?? [], ports.env);
  if (missingEnv.length > 0) {
    return { ok: false, stopped: { errors: missingEnv.map(missingEnvError), configFile: loaded.file, missingEnv } };
  }
  return { ok: true, config: validation.config, file: loaded.file };
}

async function runScenariosSafely(ports: RunPorts, plan: RunPlan, root: string): Promise<RunnerReport> {
  try {
    return await ports.runScenarios({ root, include: plan.scenarios });
  } catch (error) {
    const name = error instanceof Error ? error.name : 'unknown';
    return { testFiles: 0, tests: [], moduleProblems: [], unhandledErrors: 0, interrupted: false, startError: name };
  }
}

async function execute(identity: RunIdentity): Promise<{ readonly result: RunResultFile; readonly planPath?: string }> {
  const { request, ports } = identity;
  const prepared = await prepareConfig(identity);
  if (!prepared.ok) {
    return { result: stoppedResult(identity, prepared.stopped) };
  }
  const context = { runId: identity.runId, createdAt: identity.startedAt, retinaVersion: ports.retinaVersion, env: ports.env };
  const planned = buildRunPlan(prepared.config, request.selection, context);
  if (!planned.ok) {
    return { result: stoppedResult(identity, { errors: planned.errors, configFile: prepared.file }) };
  }
  const written = await ports.writePlan(planned.plan);
  if (!written.ok) {
    const error = executionError('artifact_error', `plan.json could not be written (${written.reason}).`, {}, { reason: written.reason });
    return { result: stoppedResult(identity, { errors: [error], configFile: prepared.file }) };
  }
  const mapped = mapRunnerReport(await runScenariosSafely(ports, planned.plan, request.cwd));
  const aggregate = aggregateRun({
    mode: planned.plan.mode,
    declaredPlatforms: planned.plan.declaredPlatforms,
    projectPlatforms: planned.plan.projectPlatforms,
    requiredCases: planRequiredCases(planned.plan),
    results: mapped.results,
    executionErrors: mapped.executionErrors,
  });
  const run = { plan: planned.plan, aggregate, counts: mapped.counts, configFile: prepared.file };
  return { result: finishedResult(identity, run), planPath: written.path };
}

/** Runs one `retina run` and writes result.json. Never throws for user errors. */
export async function runRetina(request: RunRequest, ports: RunPorts): Promise<RunOutcome> {
  const started = ports.now();
  const identity: RunIdentity = { runId: ports.newRunId(started), startedAt: started.toISOString(), request, ports };
  const { result, planPath } = await execute(identity);
  const resultWrite = await ports.writeResult(result);
  return {
    exitCode: resultWrite.ok ? result.exitCode : EXIT_CODES.executionError,
    result,
    resultWrite,
    ...(planPath !== undefined ? { planPath } : {}),
  };
}
