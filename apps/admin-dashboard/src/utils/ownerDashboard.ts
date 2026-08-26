export function hasRequestFailure(
  results: PromiseSettledResult<unknown>[],
): boolean {
  return results.some((result) => result.status === "rejected");
}
