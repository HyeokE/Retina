/**
 * Parses a Figma frame URL into the file key and node id the Figma API uses
 * (plan 13.2). Pure: no network.
 */

export type FigmaUrlErrorCode =
  | 'not_a_url'
  | 'not_figma'
  | 'unsupported_path'
  | 'missing_file_key'
  | 'missing_node_id'
  | 'invalid_node_id';

export type FigmaFrameRef =
  | { readonly ok: true; readonly fileKey: string; readonly nodeId: string }
  | { readonly ok: false; readonly code: FigmaUrlErrorCode };

const FIGMA_HOSTS: ReadonlySet<string> = new Set(['figma.com', 'www.figma.com']);
const FILE_ROUTES: ReadonlySet<string> = new Set(['design', 'file']);
const KEY_PATTERN = /^[A-Za-z0-9]+$/;
/** Frame node ids: `12-34` in URLs, `12:34` in the API. */
const NODE_ID_PATTERN = /^([0-9]+)[-:]([0-9]+)$/;

function failure(code: FigmaUrlErrorCode): FigmaFrameRef {
  return { ok: false, code };
}

/** `/design/:fileKey/...` or `/design/:fileKey/branch/:branchKey/...`; a branch key wins. */
function fileKeyOf(segments: readonly string[]): string | undefined {
  const [, fileKey, marker, branchKey] = segments;
  const key = marker === 'branch' ? branchKey : fileKey;
  return key !== undefined && KEY_PATTERN.test(key) ? key : undefined;
}

export function parseFigmaFrameUrl(url: string): FigmaFrameRef {
  const parsed = URL.parse(url);
  if (parsed === null) {
    return failure('not_a_url');
  }
  if (parsed.protocol !== 'https:' || !FIGMA_HOSTS.has(parsed.hostname)) {
    return failure('not_figma');
  }
  const segments = parsed.pathname.split('/').filter((segment) => segment.length > 0);
  const route = segments[0];
  if (route === undefined || !FILE_ROUTES.has(route)) {
    return failure('unsupported_path');
  }
  const fileKey = fileKeyOf(segments);
  if (fileKey === undefined) {
    return failure('missing_file_key');
  }
  const rawNodeId = parsed.searchParams.get('node-id');
  if (rawNodeId === null || rawNodeId === '') {
    return failure('missing_node_id');
  }
  const match = NODE_ID_PATTERN.exec(rawNodeId);
  if (match === null) {
    return failure('invalid_node_id');
  }
  return { ok: true, fileKey, nodeId: `${match[1]}:${match[2]}` };
}
