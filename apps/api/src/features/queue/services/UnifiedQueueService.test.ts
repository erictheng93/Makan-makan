import { beforeEach, describe, expect, it, vi } from "vitest";
import { WaitingStatus } from "@makanmasak/shared-types";
import { UnifiedQueueService } from "./UnifiedQueueService";
import type { Env } from "../../../types/env";

const { waitingListServiceCtor, waitingServiceFns } = vi.hoisted(() => {
  const fns = {
    joinWaitingList: vi.fn(),
    getQueueStatus: vi.fn(),
    listWaitingList: vi.fn(),
    getWaitingListEntryById: vi.fn(),
    findAvailableTable: vi.fn(),
    callWaiting: vi.fn(),
    batchCallNext: vi.fn(),
    markSeated: vi.fn(),
    cancelWaiting: vi.fn(),
  };

  return {
    waitingListServiceCtor: vi.fn(function WaitingListService() {
      return fns;
    }),
    waitingServiceFns: fns,
  };
});

vi.mock("@makanmasak/database", () => ({
  WaitingListService: waitingListServiceCtor,
}));

vi.mock("../../../core/monitoring", () => ({
  ConsoleLogger: class {
    warn = vi.fn();
  },
}));

const env = {
  DB: { prepare: vi.fn() },
} as unknown as Env;

const entry = {
  id: "queue-1",
  restaurantId: "rest-1",
  customerName: "Avery Chen",
  customerPhone: "+60123456789",
  partySize: 4,
  queueNumber: 18,
  queueDisplay: "A018",
  status: WaitingStatus.WAITING,
  estimatedWaitMinutes: 25,
  partiesAhead: 2,
  tableId: 9,
  createdAt: 1717000000,
  calledAt: 1717000300,
};

function createService() {
  return new UnifiedQueueService(env);
}

describe("UnifiedQueueService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("constructs the waiting list service with the API database binding", () => {
    createService();

    expect(waitingListServiceCtor).toHaveBeenCalledWith(env.DB, env);
  });

  it("joins the queue through WaitingListService and normalizes the response", async () => {
    waitingServiceFns.joinWaitingList.mockResolvedValueOnce(entry);

    const result = await createService().joinQueue({
      restaurantId: "rest-1",
      customerName: "Avery Chen",
      customerPhone: "+60123456789",
      partySize: 4,
      specialRequests: "Window seat",
    });

    expect(waitingServiceFns.joinWaitingList).toHaveBeenCalledWith({
      restaurantId: "rest-1",
      customerName: "Avery Chen",
      customerPhone: "+60123456789",
      partySize: 4,
      notes: "Window seat",
    });
    expect(result).toEqual({
      success: true,
      data: {
        queueId: "queue-1",
        queueNumber: 18,
        queueDisplay: "A018",
        status: WaitingStatus.WAITING,
        estimatedWaitMinutes: 25,
        currentPosition: 3,
        customerName: "Avery Chen",
        partySize: 4,
        joinedAt: 1717000000,
      },
    });
  });

  it("rejects joins without a customer phone before calling storage", async () => {
    const result = await createService().joinQueue({
      restaurantId: "rest-1",
      customerName: "Avery Chen",
      customerPhone: "",
      partySize: 2,
    });

    expect(result).toEqual({
      success: false,
      error: "Customer phone is required",
    });
    expect(waitingServiceFns.joinWaitingList).not.toHaveBeenCalled();
  });

  it("returns queue status, waiting entries, and individual queue entries", async () => {
    const status = {
      restaurantId: "rest-1",
      totalWaiting: 2,
      estimatedWaitMinutes: 15,
    };
    waitingServiceFns.getQueueStatus.mockResolvedValueOnce(status);
    waitingServiceFns.listWaitingList.mockResolvedValueOnce({
      data: [entry],
    });
    waitingServiceFns.getWaitingListEntryById.mockResolvedValueOnce(entry);

    await expect(createService().getQueueStatus("rest-1")).resolves.toEqual({
      success: true,
      data: status,
    });
    await expect(
      createService().getCurrentQueue("rest-1", 10),
    ).resolves.toEqual({
      success: true,
      data: [entry],
    });
    await expect(createService().getQueueEntry("queue-1")).resolves.toEqual({
      success: true,
      data: entry,
    });
    expect(waitingServiceFns.listWaitingList).toHaveBeenCalledWith({
      restaurantId: "rest-1",
      status: WaitingStatus.WAITING,
      limit: 10,
    });
  });

  it("uses the default current queue limit and reports missing entries", async () => {
    waitingServiceFns.listWaitingList.mockResolvedValueOnce({ data: [] });
    waitingServiceFns.getWaitingListEntryById.mockResolvedValueOnce(null);

    await expect(createService().getCurrentQueue("rest-1")).resolves.toEqual({
      success: true,
      data: [],
    });
    await expect(createService().getQueueEntry("missing")).resolves.toEqual({
      success: false,
      error: "Queue entry not found",
    });
    expect(waitingServiceFns.listWaitingList).toHaveBeenCalledWith({
      restaurantId: "rest-1",
      status: WaitingStatus.WAITING,
      limit: 50,
    });
  });

  it("calls a specific queue entry using an explicit or discovered table", async () => {
    waitingServiceFns.getWaitingListEntryById
      .mockResolvedValueOnce(entry)
      .mockResolvedValueOnce({ ...entry, tableId: 12 });
    waitingServiceFns.findAvailableTable.mockResolvedValueOnce({ tableId: 12 });
    waitingServiceFns.callWaiting
      .mockResolvedValueOnce(entry)
      .mockResolvedValueOnce({ ...entry, tableId: 12 });

    let result = await createService().callNext("rest-1", {
      restaurantId: "rest-1",
      specificQueueId: "queue-1",
      tableId: 9,
    });

    expect(waitingServiceFns.callWaiting).toHaveBeenCalledWith("queue-1", {
      tableId: 9,
    });
    expect(result).toEqual({
      success: true,
      data: {
        queueId: "queue-1",
        queueNumber: 18,
        queueDisplay: "A018",
        customerName: "Avery Chen",
        customerPhone: "+60123456789",
        tableId: 9,
        status: WaitingStatus.WAITING,
        calledAt: 1717000300,
      },
    });

    result = await createService().callNext("rest-1", {
      restaurantId: "rest-1",
      specificQueueId: "queue-1",
    });

    expect(waitingServiceFns.findAvailableTable).toHaveBeenCalledWith(
      "rest-1",
      4,
    );
    expect(waitingServiceFns.callWaiting).toHaveBeenLastCalledWith("queue-1", {
      tableId: 12,
    });
    expect(result.success).toBe(true);
  });

  it("rejects specific call-next requests for missing, foreign, or untabled entries", async () => {
    waitingServiceFns.getWaitingListEntryById
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ ...entry, restaurantId: "other-rest" })
      .mockResolvedValueOnce(entry);
    waitingServiceFns.findAvailableTable.mockResolvedValueOnce(null);

    await expect(
      createService().callNext("rest-1", {
        restaurantId: "rest-1",
        specificQueueId: "missing",
      }),
    ).resolves.toEqual({
      success: false,
      error: "Queue entry not found",
    });
    await expect(
      createService().callNext("rest-1", {
        restaurantId: "rest-1",
        specificQueueId: "queue-2",
      }),
    ).resolves.toEqual({
      success: false,
      error: "Queue entry does not belong to this restaurant",
    });
    await expect(
      createService().callNext("rest-1", {
        restaurantId: "rest-1",
        specificQueueId: "queue-1",
      }),
    ).resolves.toEqual({
      success: false,
      error: "No available table for party size",
    });
  });

  it("auto-calls the next waiting entry and loads its normalized detail", async () => {
    waitingServiceFns.batchCallNext.mockResolvedValueOnce([
      { id: "queue-1", success: true, message: "Called" },
    ]);
    waitingServiceFns.getWaitingListEntryById.mockResolvedValueOnce({
      ...entry,
      tableId: undefined,
      calledAt: undefined,
    });

    const result = await createService().callNext("rest-1", {
      restaurantId: "rest-1",
    });

    expect(waitingServiceFns.batchCallNext).toHaveBeenCalledWith("rest-1", 1);
    expect(waitingServiceFns.getWaitingListEntryById).toHaveBeenCalledWith(
      "queue-1",
    );
    expect(result).toMatchObject({
      success: true,
      data: {
        queueId: "queue-1",
        tableId: null,
        calledAt: null,
      },
    });
  });

  it("reports auto call-next empty, failed, and missing-detail outcomes", async () => {
    waitingServiceFns.batchCallNext
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { id: "queue-1", success: false, message: "No table available" },
      ])
      .mockResolvedValueOnce([
        { id: "queue-1", success: true, message: "Called" },
      ]);
    waitingServiceFns.getWaitingListEntryById.mockResolvedValueOnce(null);

    await expect(
      createService().callNext("rest-1", { restaurantId: "rest-1" }),
    ).resolves.toEqual({
      success: false,
      error: "No customers waiting in queue",
    });
    await expect(
      createService().callNext("rest-1", { restaurantId: "rest-1" }),
    ).resolves.toEqual({
      success: false,
      error: "No table available",
    });
    await expect(
      createService().callNext("rest-1", { restaurantId: "rest-1" }),
    ).resolves.toEqual({
      success: false,
      error: "Failed to load queue entry after calling",
    });
  });

  it("seats and cancels queue entries", async () => {
    waitingServiceFns.markSeated.mockResolvedValueOnce(undefined);
    waitingServiceFns.cancelWaiting.mockResolvedValueOnce(undefined);

    await expect(createService().seatCustomer("queue-1")).resolves.toEqual({
      success: true,
    });
    await expect(createService().cancelQueue("queue-1")).resolves.toEqual({
      success: true,
    });
    expect(waitingServiceFns.markSeated).toHaveBeenCalledWith("queue-1");
    expect(waitingServiceFns.cancelWaiting).toHaveBeenCalledWith("queue-1");
  });

  it("converts storage errors into API error responses", async () => {
    waitingServiceFns.getQueueStatus.mockRejectedValueOnce(
      new Error("offline"),
    );
    waitingServiceFns.listWaitingList.mockRejectedValueOnce("bad list");
    waitingServiceFns.getWaitingListEntryById.mockRejectedValueOnce(
      new Error("bad entry"),
    );
    waitingServiceFns.batchCallNext.mockRejectedValueOnce(
      new Error("bad call"),
    );
    waitingServiceFns.markSeated.mockRejectedValueOnce(new Error("bad seat"));
    waitingServiceFns.cancelWaiting.mockRejectedValueOnce(
      new Error("bad cancel"),
    );

    await expect(createService().getQueueStatus("rest-1")).resolves.toEqual({
      success: false,
      error: "offline",
    });
    await expect(createService().getCurrentQueue("rest-1")).resolves.toEqual({
      success: false,
      error: "Failed to get current queue",
    });
    await expect(createService().getQueueEntry("queue-1")).resolves.toEqual({
      success: false,
      error: "bad entry",
    });
    await expect(
      createService().callNext("rest-1", { restaurantId: "rest-1" }),
    ).resolves.toEqual({
      success: false,
      error: "bad call",
    });
    await expect(createService().seatCustomer("queue-1")).resolves.toEqual({
      success: false,
      error: "bad seat",
    });
    await expect(createService().cancelQueue("queue-1")).resolves.toEqual({
      success: false,
      error: "bad cancel",
    });
  });
});
