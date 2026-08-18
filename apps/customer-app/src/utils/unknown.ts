/**
 * Shape narrowing for `unknown`. There is deliberately no "get the error
 * message" helper here: the server's sentence is English diagnostic data, and
 * everything a diner reads comes from `resolveUserFacingError` or a translation
 * key. See docs/architecture/frontend/server-message-presentation-policy.json.
 */
export type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}
