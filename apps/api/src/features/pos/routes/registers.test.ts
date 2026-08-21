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
    credentialService: {
      getRegisterRestaurantId: vi.fn(),
      listAgents: vi.fn(),
      issueAgent: vi.fn(),
      revokeAgent: vi.fn(),
    },
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

vi.mock("../services/PrintAgentCredentialService", () => ({
  PrintAgentCredentialService: vi.fn(function PrintAgentCredentialService() {
    return mocks.credentialService;
  }),
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

describe("print agent credentials", () => {
  const agentId = "550e8400-e29b-41d4-a716-4466554400a1";

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = {
      id: "user-10",
      username: "owner",
      role: 1,
      restaurantId: "restaurant-1",
    };
    mocks.credentialService.getRegisterRestaurantId.mockResolvedValue(
      "restaurant-1",
    );
    mocks.credentialService.listAgents.mockResolvedValue([]);
    mocks.credentialService.issueAgent.mockResolvedValue({
      agent: {
        id: "agent-1",
        registerId,
        label: "櫃檯出單機",
        createdAt: new Date(0),
      },
      key: "mmpa_deadbeef",
    });
    mocks.credentialService.revokeAgent.mockResolvedValue(true);
  });

  it("returns the plaintext key exactly once when issuing", async () => {
    const response = await request(`/${registerId}/print-agents`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "櫃檯出單機" }),
    });

    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({
      success: true,
      data: { id: "agent-1", key: "mmpa_deadbeef" },
    });
    expect(mocks.credentialService.issueAgent).toHaveBeenCalledWith(
      registerId,
      "櫃檯出單機",
    );
  });

  it("never lists key material", async () => {
    mocks.credentialService.listAgents.mockResolvedValue([
      {
        id: "agent-1",
        registerId,
        label: "櫃檯出單機",
        createdAt: new Date(0),
      },
    ]);

    const body = await json(await request(`/${registerId}/print-agents`));

    expect(JSON.stringify(body)).not.toContain("mmpa_");
    expect(body.data).toMatchObject([{ id: "agent-1" }]);
  });

  it("revokes an agent scoped to its own register", async () => {
    const response = await request(`/${registerId}/print-agents/${agentId}`, {
      method: "DELETE",
    });

    expect(response.status).toBe(200);
    expect(mocks.credentialService.revokeAgent).toHaveBeenCalledWith(
      registerId,
      agentId,
    );
  });

  it("answers 404 when revoking an agent that is not on this register", async () => {
    mocks.credentialService.revokeAgent.mockResolvedValue(false);

    const response = await request(`/${registerId}/print-agents/${agentId}`, {
      method: "DELETE",
    });

    expect(response.status).toBe(404);
    expect((await json(response)).error?.code).toBe("PRINT_AGENT_NOT_FOUND");
  });

  // The credential *is* the tenant boundary on the print path: whoever holds it
  // gets that register's receipts. requireRole([0, 1]) only proves the caller is
  // an owner somewhere, so each of these must also prove it is this shop's.
  it.each([
    ["POST", `/print-agents`],
    ["GET", `/print-agents`],
    ["DELETE", `/print-agents/${agentId}`],
  ])(
    "refuses %s %s for an owner of another restaurant",
    async (method, suffix) => {
      mocks.credentialService.getRegisterRestaurantId.mockResolvedValue(
        "restaurant-2",
      );

      const response = await request(`/${registerId}${suffix}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: method === "GET" ? undefined : JSON.stringify({ label: "x" }),
      });

      expect(response.status).toBe(403);
      expect(mocks.credentialService.issueAgent).not.toHaveBeenCalled();
      expect(mocks.credentialService.listAgents).not.toHaveBeenCalled();
      expect(mocks.credentialService.revokeAgent).not.toHaveBeenCalled();
    },
  );

  it("lets a platform admin manage any restaurant's register", async () => {
    mocks.user = { id: "user-1", username: "admin", role: 0 } as AuthUser;
    mocks.credentialService.getRegisterRestaurantId.mockResolvedValue(
      "restaurant-2",
    );

    const response = await request(`/${registerId}/print-agents`);

    expect(response.status).toBe(200);
  });

  it("answers 404 for a register that does not exist", async () => {
    mocks.credentialService.getRegisterRestaurantId.mockResolvedValue(null);

    const response = await request(`/${registerId}/print-agents`);

    expect(response.status).toBe(404);
    expect((await json(response)).error?.code).toBe("REGISTER_NOT_FOUND");
  });
});
