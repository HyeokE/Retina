import type { RetinaConfig } from './types.ts';

/** Identity function that types a `retina.config.ts`. It does not validate; see `validateConfig`. */
export function defineConfig(config: RetinaConfig): RetinaConfig {
  return config;
}
