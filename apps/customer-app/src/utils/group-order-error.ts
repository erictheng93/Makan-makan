/**
 * Group ordering puts its failures straight on a diner's screen, so what a
 * failure carries has to be a translation key rather than prose. The views used
 * to render `error.message` and fall back to `t(...)` only when the throw was
 * not an Error — which never happens, so the translated fallback was dead code
 * and the diner read English on an otherwise Chinese page.
 *
 * `useGroupOrder` now throws errors tagged with a code from this module, and
 * callers resolve that code to a key. Anything untagged — a server message, a
 * network failure — resolves to the caller's fallback instead of being shown
 * verbatim, the same rule `order-submit-error.ts` applies to checkout.
 */

export type GroupOrderErrorCode =
  | "GROUP_CREATE_FAILED"
  | "GROUP_JOIN_FAILED"
  | "GROUP_NOT_LOADED"
  | "GROUP_HOST_CREDENTIAL_REQUIRED"
  | "GROUP_NOT_A_MEMBER"
  | "GROUP_REALTIME_TOKEN_FAILED"
  | "GROUP_CONNECTION_FAILED"
  | "GROUP_RECOVERY_CODE_REQUIRED"
  | "GROUP_RECOVER_FAILED"
  | "GROUP_UNKNOWN";

const GROUP_ORDER_ERROR_KEYS: Record<GroupOrderErrorCode, string> = {
  GROUP_CREATE_FAILED: "group.createFailed",
  GROUP_JOIN_FAILED: "groupJoin.joinFailed",
  // A missing group order is a state bug rather than something the diner did,
  // so it reads as a load failure — the one thing they can act on is a reload.
  GROUP_NOT_LOADED: "group.loadFailed",
  GROUP_HOST_CREDENTIAL_REQUIRED: "group.hostCredentialRequired",
  GROUP_NOT_A_MEMBER: "group.notAMember",
  GROUP_REALTIME_TOKEN_FAILED: "group.connectionError",
  GROUP_CONNECTION_FAILED: "group.connectionError",
  GROUP_RECOVERY_CODE_REQUIRED: "group.recoveryCodeRequired",
  GROUP_RECOVER_FAILED: "group.recoverFailed",
  GROUP_UNKNOWN: "group.unknownError",
};

type CodedGroupOrderError = Error & {
  groupOrderErrorCode: GroupOrderErrorCode;
};

/**
 * Builds an Error carrying a translation code. The code doubles as the
 * `message` so a console trace or a Sentry payload still says what broke.
 */
export function groupOrderError(
  code: GroupOrderErrorCode,
): CodedGroupOrderError {
  return Object.assign(new Error(code), { groupOrderErrorCode: code });
}

export function getGroupOrderErrorCode(
  error: unknown,
): GroupOrderErrorCode | undefined {
  if (!error || typeof error !== "object") return undefined;

  const code = (error as { groupOrderErrorCode?: unknown }).groupOrderErrorCode;
  return typeof code === "string" && code in GROUP_ORDER_ERROR_KEYS
    ? (code as GroupOrderErrorCode)
    : undefined;
}

/**
 * Resolves any group ordering failure to a translation key. `fallbackKey` is
 * what the caller wants said when the failure carries no code of its own.
 */
export function getGroupOrderErrorI18nKey(
  error: unknown,
  fallbackKey: string,
): string {
  const code = getGroupOrderErrorCode(error);
  return code ? GROUP_ORDER_ERROR_KEYS[code] : fallbackKey;
}
