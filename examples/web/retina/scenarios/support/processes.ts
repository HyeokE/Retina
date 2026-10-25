import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';

/** A process this scenario started. Only these PIDs are ever stopped. */
export interface OwnedProcess {
  readonly name: string;
  readonly pid: number;
  readonly startedAt: string;
  /** Resolves with the exit code (or the signal name) once the process is gone. */
  readonly exited: Promise<number | string>;
  readonly hasExited: () => boolean;
  /** Last output lines, for failure messages. */
  readonly output: () => string;
}

export interface SpawnOptions {
  readonly cwd: string;
  readonly env: NodeJS.ProcessEnv;
}

const OUTPUT_LIMIT = 16_000;

function collectOutput(child: ChildProcess): () => string {
  let buffer = '';
  const append = (chunk: Buffer): void => {
    buffer = (buffer + chunk.toString('utf8')).slice(-OUTPUT_LIMIT);
  };
  child.stdout?.on('data', append);
  child.stderr?.on('data', append);
  return () => buffer;
}

function watchExit(child: ChildProcess): { readonly exited: Promise<number | string>; readonly hasExited: () => boolean } {
  let done = false;
  const exited = new Promise<number | string>((resolve) => {
    child.once('exit', (code, signal) => {
      done = true;
      resolve(code ?? signal ?? 'unknown');
    });
    child.once('error', () => {
      done = true;
      resolve('spawn_error');
    });
  });
  return { exited, hasExited: () => done };
}

/**
 * Starts `command` directly (no shell), so the recorded PID is the server
 * itself and not a wrapper whose children could outlive it.
 */
export function startOwned(name: string, command: string, args: readonly string[], options: SpawnOptions): OwnedProcess {
  const child = spawn(command, args, { cwd: options.cwd, env: options.env, stdio: ['ignore', 'pipe', 'pipe'] });
  if (child.pid === undefined) {
    throw new Error(`could not start ${name}`);
  }
  const { exited, hasExited } = watchExit(child);
  return { name, pid: child.pid, startedAt: new Date().toISOString(), exited, hasExited, output: collectOutput(child) };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function signalPid(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(pid, signal);
  } catch {
    // ESRCH: already gone.
  }
}

/** SIGTERM, then SIGKILL after `graceMs`. Resolves with how the process ended. */
export async function stopOwned(owned: OwnedProcess, graceMs = 5_000): Promise<number | string> {
  if (owned.hasExited()) return owned.exited;
  signalPid(owned.pid, 'SIGTERM');
  const result = await Promise.race([owned.exited, delay(graceMs).then(() => undefined)]);
  if (result !== undefined) return result;
  signalPid(owned.pid, 'SIGKILL');
  return owned.exited;
}

export function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Runs a command to completion within `timeoutMs`; the process is killed on timeout. */
export async function runToCompletion(
  name: string,
  command: string,
  args: readonly string[],
  options: SpawnOptions,
  timeoutMs: number,
): Promise<{ readonly exit: number | string; readonly output: string }> {
  const owned = startOwned(name, command, args, options);
  const timer = delay(timeoutMs).then(() => 'timeout' as const);
  const result = await Promise.race([owned.exited, timer]);
  if (result === 'timeout') {
    await stopOwned(owned, 1_000);
    return { exit: 'timeout', output: owned.output() };
  }
  return { exit: result, output: owned.output() };
}

/** A loopback port that was free a moment ago. Servers start with strictPort, so a race fails loudly. */
export async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address !== null ? address.port : 0;
      server.close(() => (port > 0 ? resolve(port) : reject(new Error('no port assigned'))));
    });
  });
}

/** Polls `url` until it answers 2xx. Fails early if `owner` exits first. */
export async function waitForHttp(url: string, owner: OwnedProcess, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (owner.hasExited()) {
      throw new Error(`${owner.name} exited before ${url} answered:\n${owner.output()}`);
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1_000) });
      if (response.ok) return;
    } catch {
      // Not listening yet.
    }
    await delay(100);
  }
  throw new Error(`${url} did not answer within ${timeoutMs} ms:\n${owner.output()}`);
}
