import { defineConfig } from 'vitest/config';
import workspaceConfig from '../../../vitest.config.ts';

// Retina scenarios for the web example. They start the example API and a
// `vite preview` server and drive headless Chromium, so they run on their own
// (`bun run example:web:scenario`) instead of in the default unit test run.
// Only module resolution (`resolve`, `ssr`) is taken from the workspace config,
// so workspace packages resolve the same way as in the unit test run.
export default defineConfig({
  ...(workspaceConfig.resolve === undefined ? {} : { resolve: workspaceConfig.resolve }),
  ...(workspaceConfig.ssr === undefined ? {} : { ssr: workspaceConfig.ssr }),
  root: new URL('../', import.meta.url).pathname,
  test: {
    include: ['retina/scenarios/**/*.test.ts'],
    environment: 'node',
    retry: 0,
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 180_000,
    hookTimeout: 180_000,
  },
});
