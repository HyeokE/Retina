import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { freePort, runToCompletion, startOwned, waitForHttp, type OwnedProcess } from './processes.ts';

const require = createRequire(import.meta.url);

/** examples/web, resolved from this file (retina/scenarios/support). */
export const WEB_DIR = new URL('../../../', import.meta.url).pathname;
const API_ENTRY = new URL('../../../../api/src/server.ts', import.meta.url).pathname;

function viteBin(): string {
  const manifestPath = require.resolve('vite/package.json', { paths: [WEB_DIR] });
  const manifest = require(manifestPath) as { readonly bin?: string | Readonly<Record<string, string>> };
  const bin = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.['vite'];
  if (bin === undefined) throw new Error('vite has no bin entry');
  return join(dirname(manifestPath), bin);
}

export interface ApiServer {
  readonly process: OwnedProcess;
  readonly baseUrl: string;
}

/** Starts the example API with TEST_MODE=1 on a free loopback port. */
export async function startApi(timeoutMs: number): Promise<ApiServer> {
  const port = await freePort();
  const owned = startOwned('example-api', process.execPath, [API_ENTRY], {
    cwd: WEB_DIR,
    env: { ...process.env, TEST_MODE: '1', PORT: String(port), HOST: '127.0.0.1' },
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForHttp(`${baseUrl}/__test/health`, owned, timeoutMs);
  return { process: owned, baseUrl };
}

export interface WebBuild {
  readonly outDir: string;
  readonly buildId: string;
}

/** Builds the web app in test mode, pointed at `apiBaseUrl`, into `outDir`. */
export async function buildWeb(apiBaseUrl: string, outDir: string, buildId: string, timeoutMs: number): Promise<WebBuild> {
  const result = await runToCompletion(
    'vite-build',
    process.execPath,
    [viteBin(), 'build', '--outDir', outDir, '--emptyOutDir'],
    {
      cwd: WEB_DIR,
      env: { ...process.env, VITE_RETINA_TEST_MODE: '1', VITE_API_BASE_URL: apiBaseUrl, VITE_BUILD_ID: buildId },
    },
    timeoutMs,
  );
  if (result.exit !== 0) {
    throw new Error(`vite build failed (${String(result.exit)}):\n${result.output}`);
  }
  return { outDir, buildId };
}

export interface WebServer {
  readonly process: OwnedProcess;
  readonly baseUrl: string;
}

/** Serves `outDir` with `vite preview` on a free loopback port (SPA fallback for /edit). */
export async function startPreview(outDir: string, timeoutMs: number): Promise<WebServer> {
  const port = await freePort();
  const owned = startOwned(
    'vite-preview',
    process.execPath,
    [viteBin(), 'preview', '--outDir', outDir, '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    { cwd: WEB_DIR, env: { ...process.env } },
  );
  const baseUrl = `http://127.0.0.1:${port}`;
  await waitForHttp(`${baseUrl}/`, owned, timeoutMs);
  return { process: owned, baseUrl };
}

/** Calls a test-only API endpoint for one run id. */
export async function testEndpoint(apiBaseUrl: string, path: '/__test/reset' | '/__test/runs/end', runId: string): Promise<void> {
  const response = await fetch(`${apiBaseUrl}${path}`, { method: 'POST', headers: { 'X-Retina-Run': runId } });
  if (!response.ok) {
    throw new Error(`POST ${path} answered HTTP ${response.status}`);
  }
}

export async function readProfile(apiBaseUrl: string, runId?: string): Promise<unknown> {
  const headers: Record<string, string> = runId === undefined ? {} : { 'X-Retina-Run': runId };
  const response = await fetch(`${apiBaseUrl}/profile`, { headers });
  if (!response.ok) throw new Error(`GET /profile answered HTTP ${response.status}`);
  return response.json();
}
