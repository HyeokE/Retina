import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { describeError, failure, isTimeoutError, type WebAdapterResult } from './result.ts';

export type WebColorScheme = 'light' | 'dark';
export type WebReducedMotion = 'reduce' | 'no-preference';

export interface WebViewportSize {
  readonly width: number;
  readonly height: number;
}

/** One web profile. Every field that affects pixels has an explicit default. */
export interface WebSessionOptions {
  readonly viewport: WebViewportSize;
  /** Default 1. */
  readonly deviceScaleFactor?: number;
  /** Default false. */
  readonly isMobile?: boolean;
  /** Default false. */
  readonly hasTouch?: boolean;
  /** Default `en-US`. */
  readonly locale?: string;
  /** IANA zone. Default `UTC`. */
  readonly timezoneId?: string;
  /** Default `light`. */
  readonly colorScheme?: WebColorScheme;
  /** Default `reduce`. */
  readonly reducedMotion?: WebReducedMotion;
  /** Browser launch budget. Default 30 000 ms. */
  readonly launchTimeoutMs?: number;
}

export interface ResolvedWebSessionOptions {
  readonly viewport: WebViewportSize;
  readonly deviceScaleFactor: number;
  readonly isMobile: boolean;
  readonly hasTouch: boolean;
  readonly locale: string;
  readonly timezoneId: string;
  readonly colorScheme: WebColorScheme;
  readonly reducedMotion: WebReducedMotion;
}

/**
 * A headless Chromium with exactly one fresh browser context and one page.
 * The context has no storage state and no persistent profile, so sessions
 * never share cookies, storage or cache.
 */
export interface WebSession {
  readonly options: ResolvedWebSessionOptions;
  /** The page under test, for scenario steps (fill, click, read text). */
  readonly page: Page;
  readonly isDisposed: () => boolean;
  /** Closes the context and the browser. Idempotent; never rejects. */
  readonly dispose: () => Promise<void>;
}

const DEFAULT_LAUNCH_TIMEOUT_MS = 30_000;

function resolveOptions(options: WebSessionOptions): ResolvedWebSessionOptions {
  return {
    viewport: { width: options.viewport.width, height: options.viewport.height },
    deviceScaleFactor: options.deviceScaleFactor ?? 1,
    isMobile: options.isMobile ?? false,
    hasTouch: options.hasTouch ?? false,
    locale: options.locale ?? 'en-US',
    timezoneId: options.timezoneId ?? 'UTC',
    colorScheme: options.colorScheme ?? 'light',
    reducedMotion: options.reducedMotion ?? 'reduce',
  };
}

function isPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function validateOptions(options: ResolvedWebSessionOptions, launchTimeoutMs: number): string | undefined {
  if (!isPositiveInteger(options.viewport.width) || !isPositiveInteger(options.viewport.height)) {
    return 'viewport width and height must be positive integers';
  }
  if (!(Number.isFinite(options.deviceScaleFactor) && options.deviceScaleFactor > 0)) {
    return 'deviceScaleFactor must be a positive number';
  }
  if (!(Number.isFinite(launchTimeoutMs) && launchTimeoutMs > 0)) {
    return 'launchTimeoutMs must be a positive number';
  }
  return undefined;
}

async function closeQuietly(target: { close: () => Promise<void> } | undefined): Promise<void> {
  try {
    await target?.close();
  } catch {
    // Already closed or crashed; nothing left to release.
  }
}

async function openContext(browser: Browser, options: ResolvedWebSessionOptions): Promise<BrowserContext> {
  return browser.newContext({
    viewport: options.viewport,
    deviceScaleFactor: options.deviceScaleFactor,
    isMobile: options.isMobile,
    hasTouch: options.hasTouch,
    locale: options.locale,
    timezoneId: options.timezoneId,
    colorScheme: options.colorScheme,
    reducedMotion: options.reducedMotion,
    serviceWorkers: 'block',
    acceptDownloads: false,
  });
}

function createSession(browser: Browser, context: BrowserContext, page: Page, options: ResolvedWebSessionOptions): WebSession {
  let disposing: Promise<void> | undefined;
  const dispose = (): Promise<void> => {
    disposing ??= (async () => {
      await closeQuietly(context);
      await closeQuietly(browser);
    })();
    return disposing;
  };
  return { options, page, isDisposed: () => disposing !== undefined, dispose };
}

/**
 * Launches the Playwright-bundled Chromium in headless mode (never a system
 * Chrome channel, user profile or headed window) and opens one isolated
 * context for the profile. Returns a typed failure instead of throwing.
 */
export async function launchWebSession(input: WebSessionOptions): Promise<WebAdapterResult<{ readonly session: WebSession }>> {
  const options = resolveOptions(input);
  const launchTimeoutMs = input.launchTimeoutMs ?? DEFAULT_LAUNCH_TIMEOUT_MS;
  const invalid = validateOptions(options, launchTimeoutMs);
  if (invalid !== undefined) {
    return failure('invalid_input', invalid);
  }
  let browser: Browser | undefined;
  try {
    browser = await chromium.launch({ headless: true, timeout: launchTimeoutMs });
    const context = await openContext(browser, options);
    const page = await context.newPage();
    return { ok: true, session: createSession(browser, context, page, options) };
  } catch (error) {
    await closeQuietly(browser);
    const code = isTimeoutError(error) ? 'timeout' : 'launch_failed';
    return failure(code, `could not start headless Chromium: ${describeError(error)}`);
  }
}
