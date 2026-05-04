import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WaitingStatus } from "@makanmasak/shared-types";
import JoinWaitingListView from "@/views/waiting-list/JoinWaitingListView.vue";

const routerMocks = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
}));

vi.mock("vue-router", () => ({
  useRouter: () => ({
    push: routerMocks.push,
    replace: routerMocks.replace,
  }),
}));

vi.mock("@/composables/useI18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
    tWithParams: (key: string, params: Record<string, unknown>) =>
      `${key}:${params.minutes ?? params.size ?? ""}`,
  }),
}));

vi.mock("@/services/waitingListApi", () => ({
  waitingListApi: {
    getById: vi.fn(),
    getQueueStatus: vi.fn(),
    estimateWait: vi.fn(),
    join: vi.fn(),
    lookup: vi.fn(),
  },
}));

import { waitingListApi } from "@/services/waitingListApi";

const mockGetById = waitingListApi.getById as ReturnType<typeof vi.fn>;
const mockGetQueueStatus = waitingListApi.getQueueStatus as ReturnType<
  typeof vi.fn
>;
const mockEstimateWait = waitingListApi.estimateWait as ReturnType<
  typeof vi.fn
>;
const mockJoin = waitingListApi.join as ReturnType<typeof vi.fn>;
const mockLookup = waitingListApi.lookup as ReturnType<typeof vi.fn>;

const makeTicket = (status: WaitingStatus) => ({
  id: "ticket-1",
  restaurantId: "restaurant-1",
  customerName: "Ada",
  customerPhone: "0912345678",
  partySize: 2,
  queueNumber: 5,
  queueDisplay: "A005",
  partiesAhead: 1,
  priority: 0,
  status,
  createdAt: 1,
  updatedAt: 1,
});

const mountView = async () => {
  const wrapper = mount(JoinWaitingListView, {
    props: { restaurantId: "restaurant-1" },
    global: {
      stubs: {
        QueueListIcon: true,
      },
    },
  });
  await flushPromises();
  return wrapper;
};

describe("JoinWaitingListView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockGetQueueStatus.mockResolvedValue({
      restaurantId: "restaurant-1",
      totalWaiting: 2,
      averageWaitMinutes: 10,
      availableTables: 1,
      byTableType: [],
    });
    mockEstimateWait.mockResolvedValue({
      estimatedWaitMinutes: 10,
      partiesAhead: 1,
      availableTables: 0,
      confidence: 0.8,
    });
  });

  it("redirects to ticket page when localStorage has a non-terminal ticket", async () => {
    localStorage.setItem(
      "wl:lastTicket",
      JSON.stringify({
        ticketId: "ticket-1",
        restaurantId: "restaurant-1",
        customerPhone: "0912345678",
      }),
    );
    mockGetById.mockResolvedValue(makeTicket(WaitingStatus.WAITING));

    await mountView();

    expect(mockGetById).toHaveBeenCalledOnce();
    expect(mockGetById).toHaveBeenCalledWith("ticket-1");
    expect(routerMocks.replace).toHaveBeenCalledOnce();
    expect(routerMocks.replace).toHaveBeenCalledWith(
      "/r/restaurant-1/wait-list/ticket-1",
    );
    expect(mockGetQueueStatus).toHaveBeenCalledOnce();
    expect(mockEstimateWait).toHaveBeenCalledOnce();
    expect(routerMocks.push).not.toHaveBeenCalled();
    expect(mockJoin).not.toHaveBeenCalled();
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it("does not redirect when stored ticket is terminal", async () => {
    localStorage.setItem(
      "wl:lastTicket",
      JSON.stringify({
        ticketId: "ticket-1",
        restaurantId: "restaurant-1",
        customerPhone: "0912345678",
      }),
    );
    mockGetById.mockResolvedValue(makeTicket(WaitingStatus.CANCELLED));

    await mountView();

    expect(mockGetById).toHaveBeenCalledOnce();
    expect(mockGetById).toHaveBeenCalledWith("ticket-1");
    expect(routerMocks.replace).not.toHaveBeenCalled();
    expect(mockGetQueueStatus).toHaveBeenCalledOnce();
    expect(mockEstimateWait).toHaveBeenCalledOnce();
    expect(routerMocks.push).not.toHaveBeenCalled();
    expect(mockJoin).not.toHaveBeenCalled();
    expect(mockLookup).not.toHaveBeenCalled();
  });

  it("clears localStorage when stored ticket is terminal", async () => {
    localStorage.setItem(
      "wl:lastTicket",
      JSON.stringify({
        ticketId: "ticket-1",
        restaurantId: "restaurant-1",
        customerPhone: "0912345678",
      }),
    );
    mockGetById.mockResolvedValue(makeTicket(WaitingStatus.EXPIRED));

    await mountView();

    expect(mockGetById).toHaveBeenCalledOnce();
    expect(mockGetById).toHaveBeenCalledWith("ticket-1");
    expect(localStorage.getItem("wl:lastTicket")).toBeNull();
    expect(routerMocks.replace).not.toHaveBeenCalled();
    expect(mockGetQueueStatus).toHaveBeenCalledOnce();
    expect(mockEstimateWait).toHaveBeenCalledOnce();
    expect(routerMocks.push).not.toHaveBeenCalled();
    expect(mockJoin).not.toHaveBeenCalled();
    expect(mockLookup).not.toHaveBeenCalled();
  });
});
