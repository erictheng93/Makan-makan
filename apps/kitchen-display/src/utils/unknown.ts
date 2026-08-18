import { describeErrorForLog } from "@makanmasak/shared/utils/unknown";

export type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

export { describeErrorForLog };

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
