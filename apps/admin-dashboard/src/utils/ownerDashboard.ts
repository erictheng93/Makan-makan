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

/**
 * Who is on shift right now, keyed by employee id as a string.
 *
 * This is the only presence signal the system has. There is no session or
 * heartbeat notion of "online", so anything on the owner dashboard that claims
 * to show presence has to come from here — otherwise it is measuring account
 * state and calling it presence.
 *
 * GET /scheduling/:restaurantId/clocked-in already means "clocked in and not
 * yet clocked out", so no further filtering belongs here.
 */
export function toOnShiftIds(
  schedules: ReadonlyArray<{ employeeId: string | number }> | null | undefined,
): Set<string> {
  return new Set((schedules ?? []).map((s) => String(s.employeeId)));
}

/**
 * Presence for one staff row.
 *
 * The previous rule was `user.status === "active"`. GET /users answers
 * `isActive: true` and has no `status` field at all, so that compared
 * undefined against "active" and every employee rendered as offline — next to
 * a KPI that said the whole roster was online.
 *
 * Reading `isActive` instead would have been worse, not better: it would paint
 * everyone green while still measuring nothing about presence. An enabled
 * account is not a person at work.
 */
export function staffPresence(
  userId: string | number,
  onShiftIds: ReadonlySet<string>,
): "online" | "offline" {
  return onShiftIds.has(String(userId)) ? "online" : "offline";
}
