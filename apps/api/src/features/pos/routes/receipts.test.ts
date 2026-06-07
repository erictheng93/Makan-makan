import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../../shared/utils/api-error";

const mocks = vi.hoisted(() => ({
  user: {
    id: 10,
    username: "cashier",
    role: 4,
    restaurantId: "restaurant-1",
  },
  receiptService: {
    cancelPrint: vi.fn(),
    getReceiptDetail: vi.fn(),
    getReceipts: vi.fn(),
    printReceipt: vi.fn(),
    reprintReceipt: vi.fn(),
  },
  receiptServiceCtor: vi.fn(),
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

vi.mock("../services/ReceiptService", () => ({
  ReceiptService: vi.fn(function ReceiptService(...args: unknown[]) {
    mocks.receiptServiceCtor(...args);
    return mocks.receiptService;
  }),
}));

import routes from "./receipts";

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

const receiptId = "550e8400-e29b-41d4-a716-446655440020";
const registerId = "550e8400-e29b-41d4-a716-446655440021";
const shiftId = "550e8400-e29b-41d4-a716-446655440022";
const receipt = {
  id: receiptId,
  orderId: 101,
  registerId,
  receiptType: "customer",
  printStatus: "pending",
};

function printPayload() {
  return {
    orderId: 101,
    templateName: "standard",
    receiptType: "customer",
    copies: 2,
  };
}

describe("POS receipt routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.user = {
      id: 10,
      username: "cashier",
      role: 4,
      restaurantId: "restaurant-1",
    };
    mocks.receiptService.printReceipt.mockResolvedValue({
      success: true,
      data: receipt,
    });
    mocks.receiptService.reprintReceipt.mockResolvedValue({ success: true });
    mocks.receiptService.cancelPrint.mockResolvedValue({ success: true });
    mocks.receiptService.getReceipts.mockResolvedValue({
      success: true,
      data: {
        receipts: [receipt],
        pagination: { page: 2, limit: 5, hasMore: false },
      },
    });
    mocks.receiptService.getReceiptDetail.mockResolvedValue({
      success: true,
      data: receipt,
    });
  });

  it("prints receipts with register and shift headers", async () => {
    const payload = printPayload();
    const response = await request("/print", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
        "X-Register-Id": registerId,
        "X-Shift-Id": shiftId,
      },
    });
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(mocks.receiptServiceCtor).toHaveBeenCalledWith({ binding: "db" });
    expect(mocks.receiptService.printReceipt).toHaveBeenCalledWith(
      payload,
      registerId,
      shiftId,
    );
    expect(body).toEqual({ success: true, data: receipt });
  });

  it("rejects print requests without a register header and maps print failures", async () => {
    let response = await request("/print", {
      method: "POST",
      body: JSON.stringify(printPayload()),
      headers: { "Content-Type": "application/json" },
    });
    let body = await json(response);

    expect(response.status).toBe(400);
    expect(body.error?.code).toBe("BAD_REQUEST");
    expect(mocks.receiptService.printReceipt).not.toHaveBeenCalled();

    mocks.receiptService.printReceipt.mockResolvedValueOnce({
      success: false,
      error: "order not found",
    });
    response = await request("/print", {
      method: "POST",
      body: JSON.stringify(printPayload()),
      headers: {
        "Content-Type": "application/json",
        "X-Register-Id": registerId,
      },
    });
    body = await json(response);

    expect(response.status).toBe(400);
    expect(body.error?.message).toBe("order not found");
  });

  it("reprints and cancels receipts", async () => {
    let response = await request(`/${receiptId}/reprint`, {
      method: "POST",
    });
    let body = await json(response);

    expect(response.status).toBe(200);
    expect(mocks.receiptService.reprintReceipt).toHaveBeenCalledWith(receiptId);
    expect(body.success).toBe(true);

    response = await request(`/${receiptId}/cancel`, { method: "POST" });
    body = await json(response);
    expect(response.status).toBe(200);
    expect(mocks.receiptService.cancelPrint).toHaveBeenCalledWith(receiptId);
    expect(body.success).toBe(true);
  });

  it("maps reprint missing receipts to not found and cancel failures to bad requests", async () => {
    mocks.receiptService.reprintReceipt.mockResolvedValueOnce({
      success: false,
      error: "\u6536\u64da\u4e0d\u5b58\u5728",
    });
    let response = await request(`/${receiptId}/reprint`, {
      method: "POST",
    });
    let body = await json(response);

    expect(response.status).toBe(404);
    expect(body.error?.code).toBe("RECEIPT_NOT_FOUND");

    mocks.receiptService.cancelPrint.mockResolvedValueOnce({
      success: false,
      error: "print already completed",
    });
    response = await request(`/${receiptId}/cancel`, { method: "POST" });
    body = await json(response);

    expect(response.status).toBe(400);
    expect(body.error?.message).toBe("print already completed");
  });

  it("lists receipts with coerced filters and pagination", async () => {
    const response = await request(
      `/registers/${registerId}/receipts?startDate=2026-06-01&endDate=2026-06-07&receiptType=customer&page=2&limit=5`,
    );
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(mocks.receiptService.getReceipts).toHaveBeenCalledWith(registerId, {
      startDate: "2026-06-01",
      endDate: "2026-06-07",
      receiptType: "customer",
      page: 2,
      limit: 5,
    });
    expect(body.data).toEqual({
      receipts: [receipt],
      pagination: { page: 2, limit: 5, hasMore: false },
    });
  });

  it("validates receipt list params and maps list service failures", async () => {
    let response = await request("/registers/not-a-uuid/receipts");
    let body = await json(response);

    expect(response.status).toBe(400);
    expect(body.error?.code).toBe("VALIDATION_ERROR");
    expect(mocks.receiptService.getReceipts).not.toHaveBeenCalled();

    mocks.receiptService.getReceipts.mockResolvedValueOnce({
      success: false,
      error: "receipt list unavailable",
    });
    response = await request(`/registers/${registerId}/receipts`);
    body = await json(response);

    expect(response.status).toBe(400);
    expect(body.error?.message).toBe("receipt list unavailable");
  });

  it("returns receipt details and maps missing details to not found", async () => {
    let response = await request(`/${receiptId}`);
    let body = await json(response);

    expect(response.status).toBe(200);
    expect(mocks.receiptService.getReceiptDetail).toHaveBeenCalledWith(
      receiptId,
    );
    expect(body).toEqual({ success: true, data: receipt });

    mocks.receiptService.getReceiptDetail.mockResolvedValueOnce({
      success: false,
      error: "\u6536\u64da\u4e0d\u5b58\u5728",
    });
    response = await request(`/${receiptId}`);
    body = await json(response);

    expect(response.status).toBe(404);
    expect(body.error?.code).toBe("RECEIPT_NOT_FOUND");
  });
});
