export type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null;
}

export function getErrorMessage(
  error: unknown,
  fallback = "發生未知錯誤",
): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (isRecord(error)) {
    const message = error.message;
    if (typeof message === "string" && message.length > 0) {
      return message;
    }
  }

  return fallback;
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (isRecord(error)) {
    const response = error.response;
    if (isRecord(response)) {
      const data = response.data;
      if (isRecord(data) && typeof data.message === "string") {
        return data.message;
      }
    }
  }

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
