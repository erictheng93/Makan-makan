import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthUser } from "../../../middleware/auth";
import { ApiError } from "../../../shared/utils/api-error";

const mocks = vi.hoisted(() => ({
  user: {
    id: "user-10",
    username: "cashier",
    role: 4,
    restaurantId: "restaurant-1",
  } as AuthUser,
  cashMovementService: {
    approveCashMovement: vi.fn(),
    getCashCount: vi.fn(),
    getCashMovements: vi.fn(),
    processCashMovement: vi.fn(),
    rejectCashMovement: vi.fn(),
  },
  cashMovementServiceCtor: vi.fn(),
  tenantAccess: {
    requireCashMovement: vi.fn(),
    requireRegister: vi.fn(),
    requireShift: vi.fn(),
  },
}));

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (c, next) => {
    c.set("user", mocks.user);
    await next();
  }),
  requireRole: vi.fn(
    () => async (_c: unknown, next: () => Promise<void>) => next(),
  ),
}));

vi.mock("../services/CashMovementService", () => ({
  CashMovementService: vi.fn(function CashMovementService(...args: unknown[]) {
    mocks.cashMovementServiceCtor(...args);
    return mocks.cashMovementService;
  }),
}));

vi.mock("../services/PosTenantAccessService", () => ({
  PosTenantAccessService: vi.fn(function PosTenantAccessService() {
    return mocks.tenantAccess;
  }),
}));

import routes from "./cash-movements";

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

const shiftId = "550e8400-e29b-41d4-a716-446655440030";
const registerId = "550e8400-e29b-41d4-a716-446655440031";
const movementId = "550e8400-e29b-41d4-a716-446655440032";
const movement = {
  id: movementId,
  shiftId,
  registerId,
  type: "cash_in",
  amount: 100,
};

function movementPayload() {
  return {
    type: "cash_in",
    amount: 100,
    description: "Starting change",
    denominationBreakdown: { "100": 1 },
    referenceId: 101,
    referenceType: "manual",
  };
}

describe("POS cash movement routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = {
      id: "user-10",
      username: "cashier",
      role: 4,
      restaurantId: "restaurant-1",
    };
    mocks.cashMovementService.processCashMovement.mockResolvedValue({
      success: true,
    });
    mocks.cashMovementService.getCashMovements.mockResolvedValue({
      success: true,
      data: {
        movements: [movement],
        pagination: { page: 2, limit: 5, hasMore: false },
      },
    });
    mocks.cashMovementService.getCashCount.mockResolvedValue({
      success: true,
      data: [movement],
    });
    mocks.cashMovementService.approveCashMovement.mockResolvedValue({
      success: true,
    });
    mocks.cashMovementService.rejectCashMovement.mockResolvedValue({
      success: true,
    });
    mocks.tenantAccess.requireCashMovement.mockResolvedValue(undefined);
    mocks.tenantAccess.requireRegister.mockResolvedValue(undefined);
    mocks.tenantAccess.requireShift.mockResolvedValue(undefined);
  });

  it("blocks foreign shift, register, and movement resources", async () => {
    mocks.tenantAccess.requireShift.mockRejectedValueOnce(
      new ApiError("FORBIDDEN", "只能存取自己餐廳的班次", 403),
    );
    let response = await request(`/shifts/${shiftId}/cash-movements`);
    expect(response.status).toBe(403);
    expect(mocks.cashMovementService.getCashMovements).not.toHaveBeenCalled();

    mocks.tenantAccess.requireRegister.mockRejectedValueOnce(
      new ApiError("FORBIDDEN", "只能存取自己餐廳的收銀機", 403),
    );
    response = await request(`/registers/${registerId}/cash-count`);
    expect(response.status).toBe(403);
    expect(mocks.cashMovementService.getCashCount).not.toHaveBeenCalled();

    mocks.tenantAccess.requireCashMovement.mockRejectedValueOnce(
      new ApiError("FORBIDDEN", "只能存取自己餐廳的現金異動", 403),
    );
    response = await request(`/cash-movements/${movementId}/approve`, {
      method: "POST",
    });
    expect(response.status).toBe(403);
    expect(
      mocks.cashMovementService.approveCashMovement,
    ).not.toHaveBeenCalled();
  });

  it("processes cash movements for the authenticated user", async () => {
    const payload = movementPayload();
    const response = await request(`/shifts/${shiftId}/cash-movements`, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" },
    });
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(mocks.cashMovementServiceCtor).toHaveBeenCalledWith({
      binding: "db",
    });
    expect(mocks.cashMovementService.processCashMovement).toHaveBeenCalledWith(
      shiftId,
      payload,
      "user-10",
    );
    expect(body.success).toBe(true);
  });

  it("validates cash movement payloads and maps processing failures", async () => {
    let response = await request(`/shifts/${shiftId}/cash-movements`, {
      method: "POST",
      body: JSON.stringify({ amount: 100 }),
      headers: { "Content-Type": "application/json" },
    });
    let body = await json(response);

    expect(response.status).toBe(400);
    expect(body.error?.code).toBe("VALIDATION_ERROR");
    expect(
      mocks.cashMovementService.processCashMovement,
    ).not.toHaveBeenCalled();

    mocks.cashMovementService.processCashMovement.mockResolvedValueOnce({
      success: false,
      error: "shift is not active",
    });
    response = await request(`/shifts/${shiftId}/cash-movements`, {
      method: "POST",
      body: JSON.stringify(movementPayload()),
      headers: { "Content-Type": "application/json" },
    });
    body = await json(response);

    expect(response.status).toBe(400);
    expect(body.error?.message).toBe("shift is not active");
  });

  it("lists cash movements with filters and pagination", async () => {
    const response = await request(
      `/shifts/${shiftId}/cash-movements?type=cash_in&page=2&limit=5`,
    );
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(mocks.cashMovementService.getCashMovements).toHaveBeenCalledWith(
      shiftId,
      {
        type: "cash_in",
        page: 2,
        limit: 5,
      },
    );
    expect(body.data).toEqual({
      movements: [movement],
      pagination: { page: 2, limit: 5, hasMore: false },
    });
  });

  it("validates list params and maps list failures", async () => {
    let response = await request("/shifts/not-a-uuid/cash-movements");
    let body = await json(response);

    expect(response.status).toBe(400);
    expect(body.error?.code).toBe("VALIDATION_ERROR");
    expect(mocks.cashMovementService.getCashMovements).not.toHaveBeenCalled();

    mocks.cashMovementService.getCashMovements.mockResolvedValueOnce({
      success: false,
      error: "movements unavailable",
    });
    response = await request(`/shifts/${shiftId}/cash-movements`);
    body = await json(response);

    expect(response.status).toBe(400);
    expect(body.error?.message).toBe("movements unavailable");
  });

  it("returns cash counts for a register and optional date", async () => {
    const response = await request(
      `/registers/${registerId}/cash-count?date=2026-06-07`,
    );
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(mocks.cashMovementService.getCashCount).toHaveBeenCalledWith(
      registerId,
      "2026-06-07",
    );
    expect(body).toEqual({ success: true, data: [movement] });
  });

  it("validates cash-count params and maps service failures", async () => {
    let response = await request("/registers/not-a-uuid/cash-count");
    let body = await json(response);

    expect(response.status).toBe(400);
    expect(body.error?.code).toBe("VALIDATION_ERROR");
    expect(mocks.cashMovementService.getCashCount).not.toHaveBeenCalled();

    mocks.cashMovementService.getCashCount.mockResolvedValueOnce({
      success: false,
      error: "cash count unavailable",
    });
    response = await request(`/registers/${registerId}/cash-count`);
    body = await json(response);

    expect(response.status).toBe(400);
    expect(body.error?.message).toBe("cash count unavailable");
  });

  it("approves and rejects cash movements", async () => {
    let response = await request(`/cash-movements/${movementId}/approve`, {
      method: "POST",
    });
    let body = await json(response);

    expect(response.status).toBe(200);
    expect(mocks.cashMovementService.approveCashMovement).toHaveBeenCalledWith(
      movementId,
      "user-10",
    );
    expect(body.success).toBe(true);

    response = await request(`/cash-movements/${movementId}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason: "duplicate" }),
      headers: { "Content-Type": "application/json" },
    });
    body = await json(response);

    expect(response.status).toBe(200);
    expect(mocks.cashMovementService.rejectCashMovement).toHaveBeenCalledWith(
      movementId,
      "user-10",
      "duplicate",
    );
    expect(body.success).toBe(true);
  });

  it("maps approval and rejection service failures", async () => {
    mocks.cashMovementService.approveCashMovement.mockResolvedValueOnce({
      success: false,
      error: "approval unavailable",
    });
    let response = await request(`/cash-movements/${movementId}/approve`, {
      method: "POST",
    });
    let body = await json(response);

    expect(response.status).toBe(400);
    expect(body.error?.message).toBe("approval unavailable");

    mocks.cashMovementService.rejectCashMovement.mockResolvedValueOnce({
      success: false,
      error: "rejection unavailable",
    });
    response = await request(`/cash-movements/${movementId}/reject`, {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    });
    body = await json(response);

    expect(response.status).toBe(400);
    expect(body.error?.message).toBe("rejection unavailable");
  });
});
