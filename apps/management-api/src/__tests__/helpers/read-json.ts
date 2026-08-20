import type { ApiResponse } from "../../types";

/** Reads an API response using the management API's standard envelope shape. */
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
 * Returns the error half of the envelope, and turns "the server actually
 * succeeded" into a readable failure instead of a read through undefined.
 */
export async function readError(
  response: Response,
): Promise<NonNullable<ApiResponse["error"]>> {
  const envelope = await readEnvelope(response);
  if (envelope.success || !envelope.error) {
    throw new Error(`expected error envelope, got ${JSON.stringify(envelope)}`);
  }
  return envelope.error;
}
