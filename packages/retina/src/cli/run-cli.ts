import type { RunOutcome, RunRequest } from '../domain/run/run-retina.ts';
import { EXIT_CODES } from '../domain/verdict/exit-code.ts';
import { parseCliArgs, USAGE } from './args.ts';
import { formatSummary } from './summary.ts';

/** Where CLI text goes; injected so tests can capture it. */
export interface Writer {
  out(line: string): void;
  err(line: string): void;
}

export interface CliDeps {
  readonly writer: Writer;
  readonly cwd: string;
  readonly version: string;
  run(request: RunRequest): Promise<RunOutcome>;
}

/** The `retina` controller: arguments in, exit code out. */
export async function runCli(argv: readonly string[], deps: CliDeps): Promise<number> {
  const command = parseCliArgs(argv);
  switch (command.kind) {
    case 'version':
      deps.writer.out(deps.version);
      return EXIT_CODES.pass;
    case 'help':
      deps.writer.out(USAGE);
      return EXIT_CODES.pass;
    case 'usage_error':
      deps.writer.err(`retina: ${command.message}`);
      deps.writer.err(USAGE);
      return EXIT_CODES.executionError;
    case 'run': {
      const outcome = await deps.run({
        cwd: deps.cwd,
        selection: command.selection,
        ...(command.configPath !== undefined ? { configPath: command.configPath } : {}),
      });
      const summary = formatSummary(outcome);
      summary.out.forEach((line) => deps.writer.out(line));
      summary.err.forEach((line) => deps.writer.err(line));
      return outcome.exitCode;
    }
  }
}
