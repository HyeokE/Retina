/**
 * Required environment variables (plan 6.3). Pure: the caller passes the env
 * object in. Only names ever leave these functions, never values.
 */

const ENV_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** True for a portable environment variable identifier. */
export function isValidEnvName(name: string): boolean {
  return ENV_NAME_PATTERN.test(name);
}

function hasValue(env: Readonly<Record<string, string | undefined>>, name: string): boolean {
  if (!Object.hasOwn(env, name)) {
    return false;
  }
  const value = env[name];
  return typeof value === 'string' && value.length > 0;
}

/**
 * Names from `names` that are unset or empty in `env`, in declaration order and
 * without repeats. The result contains names only.
 */
export function checkRequiredEnv(
  names: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
): readonly string[] {
  return [...new Set(names)].filter((name) => !hasValue(env, name));
}
