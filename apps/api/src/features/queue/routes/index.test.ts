import { beforeEach, describe, expect, it, vi } from "vitest";

const authState = vi.hoisted(() => ({
  user: { id: 7, role: 1, restaurantId: "rest-1" } as {
    id: number;
    role: number;
    restaurantId?: string | number;
  },
}));

vi.mock("../../../middleware/auth", () => ({
  authMiddleware: vi.fn(async (c, next) => {
    c.set("user", authState.user);
    await next();
  }),
  optionalAuth: vi.fn(async (_c, next) => next()),
}));

const serviceFns = vi.hoisted(() => ({
  joinQueue: vi.fn(),
  getQueueStatus: vi.fn(),
  getCurrentQueue: vi.fn(),
  getQueueEntry: vi.fn(),
  callNext: vi.fn(),
  seatCustomer: vi.fn(),
  cancelQueue: vi.fn(),
}));

vi.mock("../services/UnifiedQueueService", () => ({
  UnifiedQueueService: class {
    joinQueue = serviceFns.joinQueue;
    getQueueStatus = serviceFns.getQueueStatus;
    getCurrentQueue = serviceFns.getCurrentQueue;
    getQueueEntry = serviceFns.getQueueEntry;
    callNext = serviceFns.callNext;
    seatCustomer = serviceFns.seatCustomer;
    cancelQueue = serviceFns.cancelQueue;
  },
}));

import routes from "./index";
import { ApiError } from "../../../shared/utils/api-error";

routes.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json(
      { success: false, error: { code: err.code, message: err.message } },
      err.status as 400 | 401 | 403 | 404 | 409,
    );
  }

  return c.json({ success: false, error: { message: String(err) } }, 500);
});

function request(path: string, method = "GET", body?: unknown) {
  return routes.request(
    path,
    {
      method,
      body: body === undefined ? undefined : JSON.stringify(body),
      headers:
        body === undefined ? undefined : { "Content-Type": "application/json" },
    },
    { DB: {} } as never,
  );
}

const queueEntry = {
  id: "queue-1",
  restaurantId: "rest-1",
  queueNumber: 12,
  queueDisplay: "A012",
  customerName: "Amy",
  customerPhone: "0912345678",
  partySize: 3,
  partiesAhead: 2,
  estimatedWaitMinutes: 18,
  status: "waiting",
  createdAt: 1780826400000,
};

const joinResult = {
  queueId: "queue-1",
  queueNumber: 12,
  queueDisplay: "A012",
  status: "waiting",
  estimatedWaitMinutes: 18,
  currentPosition: 3,
  customerName: "Amy",
  partySize: 3,
  joinedAt: 1780826400000,
};

const callResult = {
  queueId: "queue-1",
  queueNumber: 12,
  queueDisplay: "A012",
  customerName: "Amy",
  customerPhone: "0912345678",
  tableId: 9,
  status: "called",
  calledAt: 1780827000000,
};

beforeEach(() => {
  vi.clearAllMocks();
  authState.user = { id: 7, role: 1, restaurantId: "rest-1" };
  serviceFns.joinQueue.mockResolvedValue({ success: true, data: joinResult });
  serviceFns.getQueueStatus.mockResolvedValue({
    success: true,
    data: {
      restaurantId: "rest-1",
      totalWaiting: 2,
      estimatedWaitMinutes: 18,
    },
  });
  serviceFns.getCurrentQueue.mockResolvedValue({
    success: true,
    data: [queueEntry],
  });
  serviceFns.getQueueEntry.mockResolvedValue({
    success: true,
    data: queueEntry,
  });
  serviceFns.callNext.mockResolvedValue({ success: true, data: callResult });
  serviceFns.seatCustomer.mockResolvedValue({ success: true });
  serviceFns.cancelQueue.mockResolvedValue({ success: true });
});

describe("queue routes", () => {
  it("joins the queue from camelCase and snake_case request bodies", async () => {
    let response = await request("/join", "POST", {
      restaurantId: "rest-1",
      customerName: "Amy",
      customerPhone: "0912345678",
      partySize: 3,
      specialRequests: "Window seat",
    });

    expect(response.status).toBe(200);
    expect(serviceFns.joinQueue).toHaveBeenCalledWith({
      restaurantId: "rest-1",
      customerName: "Amy",
      customerPhone: "0912345678",
      partySize: 3,
      specialRequests: "Window seat",
    });
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: joinResult,
    });

    response = await request("/join", "POST", {
      restaurant_id: "rest-2",
      customer_name: "Ben",
      customer_phone: "0987654321",
      party_size: 2,
      special_requests: "High chair",
    });

    expect(response.status).toBe(200);
    expect(serviceFns.joinQueue).toHaveBeenLastCalledWith({
      restaurantId: "rest-2",
      customerName: "Ben",
      customerPhone: "0987654321",
      partySize: 2,
      specialRequests: "High chair",
    });
  });

  it("rejects invalid join requests and service failures", async () => {
    let response = await request("/join", "POST", {
      restaurantId: "rest-1",
      customerName: "Amy",
    });

    expect(response.status).toBe(400);
    expect(serviceFns.joinQueue).not.toHaveBeenCalled();

    serviceFns.joinQueue.mockResolvedValueOnce({
      success: false,
      error: "closed",
    });

    response = await request("/join", "POST", {
      restaurantId: "rest-1",
      customerName: "Amy",
      customerPhone: "0912345678",
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: { message: "closed" },
    });
  });

  it("returns public status, ticket position, and health responses", async () => {
    let response = await request("/rest-1/status");

    expect(response.status).toBe(200);
    expect(serviceFns.getQueueStatus).toHaveBeenCalledWith("rest-1");
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { restaurantId: "rest-1", totalWaiting: 2 },
    });

    response = await request("/queue-1/position");

    expect(response.status).toBe(200);
    expect(serviceFns.getQueueEntry).toHaveBeenCalledWith("queue-1");
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: {
        queueId: "queue-1",
        currentPosition: 3,
        partiesAhead: 2,
        estimatedWaitMinutes: 18,
        status: "waiting",
        canCancel: true,
      },
    });

    serviceFns.getQueueEntry.mockResolvedValueOnce({
      success: true,
      data: {
        ...queueEntry,
        status: "seated",
        estimatedWaitMinutes: null,
      },
    });
    response = await request("/queue-1/position");

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      data: { estimatedWaitMinutes: 0, canCancel: false },
    });

    response = await request("/health");
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { status: "healthy", backend: "WaitingListService" },
    });
  });

  it("maps public lookup failures to bad requests", async () => {
    serviceFns.getQueueStatus.mockResolvedValueOnce({
      success: false,
      error: "status unavailable",
    });

    let response = await request("/rest-1/status");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { message: "status unavailable" },
    });

    serviceFns.getQueueEntry.mockResolvedValueOnce({
      success: false,
      error: "missing",
    });

    response = await request("/queue-404/position");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { message: "missing" },
    });
  });

  it("returns current queue for authorized staff and constrains restaurant access", async () => {
    let response = await request("/rest-1/current?limit=5");

    expect(response.status).toBe(200);
    expect(serviceFns.getCurrentQueue).toHaveBeenCalledWith("rest-1", 5);
    await expect(response.json()).resolves.toMatchObject({
      data: { queue: [queueEntry], total: 1 },
    });

    response = await request("/rest-1/current?limit=bad");

    expect(response.status).toBe(200);
    expect(serviceFns.getCurrentQueue).toHaveBeenLastCalledWith(
      "rest-1",
      undefined,
    );

    authState.user = { id: 1, role: 0 };
    response = await request("/rest-2/current");
    expect(response.status).toBe(200);

    authState.user = { id: 8, role: 1, restaurantId: "rest-1" };
    response = await request("/rest-2/current");
    expect(response.status).toBe(403);
  });

  it("calls the next queue entry after access checks", async () => {
    let response = await request("/rest-1/call-next", "POST", {
      tableId: 9,
      specificQueueId: "queue-1",
    });

    expect(response.status).toBe(200);
    expect(serviceFns.callNext).toHaveBeenCalledWith("rest-1", {
      restaurantId: "rest-1",
      tableId: 9,
      specificQueueId: "queue-1",
    });
    await expect(response.json()).resolves.toMatchObject({
      data: callResult,
    });

    response = await request("/rest-1/call-next", "POST");
    expect(response.status).toBe(200);
    expect(serviceFns.callNext).toHaveBeenLastCalledWith("rest-1", {
      restaurantId: "rest-1",
      tableId: undefined,
      specificQueueId: undefined,
    });

    serviceFns.callNext.mockResolvedValueOnce({
      success: false,
      error: "none waiting",
    });
    response = await request("/rest-1/call-next", "POST", {});
    expect(response.status).toBe(400);

    authState.user = { id: 9, role: 1, restaurantId: "other" };
    response = await request("/rest-1/call-next", "POST", {});
    expect(response.status).toBe(403);
  });

  it("seats and cancels queue entries", async () => {
    let response = await request("/queue-1/seat", "POST");

    expect(response.status).toBe(200);
    expect(serviceFns.seatCustomer).toHaveBeenCalledWith("queue-1");
    await expect(response.json()).resolves.toMatchObject({
      data: { message: "Customer seated successfully" },
    });

    serviceFns.seatCustomer.mockResolvedValueOnce({
      success: false,
      error: "not called",
    });
    response = await request("/queue-1/seat", "POST");
    expect(response.status).toBe(400);

    response = await request("/queue-1/cancel", "POST");

    expect(response.status).toBe(200);
    expect(serviceFns.cancelQueue).toHaveBeenCalledWith("queue-1");
    await expect(response.json()).resolves.toMatchObject({
      data: { message: "Queue entry cancelled" },
    });

    serviceFns.cancelQueue.mockResolvedValueOnce({
      success: false,
      error: "already seated",
    });
    response = await request("/queue-1/cancel", "POST");
    expect(response.status).toBe(400);
  });
});
