import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RgbaImage } from 'retina';
import {
  captureViewport,
  decodePng,
  launchWebSession,
  navigateTo,
  readBuildId,
  readEnvironmentFingerprint,
  waitForReady,
  type WebEnvironmentFingerprint,
  type WebSession,
  type WebSessionOptions,
} from 'retina-adapter-web';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { compareRepeats, type PairResult } from './support/aa.ts';
import { isPidAlive, stopOwned, type OwnedProcess } from './support/processes.ts';
import { buildWeb, readProfile, startApi, startPreview, testEndpoint, WEB_DIR } from './support/servers.ts';

// G-B3: Profile → Edit (validation error) → Save → re-entry, captured on two
// web profiles. Every flow runs REPEATS times in a fresh browser context on the
// same build; the captures of each checkpoint must match exactly (A/A).

interface ScenarioProfile {
  readonly id: string;
  readonly options: WebSessionOptions;
  readonly expectedPng: { readonly width: number; readonly height: number };
}

const PROFILES: readonly ScenarioProfile[] = [
  {
    id: 'web-desktop',
    options: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
    expectedPng: { width: 1440, height: 900 },
  },
  {
    id: 'web-mobile',
    options: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
    expectedPng: { width: 1170, height: 2532 },
  },
];

const CHECKPOINTS = ['01-profile', '02-edit-validation-error', '03-profile-after-save'] as const;
type Checkpoint = (typeof CHECKPOINTS)[number];

const REPEATS = 3;
const READY_TIMEOUT_MS = 10_000;
const SERVER_TIMEOUT_MS = 30_000;
const BUILD_TIMEOUT_MS = 120_000;

const SEED = { name: 'Alex Kim', email: 'alex@example.com', city: 'Springfield' };
const SAVED = { name: 'Jordan Lee', email: 'jordan@example.com', city: 'Rivertown' };

const RUN_ID = `r${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`;
const RUN_DIR = join(WEB_DIR, '.retina', 'runs', RUN_ID);
const BUILD_ID = `scenario-${RUN_ID}`;

const owned: OwnedProcess[] = [];
let apiBaseUrl = '';
let webBaseUrl = '';
const summary: {
  runId: string;
  buildId: string;
  fingerprints: Record<string, WebEnvironmentFingerprint>;
  captures: { profile: string; checkpoint: Checkpoint; repeat: number; path: string; width: number; height: number; cssWidth: number; cssHeight: number; dpr: number }[];
  aa: Record<string, PairResult[]>;
  processes: { name: string; pid: number; startedAt: string; exit?: number | string; aliveAfterStop?: boolean }[];
} = { runId: RUN_ID, buildId: BUILD_ID, fingerprints: {}, captures: [], aa: {}, processes: [] };

async function writeSummary(): Promise<void> {
  await mkdir(RUN_DIR, { recursive: true });
  await writeFile(join(RUN_DIR, 'summary.json'), `${JSON.stringify(summary, null, 2)}\n`);
}

beforeAll(async () => {
  await mkdir(RUN_DIR, { recursive: true });
  const api = await startApi(SERVER_TIMEOUT_MS);
  owned.push(api.process);
  apiBaseUrl = api.baseUrl;
  const build = await buildWeb(apiBaseUrl, join(RUN_DIR, 'web-dist'), BUILD_ID, BUILD_TIMEOUT_MS);
  const web = await startPreview(build.outDir, SERVER_TIMEOUT_MS);
  owned.push(web.process);
  webBaseUrl = web.baseUrl;
  summary.processes = owned.map(({ name, pid, startedAt }) => ({ name, pid, startedAt }));
}, BUILD_TIMEOUT_MS + 2 * SERVER_TIMEOUT_MS);

afterAll(async () => {
  // Stop only the PIDs this file started, newest first.
  for (const process of [...owned].reverse()) {
    const exit = await stopOwned(process);
    const entry = summary.processes.find((item) => item.pid === process.pid);
    if (entry) Object.assign(entry, { exit, aliveAfterStop: isPidAlive(process.pid) });
  }
  await writeSummary();
  expect(owned.filter((process) => isPidAlive(process.pid)).map((process) => process.pid)).toEqual([]);
});

function unwrap<T extends { readonly ok: boolean }>(step: string, result: T): Extract<T, { ok: true }> {
  if (!result.ok) {
    const { code, reason } = result as unknown as { code: string; reason: string };
    throw new Error(`${step} failed: ${code} ${reason}`);
  }
  return result as Extract<T, { ok: true }>;
}

async function text(session: WebSession, testId: string): Promise<string> {
  return (await session.page.getByTestId(testId).textContent())?.trim() ?? '';
}

async function capture(session: WebSession, profile: ScenarioProfile, checkpoint: Checkpoint, repeat: number): Promise<RgbaImage> {
  const shot = unwrap(`capture ${checkpoint}`, await captureViewport(session));
  const { image } = unwrap(`decode ${checkpoint}`, decodePng(shot.png));
  // The page must lay out at the profile width, and the PNG must be css size × DPR.
  expect({ cssWidth: shot.cssWidth, cssHeight: shot.cssHeight, dpr: shot.dpr }).toEqual({
    cssWidth: profile.options.viewport.width,
    cssHeight: profile.options.viewport.height,
    dpr: profile.options.deviceScaleFactor,
  });
  expect({ width: image.width, height: image.height }).toEqual(profile.expectedPng);
  const dir = join(RUN_DIR, profile.id);
  await mkdir(dir, { recursive: true });
  const path = join(dir, `${checkpoint}-r${repeat}.png`);
  await writeFile(path, shot.png);
  summary.captures.push({ profile: profile.id, checkpoint, repeat, path, width: image.width, height: image.height, cssWidth: shot.cssWidth, cssHeight: shot.cssHeight, dpr: shot.dpr });
  return image;
}

async function runFlow(session: WebSession, profile: ScenarioProfile, flowRunId: string, repeat: number): Promise<Record<Checkpoint, RgbaImage>> {
  const page = session.page;
  unwrap('navigate', await navigateTo(session, `${webBaseUrl}/?retinaRun=${flowRunId}`));
  unwrap('ready profile', await waitForReady(session, 'profile', READY_TIMEOUT_MS));
  expect(unwrap('build id', await readBuildId(session)).buildId).toBe(BUILD_ID);
  if (repeat === 1) {
    summary.fingerprints[profile.id] = unwrap('fingerprint', await readEnvironmentFingerprint(session)).fingerprint;
  }
  expect([await text(session, 'profile-name'), await text(session, 'profile-email'), await text(session, 'profile-city')]).toEqual([
    SEED.name,
    SEED.email,
    SEED.city,
  ]);
  const profileShot = await capture(session, profile, '01-profile', repeat);

  // (2) Edit with validation errors.
  await page.getByTestId('edit-button').click();
  unwrap('ready edit', await waitForReady(session, 'edit', READY_TIMEOUT_MS));
  await page.getByTestId('field-name').fill('');
  await page.getByTestId('field-email').fill('not-an-email');
  await page.getByTestId('save-button').click();
  await page.getByTestId('error-name').waitFor({ state: 'visible', timeout: READY_TIMEOUT_MS });
  expect(await page.getByTestId('error-name').isVisible()).toBe(true);
  expect(await page.getByTestId('error-email').isVisible()).toBe(true);
  expect(await text(session, 'error-name')).toBe('Name is required.');
  expect(await text(session, 'error-email')).toBe('Enter a valid email address.');
  const errorShot = await capture(session, profile, '02-edit-validation-error', repeat);

  // (3) Save valid values, return to Profile, reload with the run id kept.
  await page.getByTestId('field-name').fill(SAVED.name);
  await page.getByTestId('field-email').fill(SAVED.email);
  await page.getByTestId('field-city').fill(SAVED.city);
  await page.getByTestId('save-button').click();
  unwrap('ready profile after save', await waitForReady(session, 'profile', READY_TIMEOUT_MS));
  expect(new URL(page.url()).pathname).toBe('/');
  expect(new URL(page.url()).searchParams.get('retinaRun')).toBe(flowRunId);
  await page.reload({ waitUntil: 'load' });
  unwrap('ready profile after reload', await waitForReady(session, 'profile', READY_TIMEOUT_MS));
  expect(new URL(page.url()).searchParams.get('retinaRun')).toBe(flowRunId);
  expect([await text(session, 'profile-name'), await text(session, 'profile-email'), await text(session, 'profile-city')]).toEqual([
    SAVED.name,
    SAVED.email,
    SAVED.city,
  ]);
  const savedShot = await capture(session, profile, '03-profile-after-save', repeat);

  // The write went to this run's store only.
  expect(await readProfile(apiBaseUrl, flowRunId)).toEqual(SAVED);
  expect(await readProfile(apiBaseUrl)).toEqual(SEED);

  return { '01-profile': profileShot, '02-edit-validation-error': errorShot, '03-profile-after-save': savedShot };
}

describe.each(PROFILES)('profile flow on $id', (profile) => {
  it(`captures ${CHECKPOINTS.length} checkpoints ${REPEATS} times in fresh contexts and they match exactly`, async () => {
    const repeats: Record<Checkpoint, RgbaImage>[] = [];
    for (let repeat = 1; repeat <= REPEATS; repeat += 1) {
      const flowRunId = `${RUN_ID}.${profile.id}.${repeat}`;
      await testEndpoint(apiBaseUrl, '/__test/reset', flowRunId);
      const { session } = unwrap('launch', await launchWebSession(profile.options));
      try {
        repeats.push(await runFlow(session, profile, flowRunId, repeat));
      } finally {
        await session.dispose();
        await testEndpoint(apiBaseUrl, '/__test/runs/end', flowRunId);
      }
    }

    const pairs = CHECKPOINTS.flatMap((checkpoint) =>
      compareRepeats(checkpoint, repeats.map((images) => images[checkpoint])),
    );
    summary.aa[profile.id] = pairs;
    await writeSummary();
    const notExact = pairs.filter((pair) => pair.matchRate !== 1);
    expect(notExact, `A/A pairs that are not identical:\n${JSON.stringify(notExact, null, 2)}`).toEqual([]);
    expect(pairs).toHaveLength(CHECKPOINTS.length * 3);
  });
});
