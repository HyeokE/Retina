#!/usr/bin/env node
// Scans build output for Retina test-only markers. No dependencies.
//
//   node check-test-markers.mjs --expect=absent  <dir> [<dir>...]
//     Production check: exits 1 if any marker string is found.
//   node check-test-markers.mjs --expect=present <dir> [<dir>...]
//     Test-build check: exits 1 unless every directory contains each required
//     marker. This proves the absent check is not vacuous.
//
// Files are searched as raw bytes, so binary output such as Hermes bytecode
// (.hbc) is covered: Hermes stores ASCII strings as plain bytes.
// Exit codes: 0 pass, 1 check failed, 2 usage or input error.
import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

const MARKERS = ['retina-ready', 'retina-build-id', '__test/'];
// The apps never call /__test/*, so it is only checked for absence.
const REQUIRED_WHEN_PRESENT = ['retina-ready', 'retina-build-id'];

function parseArgs(argv) {
  const expectArg = argv.find((arg) => arg.startsWith('--expect='));
  const expect = expectArg ? expectArg.slice('--expect='.length) : 'absent';
  const dirs = argv.filter((arg) => !arg.startsWith('--'));
  if (!['absent', 'present'].includes(expect) || dirs.length === 0) {
    console.error('usage: check-test-markers.mjs --expect=absent|present <dir> [<dir>...]');
    process.exit(2);
  }
  return { expect, dirs };
}

async function listFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return listFiles(path);
      return entry.isFile() ? [path] : [];
    }),
  );
  return nested.flat();
}

function countOccurrences(haystack, needle) {
  let count = 0;
  for (let index = haystack.indexOf(needle); index !== -1; index = haystack.indexOf(needle, index + needle.length)) {
    count += 1;
  }
  return count;
}

async function scanDirectory(dir) {
  const info = await stat(dir).catch(() => undefined);
  if (!info?.isDirectory()) throw new Error(`not a directory (build it first?): ${dir}`);
  const files = await listFiles(dir);
  if (files.length === 0) throw new Error(`no files to scan in ${dir}`);

  const needles = MARKERS.map((marker) => [marker, Buffer.from(marker, 'utf8')]);
  const hits = [];
  for (const file of files) {
    const bytes = await readFile(file);
    for (const [marker, needle] of needles) {
      const count = countOccurrences(bytes, needle);
      if (count > 0) hits.push({ file: relative(process.cwd(), file), marker, count });
    }
  }
  const totals = Object.fromEntries(
    MARKERS.map((marker) => [marker, hits.filter((hit) => hit.marker === marker).reduce((sum, hit) => sum + hit.count, 0)]),
  );
  return { dir, fileCount: files.length, hits, totals };
}

function failuresFor(result, expect) {
  if (expect === 'absent') {
    return result.hits.map((hit) => `${hit.file}: "${hit.marker}" x${hit.count}`);
  }
  return REQUIRED_WHEN_PRESENT.filter((marker) => result.totals[marker] === 0).map(
    (marker) => `${result.dir}: expected "${marker}" but found none`,
  );
}

async function main() {
  const { expect, dirs } = parseArgs(process.argv.slice(2));
  let results;
  try {
    results = await Promise.all(dirs.map(scanDirectory));
  } catch (error) {
    console.error(`check-test-markers: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(2);
  }

  for (const result of results) {
    const summary = MARKERS.map((marker) => `${marker}=${result.totals[marker]}`).join(' ');
    console.log(`[${expect}] ${result.dir} (${result.fileCount} files): ${summary}`);
    for (const hit of result.hits) console.log(`    ${hit.file}: "${hit.marker}" x${hit.count}`);
  }

  const failures = results.flatMap((result) => failuresFor(result, expect));
  if (failures.length > 0) {
    console.error(`check-test-markers: FAILED (expect=${expect})`);
    for (const failure of failures) console.error(`  - ${failure}`);
    process.exit(1);
  }
  console.log(`check-test-markers: OK (expect=${expect})`);
}

await main();
