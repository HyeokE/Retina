import { describe, expect, it } from 'vitest';
import * as source from '../../src/index.ts';

// Evidence for the workspace resolution rule: with the `retina-source`
// condition enabled in vitest.config.ts, the bare specifier `retina` is the
// same module instance as the TypeScript source, not `dist`.
describe('workspace resolution of "retina"', () => {
  it('resolves the bare specifier to packages/retina/src/index.ts', async () => {
    const viaPackageName: unknown = await import('retina');
    expect(viaPackageName).toBe(source);
  });
});
