/**
 * Semantic version comparison helpers.
 *
 * Version strings across management-api (deployed_version, bundle prefixes)
 * were previously compared lexicographically — either via SQL string `<`
 * comparisons or `Array.prototype.sort()` on the raw strings. That is wrong:
 * `"1.10.0" < "1.2.0"` is `true` as strings but `false` as semver.
 *
 * These helpers parse a strict `MAJOR.MINOR.PATCH` string into a numeric
 * triple and compare component-by-component. Non-conforming / missing inputs
 * degrade gracefully to `[0, 0, 0]` so callers never throw on legacy data.
 */

/** Parse a `MAJOR.MINOR.PATCH` string into a numeric triple. */
export function parseVersion(
  version: string | null | undefined,
): [number, number, number] {
  if (!version) return [0, 0, 0];
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version.trim());
  if (!match) return [0, 0, 0];
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * Compare two semver strings.
 * @returns negative if `a < b`, positive if `a > b`, `0` if equal.
 */
export function compareVersions(
  a: string | null | undefined,
  b: string | null | undefined,
): number {
  const va = parseVersion(a);
  const vb = parseVersion(b);
  for (let i = 0; i < 3; i++) {
    if (va[i] !== vb[i]) return va[i] - vb[i];
  }
  return 0;
}

/** Sort a list of version strings ascending (oldest first). Does not mutate. */
export function sortVersionsAscending(versions: string[]): string[] {
  return [...versions].sort(compareVersions);
}

/** Sort a list of version strings descending (newest first). Does not mutate. */
export function sortVersionsDescending(versions: string[]): string[] {
  return [...versions].sort((a, b) => compareVersions(b, a));
}

/** Return the highest version from a list, or `null` if the list is empty. */
export function maxVersion(versions: string[]): string | null {
  if (versions.length === 0) return null;
  return versions.reduce((max, v) => (compareVersions(v, max) > 0 ? v : max));
}
