import { defineConfig } from 'vitest/config';

// Workspace packages export their TypeScript sources under the
// `retina-source` condition (the published package.json drops it). Vite only
// applies `resolve.conditions` to the client environment; Vitest's node
// environment resolves through the SSR environment, so the condition goes to
// `ssr.resolve` too. Setting conditions replaces Vite's defaults, so they are
// repeated here: client `['module', 'browser', 'development|production']`,
// server `['module', 'node', 'development|production']` and external
// `['node', 'module-sync']` (Vite 8 `defaultClientConditions`,
// `defaultServerConditions`, `defaultExternalConditions`).
const SOURCE_CONDITION = 'retina-source';
const CLIENT_CONDITIONS = [SOURCE_CONDITION, 'module', 'browser', 'development|production'];
const SERVER_CONDITIONS = [SOURCE_CONDITION, 'module', 'node', 'development|production'];
const EXTERNAL_CONDITIONS = [SOURCE_CONDITION, 'node', 'module-sync'];

export default defineConfig({
  resolve: { conditions: CLIENT_CONDITIONS },
  ssr: { resolve: { conditions: SERVER_CONDITIONS, externalConditions: EXTERNAL_CONDITIONS } },
  test: {
    include: ['packages/*/test/**/*.test.ts', 'examples/*/test/**/*.test.ts'],
    environment: 'node',
    retry: 0,
  },
});
