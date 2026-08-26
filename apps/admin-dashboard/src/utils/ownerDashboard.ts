/**
 * A module the restaurant's plan does not include is a configuration fact, not
 * a failure: the owner can do nothing about it and the rest of the page is
 * fine. Reporting it as 載入失敗 would pin a permanent red banner on a working
 * dashboard for every basic-plan tenant.
 */
const NON_FAILURE_CODES = new Set([
  "MODULE_NOT_ENABLED",
  "SUBSCRIPTION_NOT_FOUND",
]);

function isPlanRestriction(reason: unknown): boolean {
  if (typeof reason !== "object" || reason === null) return false;
  const code = (
    reason as { response?: { data?: { error?: { code?: unknown } } } }
  ).response?.data?.error?.code;
  return typeof code === "string" && NON_FAILURE_CODES.has(code);
}

export function hasRequestFailure(
  results: PromiseSettledResult<unknown>[],
): boolean {
  return results.some(
    (result) =>
      result.status === "rejected" && !isPlanRestriction(result.reason),
  );
}
