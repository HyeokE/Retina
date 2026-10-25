/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string
  readonly VITE_BUILD_ID?: string
  readonly VITE_RETINA_TEST_MODE?: string
}

/** true only when built with VITE_RETINA_TEST_MODE=1 (see vite.config.ts). */
declare const __RETINA_TEST_MODE__: boolean
