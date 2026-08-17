import { resolveUserFacingError } from "@makanmasak/shared/utils/user-facing-error";

const LOGIN_ERROR_KEYS: Record<string, string> = {
  INVALID_CREDENTIALS: "login.invalidCredentials",
  ACCOUNT_LOCKED: "login.accountLocked",
};

/**
 * Converts login transport errors into localized UI copy without exposing
 * diagnostic server messages to kitchen staff.
 */
export function resolveKitchenLoginError(
  error: unknown,
  translate: (key: string) => string,
): string {
  return resolveUserFacingError(error, translate, {
    codeKeys: LOGIN_ERROR_KEYS,
  }).message;
}
