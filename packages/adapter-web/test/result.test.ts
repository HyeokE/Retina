import { describe, expect, it } from 'vitest';
import { describeError } from '../src/result.ts';
import { launchWebSession } from '../src/session.ts';

describe('describeError', () => {
  it('keeps the error name and a net::ERR code, never the full message', () => {
    const error = new Error('page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:1/?token=secret');
    expect(describeError(error)).toBe('Error (net::ERR_CONNECTION_REFUSED)');
  });

  it('records only the name for other errors', () => {
    const error = new TypeError('selector "[data-x=secret]" is invalid');
    expect(describeError(error)).toBe('TypeError');
    expect(describeError('boom')).toBe('string');
  });
});

describe('launchWebSession input validation', () => {
  // These fail before any browser is started, so they need no Chromium.
  it.each([
    [{ viewport: { width: 0, height: 900 } }],
    [{ viewport: { width: 1440.5, height: 900 } }],
    [{ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 0 }],
    [{ viewport: { width: 1440, height: 900 }, launchTimeoutMs: -1 }],
  ])('rejects %j with invalid_input', async (options) => {
    const result = await launchWebSession(options);
    expect(result).toMatchObject({ ok: false, code: 'invalid_input' });
  });
});
