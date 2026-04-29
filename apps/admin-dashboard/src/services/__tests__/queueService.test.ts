import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/services/api", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
  unwrapApiData: vi.fn((response: { data: unknown }) => {
    const payload = response.data;
    return typeof payload === "object" && payload !== null && "data" in payload
      ? payload.data
      : payload;
  }),
}));

import { apiClient } from "@/services/api";
import { queueService } from "../queueService";

describe("queueService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("maps WaitingListService queue entries to dashboard queue items", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        data: {
          queue: [
            {
              id: "entry-1",
              restaurantId: "rest-1",
              customerName: "Alice",
              customerPhone: "0912345678",
              partySize: 4,
              queueNumber: 12,
              queueDisplay: "A012",
              priority: 0,
              estimatedWaitMinutes: 20,
              tableId: 7,
              status: "waiting",
              notes: "Window",
              createdAt: 1777420800000,
              calledAt: null,
              seatedAt: null,
              partiesAhead: 2,
            },
          ],
          total: 1,
        },
      },
    });

    const result = await queueService.getQueue("rest-1");

    expect(apiClient.get).toHaveBeenCalledWith("/queue/rest-1/current", {
      params: undefined,
    });
    expect(result).toEqual([
      expect.objectContaining({
        id: "entry-1",
        restaurantId: "rest-1",
        customerName: "Alice",
        partySize: 4,
        queueNumber: 12,
        status: "waiting",
        assignedTableId: 7,
        specialRequests: "Window",
        joinedAt: "2026-04-29T00:00:00.000Z",
      }),
    ]);
  });

  it("normalizes queue status totals for existing dashboard consumers", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        data: {
          restaurantId: "rest-1",
          totalWaiting: 6,
          averageWaitMinutes: 18,
          availableTables: 3,
          byTableType: [{ type: "4-person", waiting: 2, averageWait: 15 }],
        },
      },
    });

    const result = await queueService.getQueueStatus("rest-1");

    expect(result.queue).toMatchObject({
      total_waiting: 6,
      avg_estimated_wait: 18,
      available_tables: 3,
      by_table_type: [{ type: "4-person", waiting: 2, averageWait: 15 }],
    });
  });

  it("calls the restaurant-scoped call-next route and maps the response item", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      data: {
        success: true,
        data: {
          queueId: "entry-1",
          queueNumber: 12,
          queueDisplay: "A012",
          customerName: "Alice",
          customerPhone: "0912345678",
          tableId: 7,
          status: "called",
          calledAt: 1777420860000,
        },
      },
    });

    const result = await queueService.callNext("rest-1", {
      specificQueueId: "entry-1",
      tableId: 7,
    });

    expect(apiClient.post).toHaveBeenCalledWith("/queue/rest-1/call-next", {
      specificQueueId: "entry-1",
      tableId: 7,
    });
    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({
        id: "entry-1",
        queueNumber: 12,
        customerName: "Alice",
        assignedTableId: 7,
        status: "called",
        calledAt: "2026-04-29T00:01:00.000Z",
      }),
    });
  });
});
