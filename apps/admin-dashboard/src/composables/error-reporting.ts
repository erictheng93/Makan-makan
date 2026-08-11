import type { TrackedError } from "@makanmasak/utils";
import { api } from "@/services/api";

type SystemErrorType =
  | "network"
  | "api"
  | "sse"
  | "validation"
  | "permission"
  | "unknown";

interface SystemErrorReportItem {
  type: SystemErrorType;
  severity: TrackedError["severity"];
  code?: string | number;
  message: string;
  originalError?: unknown;
  context?: Record<string, unknown>;
  timestamp: string;
  userAgent?: string;
  url?: string;
  userId?: number | string;
  restaurantId?: number | string;
}

export function toSystemErrorReportItem(
  error: TrackedError,
): SystemErrorReportItem {
  return {
    type: toSystemErrorType(error.category),
    severity: error.severity,
    code: error.code,
    message: error.message,
    originalError: {
      id: error.id,
      name: error.name,
      stack: error.stack,
      resolved: error.resolved,
      occurrenceCount: error.occurrenceCount,
      firstOccurrence: error.firstOccurrence,
      lastOccurrence: error.lastOccurrence,
    },
    context: error.context as Record<string, unknown>,
    timestamp: new Date(error.timestamp).toISOString(),
    userAgent: navigator.userAgent,
    url: window.location.href,
    userId: error.context.user?.id,
    restaurantId: getRestaurantId(error),
  };
}

export async function reportTrackedError(error: TrackedError): Promise<void> {
  await api.post("/system/error-report", {
    errors: [toSystemErrorReportItem(error)],
  });
}

function toSystemErrorType(
  category: TrackedError["category"],
): SystemErrorType {
  switch (category) {
    case "network":
    case "validation":
      return category;
    case "authentication":
      return "permission";
    default:
      return "unknown";
  }
}

function getRestaurantId(error: TrackedError): number | string | undefined {
  const restaurantId = error.context.extra?.restaurantId;
  if (typeof restaurantId === "string" || typeof restaurantId === "number") {
    return restaurantId;
  }
  return undefined;
}
