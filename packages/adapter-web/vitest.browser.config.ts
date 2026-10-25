import { defineConfig } from 'vitest/config';
import rootConfig from '../../vitest.config.ts';

// Browser tests for the web adapter: they launch the Playwright-bundled
// headless Chromium, so they are kept out of the default `bun run test`
// include (`test/**`). Workspace resolution comes from the root config.
const root = new URL('../../', import.meta.url).pathname;

export default defineConfig({
  ...rootConfig,
  root,
  test: {
    ...rootConfig.test,
    include: ['packages/adapter-web/test-browser/**/*.test.ts'],
    fileParallelism: false,
    maxWorkers: 1,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
