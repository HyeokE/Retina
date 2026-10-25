import { describe, expect, it } from 'vitest';
import { parseFigmaFrameUrl } from '../../src/index.ts';

describe('parseFigmaFrameUrl', () => {
  it('parses a design URL and converts the node id to API form', () => {
    expect(parseFigmaFrameUrl('https://www.figma.com/design/AbC123xyz/Profile-Screens?node-id=12-34&t=x1')).toEqual({
      ok: true,
      fileKey: 'AbC123xyz',
      nodeId: '12:34',
    });
  });

  it('parses a legacy file URL', () => {
    expect(parseFigmaFrameUrl('https://www.figma.com/file/FiLeKey9/Old-Name?node-id=1-2')).toEqual({
      ok: true,
      fileKey: 'FiLeKey9',
      nodeId: '1:2',
    });
  });

  it('accepts the bare figma.com host and an already encoded colon node id', () => {
    expect(parseFigmaFrameUrl('https://figma.com/design/Key1/Name?node-id=7%3A8')).toEqual({
      ok: true,
      fileKey: 'Key1',
      nodeId: '7:8',
    });
  });

  it('uses the branch key as the file key for a branch URL', () => {
    expect(parseFigmaFrameUrl('https://www.figma.com/design/MainKey1/branch/BranchKey2/Name?node-id=3-4')).toEqual({
      ok: true,
      fileKey: 'BranchKey2',
      nodeId: '3:4',
    });
  });

  it('rejects a URL without node-id', () => {
    expect(parseFigmaFrameUrl('https://www.figma.com/design/AbC123xyz/Profile-Screens')).toEqual({
      ok: false,
      code: 'missing_node_id',
    });
  });

  it('rejects a node-id that is not a frame id', () => {
    expect(parseFigmaFrameUrl('https://www.figma.com/design/AbC123xyz/Name?node-id=abc')).toEqual({
      ok: false,
      code: 'invalid_node_id',
    });
  });

  it('rejects a non-Figma host, including look-alike hosts', () => {
    expect(parseFigmaFrameUrl('https://example.com/design/AbC123xyz/Name?node-id=1-2')).toEqual({
      ok: false,
      code: 'not_figma',
    });
    expect(parseFigmaFrameUrl('https://figma.com.example.com/design/AbC/Name?node-id=1-2')).toEqual({
      ok: false,
      code: 'not_figma',
    });
  });

  it('rejects a non-https scheme', () => {
    expect(parseFigmaFrameUrl('http://www.figma.com/design/AbC/Name?node-id=1-2')).toEqual({
      ok: false,
      code: 'not_figma',
    });
  });

  it('rejects text that is not a URL', () => {
    expect(parseFigmaFrameUrl('not a url')).toEqual({ ok: false, code: 'not_a_url' });
  });

  it('rejects unsupported Figma paths and a missing file key', () => {
    expect(parseFigmaFrameUrl('https://www.figma.com/proto/AbC/Name?node-id=1-2')).toEqual({
      ok: false,
      code: 'unsupported_path',
    });
    expect(parseFigmaFrameUrl('https://www.figma.com/design/?node-id=1-2')).toEqual({
      ok: false,
      code: 'missing_file_key',
    });
    expect(parseFigmaFrameUrl('https://www.figma.com/design/AbC/branch/?node-id=1-2')).toEqual({
      ok: false,
      code: 'missing_file_key',
    });
  });
});
