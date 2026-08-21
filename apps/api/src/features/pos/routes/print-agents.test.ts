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
    service: {
      registerBelongsToRestaurant: vi.fn(),
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
    return mocks.service;
  }),
}));

import routes from "./print-agents";

routes.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json(
      { success: false, error: { code: err.code, message: err.message } },
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
    error?: { code?: string };
  };
}

const registerId = "550e8400-e29b-41d4-a716-446655440001";
const agentId = "550e8400-e29b-41d4-a716-4466554400a1";

describe("print agent credentials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = {
      id: "user-10",
      username: "owner",
      role: 1,
      restaurantId: "restaurant-1",
    };
    mocks.service.registerBelongsToRestaurant.mockResolvedValue(true);
    mocks.service.listAgents.mockResolvedValue([]);
    mocks.service.issueAgent.mockResolvedValue({
      agent: {
        id: agentId,
        restaurantId: "restaurant-1",
        registerId: null,
        registerName: null,
        label: "廚房出單機",
        status: "never_seen",
        printersTotal: null,
        printersOnline: null,
        createdAt: new Date(0),
      },
      key: "mmpa_deadbeef",
    });
    mocks.service.revokeAgent.mockResolvedValue(true);
  });

  it("issues a shop-wide agent when no register is named", async () => {
    // A kitchen printer has no till to belong to; that is the whole reason
    // provisioning moved off /registers/:registerId.
    const response = await request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "廚房出單機" }),
    });

    expect(response.status).toBe(200);
    expect(await json(response)).toMatchObject({
      data: { registerId: null, key: "mmpa_deadbeef" },
    });
    expect(mocks.service.issueAgent).toHaveBeenCalledWith(
      "restaurant-1",
      "廚房出單機",
      undefined,
    );
  });

  it("issues a till-bound agent when a register is named", async () => {
    const response = await request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "櫃檯出單機", registerId }),
    });

    expect(response.status).toBe(200);
    expect(mocks.service.issueAgent).toHaveBeenCalledWith(
      "restaurant-1",
      "櫃檯出單機",
      registerId,
    );
  });

  it("refuses to bind an agent to another restaurant's register", async () => {
    mocks.service.registerBelongsToRestaurant.mockResolvedValue(false);

    const response = await request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "偷渡", registerId }),
    });

    expect(response.status).toBe(404);
    expect(mocks.service.issueAgent).not.toHaveBeenCalled();
  });

  it("never lists key material", async () => {
    mocks.service.listAgents.mockResolvedValue([
      {
        id: agentId,
        restaurantId: "restaurant-1",
        registerId: null,
        registerName: null,
        label: "廚房出單機",
        status: "no_printer",
        printersTotal: 1,
        printersOnline: 0,
        lastSeenAt: new Date(0),
        createdAt: new Date(0),
      },
    ]);

    const body = await json(await request("/"));

    expect(JSON.stringify(body)).not.toContain("mmpa_");
    expect(body.data).toMatchObject([{ id: agentId, status: "no_printer" }]);
  });

  it("scopes every action to the caller's own restaurant", async () => {
    // The restaurant is never taken from the request for a shop user: this key
    // is the cloud's tenant boundary, so naming a restaurant would mean issuing
    // another shop's credential.
    await request("/?restaurantId=restaurant-2");
    await request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: "x" }),
    });
    await request(`/${agentId}`, { method: "DELETE" });

    expect(mocks.service.listAgents).toHaveBeenCalledWith("restaurant-1");
    expect(mocks.service.issueAgent).toHaveBeenCalledWith(
      "restaurant-1",
      "x",
      undefined,
    );
    expect(mocks.service.revokeAgent).toHaveBeenCalledWith(
      "restaurant-1",
      agentId,
    );
  });

  it("requires a platform admin to name the restaurant", async () => {
    mocks.user = { id: "user-1", username: "admin", role: 0 } as AuthUser;

    const response = await request("/");

    expect(response.status).toBe(400);
    expect((await json(response)).error?.code).toBe("RESTAURANT_ID_REQUIRED");
    expect(mocks.service.listAgents).not.toHaveBeenCalled();
  });

  it("lets a platform admin read a named restaurant", async () => {
    mocks.user = { id: "user-1", username: "admin", role: 0 } as AuthUser;

    const response = await request("/?restaurantId=restaurant-2");

    expect(response.status).toBe(200);
    expect(mocks.service.listAgents).toHaveBeenCalledWith("restaurant-2");
  });

  it("refuses an account with no restaurant", async () => {
    mocks.user = { id: "user-9", username: "orphan", role: 1 } as AuthUser;

    expect((await request("/")).status).toBe(403);
    expect(mocks.service.listAgents).not.toHaveBeenCalled();
  });

  it("answers 404 when revoking an agent from another restaurant", async () => {
    mocks.service.revokeAgent.mockResolvedValue(false);

    const response = await request(`/${agentId}`, { method: "DELETE" });

    expect(response.status).toBe(404);
    expect((await json(response)).error?.code).toBe("PRINT_AGENT_NOT_FOUND");
  });
});
