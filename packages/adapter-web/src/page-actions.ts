import { describeError, failure, isTimeoutError, type WebAdapterResult } from './result.ts';
import type { BrowserWindow } from './browser-globals.ts';
import type { WebSession } from './session.ts';

const DEFAULT_NAVIGATION_TIMEOUT_MS = 30_000;
/** Screen names go into a CSS attribute selector, so only a safe alphabet is accepted. */
const SCREEN_NAME = /^[A-Za-z0-9._-]{1,64}$/;

function isValidTimeout(timeoutMs: number): boolean {
  return Number.isFinite(timeoutMs) && timeoutMs > 0;
}

function disposed(): WebAdapterResult<never> {
  return failure('disposed', 'the session was already disposed');
}

/**
 * Opens `url` and waits for the `load` event. An HTTP status of 400 or more is
 * a failure: the page under test is not what the scenario asked for.
 */
export async function navigateTo(
  session: WebSession,
  url: string,
  timeoutMs: number = DEFAULT_NAVIGATION_TIMEOUT_MS,
): Promise<WebAdapterResult<{ readonly status: number | undefined }>> {
  if (session.isDisposed()) return disposed();
  if (!isValidTimeout(timeoutMs)) return failure('invalid_input', 'timeoutMs must be a positive number');
  try {
    const response = await session.page.goto(url, { waitUntil: 'load', timeout: timeoutMs });
    const status = response?.status();
    if (status !== undefined && status >= 400) {
      return failure('http_error', `navigation answered HTTP ${status}`);
    }
    return { ok: true, status };
  } catch (error) {
    if (isTimeoutError(error)) return failure('timeout', `navigation exceeded ${timeoutMs} ms`);
    return failure('navigation_failed', `navigation failed: ${describeError(error)}`);
  }
}

/**
 * Waits until `[data-retina-ready="<screen>"]` is visible and web fonts have
 * settled. Never throws: a missing marker within the budget is `timeout`.
 */
export async function waitForReady(session: WebSession, screen: string, timeoutMs: number): Promise<WebAdapterResult> {
  if (session.isDisposed()) return disposed();
  if (!SCREEN_NAME.test(screen)) return failure('invalid_input', 'screen must match ^[A-Za-z0-9._-]{1,64}$');
  if (!isValidTimeout(timeoutMs)) return failure('invalid_input', 'timeoutMs must be a positive number');
  try {
    await session.page.locator(`[data-retina-ready="${screen}"]`).waitFor({ state: 'visible', timeout: timeoutMs });
    await session.page.evaluate(async () => {
      await (globalThis as unknown as BrowserWindow).document.fonts.ready;
    });
    return { ok: true };
  } catch (error) {
    if (isTimeoutError(error)) {
      return failure('timeout', `ready marker "${screen}" not visible within ${timeoutMs} ms`);
    }
    return failure('browser_error', `waiting for ready marker failed: ${describeError(error)}`);
  }
}

/** Reads `<meta name="retina-build-id" content="...">`. A missing or empty tag is `not_found`. */
export async function readBuildId(session: WebSession): Promise<WebAdapterResult<{ readonly buildId: string }>> {
  if (session.isDisposed()) return disposed();
  try {
    const buildId = await session.page.evaluate(
      () =>
        (globalThis as unknown as BrowserWindow).document
          .querySelector('meta[name="retina-build-id"]')
          ?.getAttribute('content') ?? null,
    );
    if (buildId === null || buildId.trim() === '') {
      return failure('not_found', 'no retina-build-id meta tag with content');
    }
    return { ok: true, buildId };
  } catch (error) {
    return failure('browser_error', `reading the build id failed: ${describeError(error)}`);
  }
}
