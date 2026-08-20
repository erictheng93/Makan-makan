import type { ApiResponse } from "../../shared/types";

/** Reads an API response using the application's standard envelope shape. */
export async function readEnvelope<T>(
  response: Response,
): Promise<ApiResponse<T>> {
  return (await response.json()) as ApiResponse<T>;
}

/**
 * Returns successful response data and includes the actual envelope in errors,
 * rather than failing later on an unhelpful undefined property access.
 */
export async function readData<T>(response: Response): Promise<T> {
  const envelope = await readEnvelope<T>(response);
  if (!envelope.success || envelope.data === undefined) {
    throw new Error(
      `expected success envelope, got ${JSON.stringify(envelope)}`,
    );
  }
  return envelope.data;
}

/**
 * The envelope `data` produced by a route that returns a service call
 * straight through. Deriving the shape from the service keeps the test tied to
 * production types, so a reshaped service breaks compilation instead of
 * silently changing what the assertions read.
 */
export type ServiceData<T> = T extends (...args: never[]) => Promise<infer R>
  ? NonNullable<R>
  : never;
