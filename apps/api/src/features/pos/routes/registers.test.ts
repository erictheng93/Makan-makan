import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../shared/utils/api-error";
import type { AuthUser } from "../../../middleware/auth";

const mocks = vi.hoisted(() => {
  const user: AuthUser = {
    id: "user-10",
    username: "owner",
    role: 1,
    restaurantId: "restaurant-1",
  };
  return {
    user,
    registerService: {
      createRegister: vi.fn(),
      deleteRegister: vi.fn(),
      getRegisters: vi.fn(),
      getRegisterStatus: vi.fn(),
      toggleRegisterStatus: vi.fn(),
      updateRegister: vi.fn(),
    },
    registerServiceCtor: vi.fn(),
  };
});

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (c, next) => {
    c.set("user", mocks.user);
    await next();
  }),
  requireRole: vi.fn(
    () => async (_c: unknown, next: () => Promise<void>) => next(),
  ),
}));

vi.mock("../services/RegisterService", () => ({
  RegisterService: vi.fn(function RegisterService(...args: unknown[]) {
    mocks.registerServiceCtor(...args);
    return mocks.registerService;
  }),
}));

import routes from "./registers";

routes.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json(
      {
        success: false,
        error: {
          code: err.code,
          message: err.message,
          details: err.details,
        },
      },
      err.status as 400 | 401 | 403 | 404 | 409,
    );
  }

  return c.json({ success: false, error: { message: String(err) } }, 500);
});

function request(path: string, init: RequestInit = {}) {
  return routes.request(path, init, { DB: { binding: "db" } } as never);
}

async function json(response: Response) {
  return (await response.json()) as {
    success: boolean;
    data?: unknown;
    message?: string;
    error?: { code?: string; message?: string; details?: unknown };
  };
}

const registerId = "550e8400-e29b-41d4-a716-446655440001";
const register = {
  id: registerId,
  name: "Front POS",
  restaurantId: "restaurant-1",
  isActive: true,
};

describe("POS register routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = {
      id: "user-10",
      username: "owner",
      role: 1,
      restaurantId: "restaurant-1",
    };
    mocks.registerService.createRegister.mockResolvedValue({
      success: true,
      data: register,
    });
    mocks.registerService.getRegisters.mockResolvedValue({
      success: true,
      data: [register],
    });
    mocks.registerService.getRegisterStatus.mockResolvedValue({
      success: true,
      data: { ...register, isShiftActive: false },
    });
    mocks.registerService.updateRegister.mockResolvedValue({
      success: true,
      data: { ...register, name: "Bar POS" },
    });
    mocks.registerService.toggleRegisterStatus.mockResolvedValue({
      success: true,
    });
    mocks.registerService.deleteRegister.mockResolvedValue({ success: true });
  });

  it("creates registers for the owner restaurant", async () => {
    const payload = {
      name: "Front POS",
      location: "Front counter",
      restaurantId: "restaurant-1",
      hardwareConfig: { drawer: true },
    };

    const response = await request("/", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    });
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(mocks.registerServiceCtor).toHaveBeenCalledWith({ binding: "db" });
    expect(mocks.registerService.createRegister).toHaveBeenCalledWith(
      payload,
      "user-10",
    );
    expect(body).toEqual({ success: true, data: register });
  });

  it("rejects owner create and list requests for another restaurant", async () => {
    let response = await request("/", {
      method: "POST",
      body: JSON.stringify({
        name: "Other POS",
        restaurantId: "restaurant-2",
      }),
      headers: { "Content-Type": "application/json" },
    });
    let body = await json(response);

    expect(response.status).toBe(403);
    expect(body.error?.code).toBe("FORBIDDEN");
    expect(mocks.registerService.createRegister).not.toHaveBeenCalled();

    response = await request("/?restaurantId=restaurant-2");
    body = await json(response);

    expect(response.status).toBe(403);
    expect(body.error?.code).toBe("FORBIDDEN");
    expect(mocks.registerService.getRegisters).not.toHaveBeenCalled();
  });

  it("lists registers with owner defaults and explicit admin restaurant scope", async () => {
    let response = await request("/");
    let body = await json(response);

    expect(response.status).toBe(200);
    expect(mocks.registerService.getRegisters).toHaveBeenCalledWith(
      "restaurant-1",
    );
    expect(body).toEqual({ success: true, data: [register] });

    mocks.user = {
      id: "user-1",
      username: "admin",
      role: 0,
      restaurantId: undefined,
    };
    response = await request("/?restaurantId=restaurant-2");
    body = await json(response);

    expect(response.status).toBe(200);
    expect(mocks.registerService.getRegisters).toHaveBeenLastCalledWith(
      "restaurant-2",
    );
    expect(body.success).toBe(true);
  });

  it("rejects admin list requests without a restaurant scope and service failures", async () => {
    mocks.user = {
      id: "user-1",
      username: "admin",
      role: 0,
      restaurantId: undefined,
    };
    let response = await request("/");
    let body = await json(response);

    expect(response.status).toBe(400);
    expect(body.error?.code).toBe("BAD_REQUEST");
    expect(mocks.registerService.getRegisters).not.toHaveBeenCalled();

    mocks.user.restaurantId = "restaurant-1";
    mocks.registerService.getRegisters.mockResolvedValueOnce({
      success: false,
      error: "register list unavailable",
    });
    response = await request("/");
    body = await json(response);

    expect(response.status).toBe(400);
    expect(body.error?.message).toBe("register list unavailable");
  });

  it("returns register status and update responses", async () => {
    let response = await request(`/${registerId}/status`);
    let body = await json(response);

    expect(response.status).toBe(200);
    expect(mocks.registerService.getRegisterStatus).toHaveBeenCalledWith(
      registerId,
    );
    expect(body.data).toEqual({ ...register, isShiftActive: false });

    response = await request(`/${registerId}`, {
      method: "PUT",
      body: JSON.stringify({ name: "Bar POS" }),
      headers: { "Content-Type": "application/json" },
    });
    body = await json(response);

    expect(response.status).toBe(200);
    expect(mocks.registerService.updateRegister).toHaveBeenCalledWith(
      registerId,
      { name: "Bar POS" },
    );
    expect(body.data).toEqual({ ...register, name: "Bar POS" });
  });

  it("maps register status and update service failures to bad requests", async () => {
    mocks.registerService.getRegisterStatus.mockResolvedValueOnce({
      success: false,
      error: "status unavailable",
    });
    let response = await request(`/${registerId}/status`);
    let body = await json(response);

    expect(response.status).toBe(400);
    expect(body.error?.message).toBe("status unavailable");

    mocks.registerService.updateRegister.mockResolvedValueOnce({
      success: false,
      error: "update unavailable",
    });
    response = await request(`/${registerId}`, {
      method: "PUT",
      body: JSON.stringify({ name: "Bar POS" }),
      headers: { "Content-Type": "application/json" },
    });
    body = await json(response);

    expect(response.status).toBe(400);
    expect(body.error?.message).toBe("update unavailable");
  });

  it("activates, deactivates, and deletes registers", async () => {
    let response = await request(`/${registerId}/activate`, {
      method: "POST",
    });
    let body = await json(response);

    expect(response.status).toBe(200);
    expect(mocks.registerService.toggleRegisterStatus).toHaveBeenCalledWith(
      registerId,
      true,
    );
    expect(body.success).toBe(true);

    response = await request(`/${registerId}/deactivate`, { method: "POST" });
    body = await json(response);
    expect(response.status).toBe(200);
    expect(mocks.registerService.toggleRegisterStatus).toHaveBeenLastCalledWith(
      registerId,
      false,
    );
    expect(body.success).toBe(true);

    response = await request(`/${registerId}`, { method: "DELETE" });
    body = await json(response);
    expect(response.status).toBe(200);
    expect(mocks.registerService.deleteRegister).toHaveBeenCalledWith(
      registerId,
    );
    expect(body.success).toBe(true);
  });

  it("maps activate, deactivate, delete, and create service failures", async () => {
    mocks.registerService.createRegister.mockResolvedValueOnce({
      success: false,
      error: "create unavailable",
    });
    let response = await request("/", {
      method: "POST",
      body: JSON.stringify({ name: "Front POS", restaurantId: "restaurant-1" }),
      headers: { "Content-Type": "application/json" },
    });
    let body = await json(response);
    expect(response.status).toBe(400);
    expect(body.error?.message).toBe("create unavailable");

    mocks.registerService.toggleRegisterStatus.mockResolvedValueOnce({
      success: false,
      error: "activate unavailable",
    });
    response = await request(`/${registerId}/activate`, { method: "POST" });
    body = await json(response);
    expect(response.status).toBe(400);
    expect(body.error?.message).toBe("activate unavailable");

    mocks.registerService.toggleRegisterStatus.mockResolvedValueOnce({
      success: false,
      error: "deactivate unavailable",
    });
    response = await request(`/${registerId}/deactivate`, { method: "POST" });
    body = await json(response);
    expect(response.status).toBe(400);
    expect(body.error?.message).toBe("deactivate unavailable");

    mocks.registerService.deleteRegister.mockResolvedValueOnce({
      success: false,
      error: "delete unavailable",
    });
    response = await request(`/${registerId}`, { method: "DELETE" });
    body = await json(response);
    expect(response.status).toBe(400);
    expect(body.error?.message).toBe("delete unavailable");
  });
});
