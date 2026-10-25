#!/usr/bin/env node
// Composition root of the `retina` binary: wires Node I/O and the
// infrastructure adapters into the CLI controller and the run use case.
import { runRetina } from '../domain/run/run-retina.ts';
import { loadConfigFile } from '../infrastructure/config/load-config.ts';
import { readPackageVersion } from '../infrastructure/package-info.ts';
import { createRunStore, newRunId } from '../infrastructure/storage/run-store.ts';
import { runScenarios } from '../infrastructure/vitest/run-scenarios.ts';
import { runCli, type Writer } from './run-cli.ts';

const writer: Writer = {
  out: (line) => process.stdout.write(`${line}\n`),
  err: (line) => process.stderr.write(`${line}\n`),
};

const cwd = process.cwd();
const version = readPackageVersion();
const store = createRunStore(cwd);

const exitCode = await runCli(process.argv.slice(2), {
  writer,
  cwd,
  version,
  run: (request) =>
    runRetina(request, {
      loadConfig: loadConfigFile,
      runScenarios,
      writePlan: store.writePlan,
      writeResult: store.writeResult,
      now: () => new Date(),
      newRunId,
      env: process.env,
      retinaVersion: version,
    }),
});

// Vitest sets process.exitCode for its own verdict; Retina's exit code replaces it.
process.exitCode = exitCode;
