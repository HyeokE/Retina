import { createRequire } from 'node:module';
import os from 'node:os';
import { describeError, failure, type WebAdapterResult } from './result.ts';
import type { BrowserWindow } from './browser-globals.ts';
import type { ResolvedWebSessionOptions, WebSession } from './session.ts';

/** What the page actually reports, next to what the profile asked for. */
export interface MeasuredWebEnvironment {
  readonly cssWidth: number;
  readonly cssHeight: number;
  readonly dpr: number;
  readonly locale: string;
  readonly timezoneId: string;
  readonly colorScheme: 'light' | 'dark';
  readonly reducedMotion: boolean;
  readonly userAgent: string;
}

/** Environment fingerprint for baseline matching (plan 8.2). */
export interface WebEnvironmentFingerprint {
  readonly browser: {
    readonly name: 'chromium';
    readonly version: string;
    readonly headless: true;
    readonly playwrightVersion: string;
  };
  readonly requested: ResolvedWebSessionOptions;
  readonly measured: MeasuredWebEnvironment;
  readonly os: {
    readonly platform: NodeJS.Platform;
    readonly release: string;
    readonly arch: string;
  };
}

function playwrightVersion(): string {
  const require = createRequire(import.meta.url);
  const manifest: unknown = require('playwright/package.json');
  const version = (manifest as { readonly version?: unknown }).version;
  return typeof version === 'string' ? version : 'unknown';
}

async function measure(session: WebSession): Promise<MeasuredWebEnvironment> {
  return session.page.evaluate(() => {
    const view = globalThis as unknown as BrowserWindow;
    return {
      cssWidth: view.innerWidth,
      cssHeight: view.innerHeight,
      dpr: view.devicePixelRatio,
      locale: view.navigator.language,
      timezoneId: Intl.DateTimeFormat().resolvedOptions().timeZone,
      colorScheme: view.matchMedia('(prefers-color-scheme: dark)').matches ? ('dark' as const) : ('light' as const),
      reducedMotion: view.matchMedia('(prefers-reduced-motion: reduce)').matches,
      userAgent: view.navigator.userAgent,
    };
  });
}

/** Reads the fingerprint from a live session. Measure after a navigation so the page has a document. */
export async function readEnvironmentFingerprint(
  session: WebSession,
): Promise<WebAdapterResult<{ readonly fingerprint: WebEnvironmentFingerprint }>> {
  if (session.isDisposed()) return failure('disposed', 'the session was already disposed');
  try {
    const version = session.page.context().browser()?.version() ?? 'unknown';
    const fingerprint: WebEnvironmentFingerprint = {
      browser: { name: 'chromium', version, headless: true, playwrightVersion: playwrightVersion() },
      requested: session.options,
      measured: await measure(session),
      os: { platform: os.platform(), release: os.release(), arch: os.arch() },
    };
    return { ok: true, fingerprint };
  } catch (error) {
    return failure('browser_error', `reading the environment failed: ${describeError(error)}`);
  }
}
