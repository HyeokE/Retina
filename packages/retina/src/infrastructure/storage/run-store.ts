import { randomBytes, randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import type { RunPlan } from '../../domain/run/plan.ts';
import type { RunResultFile, WriteOutcome } from '../../domain/run/run-retina.ts';

/** `.retina/runs/<runId>/attempt-<n>/` under the project root (implementation contracts, chapter 5). */
export function attemptDir(root: string, runId: string, attempt: number): string {
  return join(root, '.retina', 'runs', runId, `attempt-${attempt}`);
}

/** A sortable, collision-resistant run id, e.g. `20261025T120000123Z-1a2b3c`. */
export function newRunId(now: Date): string {
  return `${now.toISOString().replace(/[-:.]/g, '')}-${randomBytes(3).toString('hex')}`;
}

function failureReason(error: unknown): string {
  if (error !== null && typeof error === 'object' && 'code' in error && typeof error.code === 'string') {
    return error.code;
  }
  return 'write_failed';
}

/**
 * Writes JSON completely to a temporary file and renames it into place, so a
 * reader never sees a partial file. An existing file is never overwritten.
 */
export async function writeJsonAtomic(file: string, value: unknown, displayRoot: string): Promise<WriteOutcome> {
  const path = relative(displayRoot, file);
  if (existsSync(file)) {
    return { ok: false, path, reason: 'already_exists' };
  }
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await mkdir(dirname(file), { recursive: true });
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' });
    await rename(temporary, file);
    return { ok: true, path };
  } catch (error) {
    await rm(temporary, { force: true });
    return { ok: false, path, reason: failureReason(error) };
  }
}

export interface RunStore {
  writePlan(plan: RunPlan): Promise<WriteOutcome>;
  writeResult(result: RunResultFile): Promise<WriteOutcome>;
}

export function createRunStore(root: string): RunStore {
  return {
    writePlan: (plan) => writeJsonAtomic(join(attemptDir(root, plan.runId, plan.attempt), 'plan.json'), plan, root),
    writeResult: (result) => writeJsonAtomic(join(attemptDir(root, result.runId, result.attempt), 'result.json'), result, root),
  };
}
