import { createApiServer } from './app.ts';

const DEFAULT_PORT = 4010;

function readPort(raw: string | undefined): number {
  if (raw === undefined || raw === '') return DEFAULT_PORT;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT must be an integer between 1 and 65535, got "${raw}".`);
  }
  return port;
}

const port = readPort(process.env['PORT']);
// Loopback by default. Set HOST=0.0.0.0 to reach the API from a physical device.
const host = process.env['HOST'] ?? '127.0.0.1';
const testMode = process.env['TEST_MODE'] === '1';

const server = createApiServer({ testMode });

server.listen(port, host, () => {
  console.info(`[example-api] listening on http://${host}:${port} (TEST_MODE=${testMode ? '1' : '0'})`);
});

function shutdown(signal: string): void {
  console.info(`[example-api] ${signal} received, closing`);
  server.close(() => process.exit(0));
  server.closeAllConnections();
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
