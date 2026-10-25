import type { RunnerReport } from '../../domain/run/test-outcome.ts';
import { createCollector } from './collector.ts';

export interface ScenarioRun {
  readonly root: string;
  readonly include: readonly string[];
}

function errorName(error: unknown): string {
  return error instanceof Error ? error.name : 'unknown';
}

/**
 * Runs the scenario files with Vitest's Node API. Retina owns the test
 * config: no vitest.config file is loaded (`config: false`), retries are 0,
 * zero test files are not a pass, and files run one at a time (one worker per
 * device or browser, plan 5.1). Vitest's own output goes to stderr so stdout
 * carries only Retina's summary. `vitest/node` is imported lazily, so the
 * package entry point never loads Vitest.
 */
export async function runScenarios(run: ScenarioRun): Promise<RunnerReport> {
  const collector = createCollector();
  try {
    const { startVitest } = await import('vitest/node');
    await startVitest(
      [],
      {
        root: run.root,
        config: false,
        include: [...run.include],
        exclude: ['**/node_modules/**', '**/.git/**', '**/.retina/**'],
        watch: false,
        run: true,
        retry: 0,
        passWithNoTests: false,
        fileParallelism: false,
        maxWorkers: 1,
        reporters: ['default', collector.reporter],
      },
      {},
      { stdout: process.stderr, stderr: process.stderr },
    );
    return collector.report();
  } catch (error) {
    return collector.report(errorName(error));
  }
}
