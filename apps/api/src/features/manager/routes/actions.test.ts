import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "../../../middleware/auth";

const auth = vi.hoisted(() => ({
  user: {
    id: "user-7",
    username: "owner",
    role: 1,
    restaurantId: "rest-1",
  } as AuthUser,
}));

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (c: any, next: any) => {
    c.set("user", auth.user);
    await next();
  }),
  requireRole: vi.fn(
    () => async (_c: unknown, next: () => Promise<void>) => next(),
  ),
}));

const service = vi.hoisted(() => ({
  execute: vi.fn(),
}));

vi.mock("../services/ManagerActionsService", () => ({
  ManagerActionsService: class {
    execute = service.execute;
  },
}));

import app from "./actions";
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

function postAction(body: unknown) {
  return app.request(
    "/actions",
    {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    },
    env,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  auth.user = {
    id: "user-7",
    username: "owner",
    role: 1,
    restaurantId: "rest-1",
  };
  service.execute.mockResolvedValue({
    auditLogId: "audit-1",
    resourceId: "123",
  });
});

describe("manager action routes", () => {
  it("executes a validated manager action with the authenticated user", async () => {
    const response = await postAction({
      restaurantId: "rest-1",
      action: "update_menu_availability",
      resource: "menu_item",
      resourceId: 123,
      onBehalfOfUserId: "99",
      reason: "covering lunch rush",
      payload: { isAvailable: false },
    });

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { auditLogId: "audit-1", resourceId: "123" },
    });
    expect(service.execute).toHaveBeenCalledWith(
      {
        restaurantId: "rest-1",
        action: "update_menu_availability",
        resource: "menu_item",
        resourceId: "123",
        onBehalfOfUserId: "99",
        reason: "covering lunch rush",
        payload: { isAvailable: false },
      },
      auth.user,
    );
  });

  it("rejects unsupported actions before invoking the service", async () => {
    const response = await postAction({
      restaurantId: "rest-1",
      action: "void_order",
      resource: "menu_item",
      resourceId: 123,
    });

    expect(response.status).toBe(400);
    expect(service.execute).not.toHaveBeenCalled();
  });
});
