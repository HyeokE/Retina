import type { IncomingMessage, ServerResponse } from 'node:http';
import { RETINA_RUN_HEADER, isValidRetinaRunId, validateProfile } from 'retina-example-shared';
import { RunCapacityError, type RunStoreRegistry } from './run-stores.ts';
import { HttpError, readJsonBody, sendJson, sendNoContent } from './http-utils.ts';

export interface RouteOptions {
  readonly registry: RunStoreRegistry;
  /** Enables the /__test/* endpoints and the X-Retina-Run header. Never enable outside local test runs. */
  readonly testMode: boolean;
}

interface RequestContext {
  readonly req: IncomingMessage;
  readonly res: ServerResponse;
  /** Validated X-Retina-Run value; always undefined outside test mode. */
  readonly runId: string | undefined;
}

type Handler = (context: RequestContext) => Promise<void> | void;

export type RequestHandler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

function buildRoutes({ registry, testMode }: RouteOptions): ReadonlyMap<string, Handler> {
  const routes = new Map<string, Handler>([
    ['GET /profile', ({ res, runId }) => sendJson(res, 200, registry.forRun(runId).read())],
    [
      'PUT /profile',
      async ({ req, res, runId }) => {
        const store = registry.forRun(runId);
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
    ['GET /__test/health', ({ res }) => sendJson(res, 200, { status: 'ok', runStores: registry.size() })],
    // Resets only the store selected by X-Retina-Run (or the default store).
    ['POST /__test/reset', ({ res, runId }) => sendJson(res, 200, registry.forRun(runId).reset())],
    // Releases a run's store so its slot can be reused before the idle TTL.
    [
      'POST /__test/runs/end',
      ({ res, runId }) => {
        if (runId === undefined) {
          throw new HttpError(400, 'run_id_required', `${RETINA_RUN_HEADER} is required to end a run.`);
        }
        sendJson(res, 200, { runId, ended: registry.end(runId) });
      },
    ],
  ]);
}

const RUN_HEADER_KEY = RETINA_RUN_HEADER.toLowerCase();

// Outside test mode the header is ignored entirely and every request uses the
// default store.
function readRunId(req: IncomingMessage, testMode: boolean): string | undefined {
  if (!testMode) return undefined;
  const raw = req.headers[RUN_HEADER_KEY];
  if (raw === undefined) return undefined;
  if (!isValidRetinaRunId(raw)) {
    throw new HttpError(400, 'invalid_run_id', `${RETINA_RUN_HEADER} must match ^[A-Za-z0-9._-]{1,64}$.`);
  }
  return raw;
}

function readPath(req: IncomingMessage): string {
  try {
    return new URL(req.url ?? '/', 'http://localhost').pathname;
  } catch {
    throw new HttpError(400, 'invalid_url', 'The request URL could not be parsed.');
  }
}

function sendError(res: ServerResponse, error: unknown): void {
  if (res.headersSent) {
    res.destroy();
    return;
  }
  if (error instanceof HttpError) {
    sendJson(res, error.status, { error: error.code, message: error.message });
    return;
  }
  if (error instanceof RunCapacityError) {
    sendJson(res, 503, { error: 'run_capacity_exceeded', message: error.message });
    return;
  }
  console.error('[example-api] unexpected error', error);
  sendJson(res, 500, { error: 'internal_error' });
}

/** Never rejects: every failure becomes an HTTP error response. */
export function createRequestHandler(options: RouteOptions): RequestHandler {
  const routes = buildRoutes(options);
  const knownPaths = new Set([...routes.keys()].map((key) => key.split(' ')[1]));

  return async (req, res) => {
    try {
      const method = req.method ?? 'GET';
      if (method === 'OPTIONS') {
        sendNoContent(res);
        return;
      }

      const path = readPath(req);
      const handler = routes.get(`${method} ${path}`);
      if (handler) {
        await handler({ req, res, runId: readRunId(req, options.testMode) });
      } else if (knownPaths.has(path)) {
        sendJson(res, 405, { error: 'method_not_allowed' });
      } else {
        sendJson(res, 404, { error: 'not_found' });
      }
    } catch (error) {
      try {
        sendError(res, error);
      } catch (sendFailure) {
        console.error('[example-api] could not send error response', sendFailure);
        res.destroy();
      }
    }
  };
}
