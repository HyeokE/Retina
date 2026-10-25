import { describeError, failure, isTimeoutError, type WebAdapterResult } from './result.ts';
import type { BrowserWindow } from './browser-globals.ts';
import type { WebSession } from './session.ts';

const DEFAULT_CAPTURE_TIMEOUT_MS = 30_000;

export interface ViewportCapture {
  /** PNG bytes in device pixels (`cssWidth * dpr` by `cssHeight * dpr`). */
  readonly png: Uint8Array;
  /**
   * Layout viewport measured in the page (`innerWidth`/`innerHeight`), not
   * copied from the options. With `isMobile` and no `<meta name="viewport">`
   * Chromium lays out at 980 css px, so this differs from the profile width
   * while the PNG keeps the profile size; callers can flag that mismatch.
   */
  readonly cssWidth: number;
  readonly cssHeight: number;
  readonly dpr: number;
}

/**
 * Screenshots the visible viewport at device scale with CSS animations and
 * transitions stopped and the text caret hidden. The viewport size and DPR
 * are measured in the page right before the capture.
 */
export async function captureViewport(
  session: WebSession,
  timeoutMs: number = DEFAULT_CAPTURE_TIMEOUT_MS,
): Promise<WebAdapterResult<ViewportCapture>> {
  if (session.isDisposed()) return failure('disposed', 'the session was already disposed');
  try {
    const measured = await session.page.evaluate(() => {
      const view = globalThis as unknown as BrowserWindow;
      return { cssWidth: view.innerWidth, cssHeight: view.innerHeight, dpr: view.devicePixelRatio };
    });
    const buffer = await session.page.screenshot({
      type: 'png',
      fullPage: false,
      scale: 'device',
      animations: 'disabled',
      caret: 'hide',
      timeout: timeoutMs,
    });
    const png = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    return { ok: true, png, ...measured };
  } catch (error) {
    if (isTimeoutError(error)) return failure('timeout', `capture exceeded ${timeoutMs} ms`);
    return failure('capture_failed', `capture failed: ${describeError(error)}`);
  }
}
