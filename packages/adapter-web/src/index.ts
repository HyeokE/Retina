// Web adapter (infrastructure): headless Playwright Chromium sessions, ready
// marker, build id, viewport capture, PNG decoding and environment fingerprint.

export type { WebAdapterFailure, WebAdapterFailureCode, WebAdapterResult, WebAdapterSuccess } from './result.ts';
export type {
  ResolvedWebSessionOptions,
  WebColorScheme,
  WebReducedMotion,
  WebSession,
  WebSessionOptions,
  WebViewportSize,
} from './session.ts';
export { launchWebSession } from './session.ts';
export { navigateTo, readBuildId, waitForReady } from './page-actions.ts';
export type { ViewportCapture } from './capture.ts';
export { captureViewport } from './capture.ts';
export { decodePng } from './png.ts';
export type { MeasuredWebEnvironment, WebEnvironmentFingerprint } from './fingerprint.ts';
export { readEnvironmentFingerprint } from './fingerprint.ts';
