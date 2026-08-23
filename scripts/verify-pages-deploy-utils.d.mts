/**
 * Hand-written declarations for the `.mjs` beside this file.
 *
 * `tests/unit/scripts/verify-pages-deploy-utils.test.ts` imports that module
 * directly, and `pnpm typecheck:tests` runs without `allowJs`, so without
 * these the import is an implicit `any` and the whole check fails (TS7016).
 * Declaring the surface rather than turning on `allowJs` keeps `scripts/` out
 * of the tests' type program and still gives the test real types.
 */

/** `https://{host}{path}` with a `cb` cache-buster query parameter added. */
export function buildDeployPageUrl(
  host: string,
  path: string,
  cacheBuster?: number,
): string;

/**
 * Appends `"{status} {filename}"` to `badAssets` when `url` points inside
 * `/assets/`. Returns whether it recorded anything.
 */
export function recordBadAsset(
  badAssets: string[],
  url: string,
  status?: string,
): boolean;
