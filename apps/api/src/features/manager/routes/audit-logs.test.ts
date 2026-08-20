import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "../../../middleware/auth";

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set("user", {
      id: "user-1",
      username: "admin",
      role: 0,
      restaurantId: "platform",
    } satisfies AuthUser);
    await next();
  }),
  requireRole: vi.fn(
    () => async (_c: unknown, next: () => Promise<void>) => next(),
  ),
}));

const service = vi.hoisted(() => ({
  list: vi.fn(),
}));

vi.mock("../services/AuditLogService", () => ({
  AuditLogService: class {
    list = service.list;
  },
}));

import app from "./audit-logs";
import { ApiError } from "../../../shared/utils/api-error";

app.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json(
      { success: false, error: { code: err.code, message: err.message } },
      err.status as 400 | 401 | 403 | 404 | 409,
    );
  }
  return c.json({ success: false, error: { message: String(err) } }, 500);
});

const env = { DB: {} } as never;

function getAuditLogs(query = "") {
  return app.request(`/${query}`, { method: "GET" }, env);
}

beforeEach(() => {
  vi.clearAllMocks();
  service.list.mockResolvedValue({
    logs: [{ id: 1, action: "update_menu_availability" }],
    count: 1,
  });
});

describe("manager audit log routes", () => {
  it("lists audit logs with parsed filters and defaults", async () => {
    const response = await getAuditLogs(
      "?resourceId=123&resource=menu_item&actorId=7&onBehalfOfUserId=9&restaurantId=rest-1&action=update_menu_availability",
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: {
        logs: [{ id: 1, action: "update_menu_availability" }],
        count: 1,
      },
    });
    expect(service.list).toHaveBeenCalledWith({
      resourceId: "123",
      resource: "menu_item",
      actorId: "7",
      onBehalfOfUserId: "9",
      restaurantId: "rest-1",
      action: "update_menu_availability",
      limit: 50,
      offset: 0,
    });
  });

  it("rejects invalid numeric filters before invoking the service", async () => {
    const response = await getAuditLogs("?actorId=owner");

    expect(response.status).toBe(200);
    expect(service.list).toHaveBeenCalledWith(
      expect.objectContaining({ actorId: "owner" }),
    );
  });
});
