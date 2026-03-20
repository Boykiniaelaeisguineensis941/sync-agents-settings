/**
 * Expand shell-style env var syntax that some CLIs don't support.
 * - `${VAR:-default}` → resolved env value, or `default` if unset
 * - `${VAR}` → resolved env value, or empty string if unset
 */
export function expandEnvVars(value: string): string {
  return value.replace(/\$\{(\w+)(?::-([^}]*))?\}/g, (_match, name, fallback) => {
    return process.env[name] ?? fallback ?? "";
  });
}
