import type { RetinaProviders } from './providers.ts';

/*
 * Shape of `retina.config.ts` (plan 6.3, proposal). `DeviceId` is
 * `string | undefined` in what a project writes, because device ids usually
 * come from the environment; `validateConfig` only accepts pinned devices and
 * returns `ValidatedConfig`, where they are `string`.
 */

export interface WebViewport {
  readonly width: number;
  readonly height: number;
}

export type ColorScheme = 'light' | 'dark';

export interface WebProfile {
  readonly platform: 'web';
  readonly viewport: WebViewport;
  readonly deviceScaleFactor?: number;
  readonly isMobile?: boolean;
  readonly locale?: string;
  readonly timezone?: string;
  readonly colorScheme?: ColorScheme;
  readonly fixtureScope?: string;
}

/** A simulator pinned by UDID. Without it the profile does not run (plan 8.3). */
export interface IosDevice<DeviceId = string | undefined> {
  readonly udid: DeviceId;
}

export interface IosProfile<DeviceId = string | undefined> {
  readonly platform: 'ios';
  readonly device: IosDevice<DeviceId>;
  readonly fixtureScope?: string;
}

/** A device or emulator pinned by serial; `avdRamMb` caps the emulator RAM (plan 8.3). */
export interface AndroidDevice<DeviceId = string | undefined> {
  readonly serial: DeviceId;
  readonly avdRamMb?: number;
}

export interface AndroidProfile<DeviceId = string | undefined> {
  readonly platform: 'android';
  readonly device: AndroidDevice<DeviceId>;
  readonly fixtureScope?: string;
}

export type Profile<DeviceId = string | undefined> = WebProfile | IosProfile<DeviceId> | AndroidProfile<DeviceId>;

/** A Figma frame mapped to a capture point and the profiles it is compared on (plan 13.2). */
export interface DesignFrame {
  readonly id: string;
  readonly url: string;
  readonly checkpoint: string;
  /** Profile ids. */
  readonly envs: readonly string[];
}

export interface DesignConfig {
  readonly frames: readonly DesignFrame[];
  readonly fixturesDir: string;
}

/** How a report opens after a run (plan 13.9). CI always behaves as `false`. */
export type ReportOpen = 'os' | 'print' | 'serve' | false;

export const REPORT_OPEN_VALUES: readonly ReportOpen[] = ['os', 'print', 'serve', false];

export interface ReportConfig {
  readonly open: ReportOpen;
}

export interface RetinaConfig<DeviceId = string | undefined> {
  /** Keyed by profile id. */
  readonly profiles: Readonly<Record<string, Profile<DeviceId>>>;
  readonly providers?: RetinaProviders;
  readonly design?: DesignConfig;
  readonly report?: ReportConfig;
  /** Scenario file globs. */
  readonly scenarios: readonly string[];
  /** Baseline directory. */
  readonly baselines: string;
  /** Names only; values are never recorded (plan 6.3). */
  readonly requiredEnv?: readonly string[];
}

/** A config that passed `validateConfig`: every native device is pinned. */
export type ValidatedConfig = RetinaConfig<string>;

export type ConfigIssueCode =
  | 'invalid_type'
  | 'missing'
  | 'unknown_key'
  | 'invalid_value'
  | 'no_profiles'
  | 'unknown_platform'
  | 'device_not_pinned'
  | 'invalid_viewport'
  | 'duplicate_frame_id'
  | 'unknown_profile_ref'
  | 'invalid_figma_url'
  | 'invalid_report_open'
  | 'empty_scenarios'
  | 'duplicate_env_name'
  | 'invalid_env_name'
  | 'unknown_provider'
  | 'invalid_provider';

/**
 * One problem in a config. `path` is dotted with `[index]` for arrays (`''` is
 * the root). Messages name keys and ids, never the offending values.
 */
export interface ConfigIssue {
  readonly path: string;
  readonly code: ConfigIssueCode;
  readonly message: string;
}

export type ConfigValidation =
  | { readonly ok: true; readonly config: ValidatedConfig }
  | { readonly ok: false; readonly issues: readonly ConfigIssue[] };
