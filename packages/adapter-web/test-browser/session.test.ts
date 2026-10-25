import { afterEach, describe, expect, it } from 'vitest';
import { captureViewport } from '../src/capture.ts';
import { readEnvironmentFingerprint } from '../src/fingerprint.ts';
import { navigateTo, readBuildId, waitForReady } from '../src/page-actions.ts';
import { decodePng } from '../src/png.ts';
import { launchWebSession, type WebSession, type WebSessionOptions } from '../src/session.ts';

// Real headless Chromium (Playwright bundle). Run with `bun run test:adapter-web:browser`.
const sessions: WebSession[] = [];

async function open(options: WebSessionOptions): Promise<WebSession> {
  const result = await launchWebSession(options);
  if (!result.ok) throw new Error(`launch failed: ${result.code} ${result.reason}`);
  sessions.push(result.session);
  return result.session;
}

afterEach(async () => {
  await Promise.all(sessions.splice(0).map((session) => session.dispose()));
});

const PAGE = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="retina-build-id" content="build-42"></head>
<body style="margin:0;background:#fff"><main data-retina-ready="home">ready</main>
<input id="field" autofocus value="caret"></body></html>`;

describe('web session (headless Chromium)', () => {
  it('captures the viewport in device pixels and measures css size and DPR', async () => {
    const session = await open({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    await session.page.setContent(PAGE);
    expect(await waitForReady(session, 'home', 5_000)).toEqual({ ok: true });
    const capture = await captureViewport(session);
    expect(capture.ok).toBe(true);
    if (!capture.ok) return;
    expect({ cssWidth: capture.cssWidth, cssHeight: capture.cssHeight, dpr: capture.dpr }).toEqual({
      cssWidth: 390,
      cssHeight: 844,
      dpr: 3,
    });
    const decoded = decodePng(capture.png);
    expect(decoded.ok && { width: decoded.image.width, height: decoded.image.height }).toEqual({ width: 1170, height: 2532 });
  });

  it('reports the layout viewport, so a mobile page without a viewport meta shows 980 css px', async () => {
    const session = await open({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true });
    await session.page.setContent('<main data-retina-ready="home">no viewport meta</main>');
    const capture = await captureViewport(session);
    expect(capture.ok && capture.cssWidth).toBe(980);
    const decoded = capture.ok ? decodePng(capture.png) : undefined;
    expect(decoded?.ok && decoded.image.width).toBe(1170);
  });

  it('returns a typed timeout when the ready marker never appears', async () => {
    const session = await open({ viewport: { width: 800, height: 600 } });
    await session.page.setContent(PAGE);
    const started = Date.now();
    const result = await waitForReady(session, 'other-screen', 300);
    expect(result).toMatchObject({ ok: false, code: 'timeout' });
    expect(Date.now() - started).toBeLessThan(5_000);
  });

  it('rejects screen names that are not a safe selector value', async () => {
    const session = await open({ viewport: { width: 800, height: 600 } });
    expect(await waitForReady(session, 'x"] , body [a="', 300)).toMatchObject({ ok: false, code: 'invalid_input' });
  });

  it('reads the build id meta tag and reports not_found without it', async () => {
    const session = await open({ viewport: { width: 800, height: 600 } });
    await session.page.setContent(PAGE);
    expect(await readBuildId(session)).toEqual({ ok: true, buildId: 'build-42' });
    await session.page.setContent('<p>no meta</p>');
    expect(await readBuildId(session)).toMatchObject({ ok: false, code: 'not_found' });
  });

  it('maps a refused connection to navigation_failed', async () => {
    const session = await open({ viewport: { width: 800, height: 600 } });
    // Port 9 (discard) on loopback is closed on developer machines and runners.
    const result = await navigateTo(session, 'http://127.0.0.1:9/', 5_000);
    expect(result).toMatchObject({ ok: false, code: 'navigation_failed' });
  });

  it('records the requested and measured environment', async () => {
    const session = await open({
      viewport: { width: 1440, height: 900 },
      locale: 'en-GB',
      timezoneId: 'Asia/Seoul',
      colorScheme: 'dark',
    });
    await session.page.setContent(PAGE);
    const result = await readEnvironmentFingerprint(session);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { fingerprint } = result;
    expect(fingerprint.browser.name).toBe('chromium');
    expect(fingerprint.browser.version).toMatch(/^\d+\./);
    expect(fingerprint.measured).toMatchObject({
      cssWidth: 1440,
      cssHeight: 900,
      dpr: 1,
      locale: 'en-GB',
      timezoneId: 'Asia/Seoul',
      colorScheme: 'dark',
      reducedMotion: true,
    });
    expect(fingerprint.os.arch).toBe(process.arch);
  });

  it('isolates contexts: storage written in one session is absent in the next', async () => {
    const first = await open({ viewport: { width: 800, height: 600 } });
    await first.page.route('http://isolation.test/', (route) => route.fulfill({ body: '<p>x</p>', contentType: 'text/html' }));
    await first.page.goto('http://isolation.test/');
    await first.page.evaluate(() => (globalThis as unknown as { localStorage: { setItem: (k: string, v: string) => void } }).localStorage.setItem('k', 'v'));
    await first.dispose();
    const second = await open({ viewport: { width: 800, height: 600 } });
    await second.page.route('http://isolation.test/', (route) => route.fulfill({ body: '<p>x</p>', contentType: 'text/html' }));
    await second.page.goto('http://isolation.test/');
    const stored = await second.page.evaluate(
      () => (globalThis as unknown as { localStorage: { getItem: (k: string) => string | null } }).localStorage.getItem('k'),
    );
    expect(stored).toBeNull();
  });

  it('dispose is idempotent and later calls report disposed', async () => {
    const session = await open({ viewport: { width: 800, height: 600 } });
    await Promise.all([session.dispose(), session.dispose()]);
    await session.dispose();
    expect(session.isDisposed()).toBe(true);
    expect(await waitForReady(session, 'home', 100)).toMatchObject({ ok: false, code: 'disposed' });
    expect(await captureViewport(session)).toMatchObject({ ok: false, code: 'disposed' });
    expect(await readBuildId(session)).toMatchObject({ ok: false, code: 'disposed' });
    expect(await navigateTo(session, 'about:blank')).toMatchObject({ ok: false, code: 'disposed' });
  });
});
