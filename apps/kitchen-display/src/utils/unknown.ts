import { resolveUserFacingError } from "@makanmasak/shared/utils/user-facing-error";
import { t } from "@/i18n";

export type UnknownRecord = Record<string, unknown>;

const KITCHEN_ERROR_CODE_KEYS: Record<string, string> = {
  INVALID_CREDENTIALS: "login.invalidCredentials",
  ACCOUNT_LOCKED: "login.accountLocked",
};

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

export function getErrorMessage(error: unknown, _fallback?: string): string {
  return resolveUserFacingError(error, t, {
    codeKeys: KITCHEN_ERROR_CODE_KEYS,
  }).message;
}

/**
 * Returns locale-safe UI copy from stable transport fields. Server messages
 * remain on the original error for logs and telemetry, but are never UI text.
 */
export function getApiErrorMessage(error: unknown, fallback?: string): string {
  return getErrorMessage(error, fallback);
}

export function getApiErrorStatus(error: unknown): number | undefined {
  if (!isRecord(error) || !isRecord(error.response)) {
    return undefined;
  }

  return typeof error.response.status === "number"
    ? error.response.status
    : undefined;
}

export function getApiErrorStatusText(error: unknown): string | undefined {
  if (!isRecord(error) || !isRecord(error.response)) {
    return undefined;
  }

  return typeof error.response.statusText === "string"
    ? error.response.statusText
    : undefined;
}
