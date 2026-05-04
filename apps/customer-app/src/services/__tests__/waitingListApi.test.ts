import { beforeEach, describe, expect, it, vi } from "vitest";
import { WaitingStatus } from "@makanmakan/shared-types";

vi.mock("@/services/api", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    request: vi.fn(),
  },
}));

import { apiClient } from "@/services/api";
import { waitingListApi } from "@/services/waitingListApi";
import type { JoinWaitingListRequest } from "@makanmakan/shared-types";

const mockGet = apiClient.get as ReturnType<typeof vi.fn>;
const mockPost = apiClient.post as ReturnType<typeof vi.fn>;
const mockRequest = apiClient.request as ReturnType<typeof vi.fn>;

const ticket = {
  id: "ticket-1",
  restaurantId: "restaurant-1",
  customerName: "Ada",
  customerPhone: "0912345678",
  partySize: 2,
  queueNumber: 5,
  queueDisplay: "A005",
  partiesAhead: 1,
  priority: 0,
  status: WaitingStatus.WAITING,
  createdAt: 1,
  updatedAt: 1,
};

describe("waitingListApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("join posts the request body", async () => {
    mockPost.mockResolvedValueOnce(ticket);
    const request: JoinWaitingListRequest = {
      restaurantId: "restaurant-1",
      customerName: "Ada",
      customerPhone: "0912345678",
      partySize: 2,
    };

    const result = await waitingListApi.join(request);

    expect(mockPost).toHaveBeenCalledOnce();
    expect(mockPost).toHaveBeenCalledWith(
      "/waiting-list",
      expect.objectContaining(request),
    );
    expect(result).toEqual(expect.objectContaining({ id: "ticket-1" }));
  });

  it("lookup gets by restaurant and phone query", async () => {
    mockGet.mockResolvedValueOnce(ticket);

    await waitingListApi.lookup("restaurant-1", "0912345678");

    expect(mockGet).toHaveBeenCalledOnce();
    expect(mockGet).toHaveBeenCalledWith(
      "/waiting-list/lookup?restaurantId=restaurant-1&phone=0912345678",
    );
  });

  it("getById gets a ticket by id", async () => {
    mockGet.mockResolvedValueOnce(ticket);

    await waitingListApi.getById("ticket-1");

    expect(mockGet).toHaveBeenCalledOnce();
    expect(mockGet).toHaveBeenCalledWith("/waiting-list/ticket-1");
  });

  it("getQueueStatus gets restaurant queue status", async () => {
    mockGet.mockResolvedValueOnce({
      restaurantId: "restaurant-1",
      totalWaiting: 2,
      averageWaitMinutes: 10,
      availableTables: 1,
      byTableType: [],
    });

    await waitingListApi.getQueueStatus("restaurant-1");

    expect(mockGet).toHaveBeenCalledOnce();
    expect(mockGet).toHaveBeenCalledWith(
      "/waiting-list/queue-status/restaurant-1",
    );
  });

  it("estimateWait gets wait estimate with party size", async () => {
    mockGet.mockResolvedValueOnce({
      estimatedWaitMinutes: 10,
      partiesAhead: 1,
      availableTables: 0,
      confidence: 0.8,
    });

    await waitingListApi.estimateWait("restaurant-1", 4);

    expect(mockGet).toHaveBeenCalledOnce();
    expect(mockGet).toHaveBeenCalledWith(
      "/waiting-list/estimate-wait/restaurant-1?partySize=4",
    );
  });

  it("cancel sends DELETE with customer phone body", async () => {
    mockRequest.mockResolvedValueOnce({
      ...ticket,
      status: WaitingStatus.CANCELLED,
    });

    await waitingListApi.cancel("ticket-1", "0912345678");

    expect(mockRequest).toHaveBeenCalledOnce();
    expect(mockRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "DELETE",
        url: "/waiting-list/ticket-1",
        data: expect.objectContaining({ customerPhone: "0912345678" }),
      }),
    );
  });

  it("confirmArrival posts customer phone body", async () => {
    mockPost.mockResolvedValueOnce({
      ...ticket,
      status: WaitingStatus.CONFIRMED,
    });

    await waitingListApi.confirmArrival("ticket-1", "0912345678");

    expect(mockPost).toHaveBeenCalledOnce();
    expect(mockPost).toHaveBeenCalledWith(
      "/waiting-list/ticket-1/confirm",
      expect.objectContaining({ customerPhone: "0912345678" }),
    );
  });
});
