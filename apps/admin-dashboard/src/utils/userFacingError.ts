import {
  resolveUserFacingError,
  type ErrorTranslator,
} from "@makanmasak/shared/utils/user-facing-error";

/**
 * Resolves transport failures without ever exposing server diagnostic prose.
 * Callers retain their action-specific fallback for malformed legacy errors.
 */
export function resolveAdminUserFacingError(
  error: unknown,
  translate: ErrorTranslator,
  fallbackKey: string,
  options?: Parameters<typeof resolveUserFacingError>[2],
): string {
  const resolved = resolveUserFacingError(error, translate, options);
  return resolved.presentation === "unknown"
    ? translate(fallbackKey)
    : resolved.message;
}
