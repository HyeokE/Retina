import type { Server } from 'node:http';
import { connect, type AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { createApiServer, type ApiServerOptions } from '../src/app.ts';

const servers: Server[] = [];

async function start(options: ApiServerOptions): Promise<string> {
  const server = createApiServer(options);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return `127.0.0.1:${port}`;
}

afterEach(async () => {
  const closing = servers.splice(0).map(
    (server) =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  );
  await Promise.all(closing);
});

/** Sends a raw request line that fetch() would refuse to produce. */
function rawRequest(host: string, requestLine: string): Promise<string> {
  const [hostname, port] = host.split(':');
  return new Promise((resolve, reject) => {
    const socket = connect(Number(port), hostname, () => {
      socket.write(`${requestLine}\r\nHost: x\r\nConnection: close\r\n\r\n`);
    });
    let data = '';
    socket.setEncoding('utf8');
    socket.on('data', (chunk) => {
      data += chunk;
    });
    socket.on('end', () => resolve(data));
    socket.on('error', reject);
  });
}

async function call(host: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`http://${host}${path}`, init);
  return { status: response.status, body: (await response.json()) as Record<string, unknown> };
}

const runHeader = (id: string) => ({ 'X-Retina-Run': id });
const json = { 'Content-Type': 'application/json' };

describe('example API request handling', () => {
  it('answers a malformed request URL with 400 and keeps serving', async () => {
    const host = await start({ testMode: true });

    const raw = await rawRequest(host, 'GET //[ HTTP/1.1');
    expect(raw).toMatch(/^HTTP\/1\.1 400/);
    expect(raw).toContain('"error":"invalid_url"');

    const next = await call(host, '/profile');
    expect(next.status).toBe(200);
    expect(next.body['name']).toBe('Alex Kim');
  });

  it('answers OPTIONS with 204 even for an unparsable URL', async () => {
    const host = await start({ testMode: true });
    const raw = await rawRequest(host, 'OPTIONS //[ HTTP/1.1');
    expect(raw).toMatch(/^HTTP\/1\.1 204/);
    expect((await call(host, '/profile')).status).toBe(200);
  });

  it('rejects a new run with 503 when every slot is active, without resetting existing runs', async () => {
    const host = await start({ testMode: true, registry: { maxRuns: 1, idleTtlMs: 60_000 } });
    const saved = await call(host, '/profile', {
      method: 'PUT',
      headers: { ...json, ...runHeader('active-a') },
      body: JSON.stringify({ name: 'Active Run', email: 'active@example.com', city: '' }),
    });
    expect(saved.status).toBe(200);

    const rejected = await call(host, '/profile', { headers: runHeader('newcomer') });
    expect(rejected.status).toBe(503);
    expect(rejected.body['error']).toBe('run_capacity_exceeded');

    const kept = await call(host, '/profile', { headers: runHeader('active-a') });
    expect(kept.body['name']).toBe('Active Run');
  });

  it('POST /__test/runs/end releases a run and requires the header', async () => {
    const host = await start({ testMode: true, registry: { maxRuns: 1, idleTtlMs: 60_000 } });
    await call(host, '/profile', { headers: runHeader('run-a') });

    const missing = await call(host, '/__test/runs/end', { method: 'POST' });
    expect(missing.status).toBe(400);
    expect(missing.body['error']).toBe('run_id_required');

    const ended = await call(host, '/__test/runs/end', { method: 'POST', headers: runHeader('run-a') });
    expect(ended).toEqual({ status: 200, body: { runId: 'run-a', ended: true } });

    expect((await call(host, '/profile', { headers: runHeader('run-b') })).status).toBe(200);
  });

  it('returns 400 for an invalid run id in test mode', async () => {
    const host = await start({ testMode: true });
    const result = await call(host, '/profile', { headers: runHeader('bad id!') });
    expect(result.status).toBe(400);
    expect(result.body['error']).toBe('invalid_run_id');
  });

  it('ignores the run header and hides /__test/* outside test mode', async () => {
    const host = await start({ testMode: false, registry: { maxRuns: 1 } });
    expect((await call(host, '/profile', { headers: runHeader('bad id!') })).status).toBe(200);
    expect((await call(host, '/__test/runs/end', { method: 'POST', headers: runHeader('run-a') })).status).toBe(404);
    expect((await call(host, '/__test/health')).status).toBe(404);
  });
});
