import type { IncomingMessage, ServerResponse } from 'node:http';
import { RETINA_RUN_HEADER, isValidRetinaRunId, validateProfile } from 'retina-example-shared';
import type { ProfileStore } from './profile-store.ts';
import type { RunStoreRegistry } from './run-stores.ts';
import { HttpError, readJsonBody, sendJson, sendNoContent } from './http-utils.ts';

export interface RouteOptions {
  readonly registry: RunStoreRegistry;
  /** Enables the /__test/* endpoints and the X-Retina-Run header. Never enable outside local test runs. */
  readonly testMode: boolean;
}

type Handler = (req: IncomingMessage, res: ServerResponse, store: ProfileStore) => Promise<void> | void;

function buildRoutes({ registry, testMode }: RouteOptions): ReadonlyMap<string, Handler> {
  const routes = new Map<string, Handler>([
    ['GET /profile', (_req, res, store) => sendJson(res, 200, store.read())],
    [
      'PUT /profile',
      async (req, res, store) => {
        const result = validateProfile(await readJsonBody(req));
        if (!result.ok) {
          sendJson(res, 400, { error: 'validation_failed', fieldErrors: result.fieldErrors });
          return;
        }
        sendJson(res, 200, store.write(result.profile));
      },
    ],
  ]);

  if (!testMode) return routes;

  return new Map<string, Handler>([
    ...routes,
    ['GET /__test/health', (_req, res) => sendJson(res, 200, { status: 'ok', runStores: registry.size() })],
    // Resets only the store selected by X-Retina-Run (or the default store).
    ['POST /__test/reset', (_req, res, store) => sendJson(res, 200, store.reset())],
  ]);
}

const RUN_HEADER_KEY = RETINA_RUN_HEADER.toLowerCase();

// Outside test mode the header is ignored entirely and every request uses the
// default store.
function resolveStore(req: IncomingMessage, { registry, testMode }: RouteOptions): ProfileStore {
  if (!testMode) return registry.forRun(undefined);
  const raw = req.headers[RUN_HEADER_KEY];
  if (raw === undefined) return registry.forRun(undefined);
  if (!isValidRetinaRunId(raw)) {
    throw new HttpError(400, 'invalid_run_id', `${RETINA_RUN_HEADER} must match ^[A-Za-z0-9._-]{1,64}$.`);
  }
  return registry.forRun(raw);
}

export function createRequestHandler(options: RouteOptions): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  const routes = buildRoutes(options);
  const knownPaths = new Set([...routes.keys()].map((key) => key.split(' ')[1]));

  return async (req, res) => {
    const method = req.method ?? 'GET';
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;

    if (method === 'OPTIONS') {
      sendNoContent(res);
      return;
    }

    const handler = routes.get(`${method} ${path}`);
    try {
      if (handler) {
        await handler(req, res, resolveStore(req, options));
      } else if (knownPaths.has(path)) {
        sendJson(res, 405, { error: 'method_not_allowed' });
      } else {
        sendJson(res, 404, { error: 'not_found' });
      }
    } catch (error) {
      if (error instanceof HttpError) {
        sendJson(res, error.status, { error: error.code, message: error.message });
        return;
      }
      console.error('[example-api] unexpected error', error);
      sendJson(res, 500, { error: 'internal_error' });
    }
  };
}
