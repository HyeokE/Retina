/**
 * The few browser globals the adapter reads inside `page.evaluate`. The
 * workspace compiles without the DOM lib (Node runtime target), so in-page
 * callbacks cast `globalThis` to this view instead of using DOM globals.
 * Only types live here: evaluate callbacks are serialised, so they must not
 * reference runtime values from this module.
 */
export interface BrowserWindow {
  readonly innerWidth: number;
  readonly innerHeight: number;
  readonly devicePixelRatio: number;
  readonly navigator: { readonly language: string; readonly userAgent: string };
  readonly matchMedia: (query: string) => { readonly matches: boolean };
  readonly document: {
    readonly fonts: { readonly ready: Promise<unknown> };
    readonly querySelector: (selector: string) => { readonly getAttribute: (name: string) => string | null } | null;
  };
}
