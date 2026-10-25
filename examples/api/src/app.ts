import { createServer, type Server } from 'node:http';
import { createRequestHandler } from './routes.ts';
import { createRunStoreRegistry, type RegistryOptions } from './run-stores.ts';

export interface ApiServerOptions {
  readonly testMode: boolean;
  readonly registry?: RegistryOptions;
}

export function createApiServer({ testMode, registry }: ApiServerOptions): Server {
  const handle = createRequestHandler({ registry: createRunStoreRegistry(registry), testMode });
  return createServer((req, res) => {
    void handle(req, res);
  });
}
