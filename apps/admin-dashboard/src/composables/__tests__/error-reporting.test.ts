import { describe, expect, it, vi } from "vitest";
import type { TrackedError } from "@makanmasak/utils";

const mockApiPost = vi.hoisted(() => vi.fn());

vi.mock("@/services/api", () => ({
  api: {
    post: mockApiPost,
  },
}));

import {
  reportTrackedError,
  toSystemErrorReportItem,
} from "../error-reporting";

const trackedError: TrackedError = {
  id: "error-1",
  message: "Session expired",
  stack: "stack",
  name: "AuthError",
  code: "SESSION_EXPIRED",
  severity: "high",
  category: "authentication",
  context: {
    user: { id: "user-1", role: "admin", email: "admin@example.com" },
    extra: { restaurantId: "restaurant-1" },
  },
  breadcrumbs: [],
  timestamp: Date.UTC(2026, 0, 1),
  resolved: false,
  occurrenceCount: 2,
  firstOccurrence: Date.UTC(2026, 0, 1),
  lastOccurrence: Date.UTC(2026, 0, 1, 0, 1),
};

describe("error-reporting", () => {
  it("maps tracked errors to the system error-report schema", () => {
    expect(toSystemErrorReportItem(trackedError)).toMatchObject({
      type: "permission",
      severity: "high",
      code: "SESSION_EXPIRED",
      message: "Session expired",
      context: trackedError.context,
      timestamp: "2026-01-01T00:00:00.000Z",
      userId: "user-1",
      restaurantId: "restaurant-1",
      originalError: {
        id: "error-1",
        name: "AuthError",
        occurrenceCount: 2,
      },
    });
  });

  it("posts tracked errors to the existing system endpoint", async () => {
    mockApiPost.mockResolvedValueOnce({ data: { success: true } });

    await reportTrackedError(trackedError);

    expect(mockApiPost).toHaveBeenCalledWith("/system/error-report", {
      errors: [expect.objectContaining({ message: "Session expired" })],
    });
  });
});
