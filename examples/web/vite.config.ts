import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

// Test mode only: exposes the build identity as
// <meta name="retina-build-id" content="..."> so a verification run can prove
// which build it captured. Production builds get no meta tag at all.
function retinaBuildIdMeta(buildId: string): Plugin {
  return {
    name: 'retina-build-id-meta',
    transformIndexHtml: () => [
      { tag: 'meta', attrs: { name: 'retina-build-id', content: buildId }, injectTo: 'head' },
    ],
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_')
  const retinaTestMode = env['VITE_RETINA_TEST_MODE'] === '1'
  const buildId = env['VITE_BUILD_ID'] || 'dev'

  return {
    plugins: [react(), ...(retinaTestMode ? [retinaBuildIdMeta(buildId)] : [])],
    // Replaced textually at every use site with a boolean literal, so the
    // minifier drops test-only branches (and their strings) from production.
    define: { __RETINA_TEST_MODE__: JSON.stringify(retinaTestMode) },
    // Fixed ports so automation can rely on stable URLs; fail instead of drifting.
    server: { port: 5173, strictPort: true },
    preview: { port: 4173, strictPort: true },
  }
})
