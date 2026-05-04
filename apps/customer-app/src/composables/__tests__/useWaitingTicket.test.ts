import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";
import { WaitingStatus } from "@makanmasak/shared-types";

const lifecycle = vi.hoisted(() => ({
  mountedCallbacks: [] as Array<() => void>,
  unmountedCallbacks: [] as Array<() => void>,
}));

vi.mock("vue", async () => {
  const actual = await vi.importActual<typeof import("vue")>("vue");
  return {
    ...actual,
    onMounted: vi.fn((cb: () => void) => lifecycle.mountedCallbacks.push(cb)),
    onUnmounted: vi.fn((cb: () => void) =>
      lifecycle.unmountedCallbacks.push(cb),
    ),
  };
});

vi.mock("@/services/waitingListApi", () => ({
  waitingListApi: {
    getById: vi.fn(),
  },
}));

import { waitingListApi } from "@/services/waitingListApi";
import { useWaitingTicket } from "@/composables/useWaitingTicket";

const mockGetById = waitingListApi.getById as ReturnType<typeof vi.fn>;

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

const mountComposable = async () => {
  const state = useWaitingTicket("ticket-1");
  lifecycle.mountedCallbacks.forEach((cb) => cb());
  await Promise.resolve();
  await nextTick();
  return state;
};

describe("useWaitingTicket", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    lifecycle.mountedCallbacks.length = 0;
    lifecycle.unmountedCallbacks.length = 0;
    localStorage.clear();
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts polling on mount", async () => {
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    mockGetById.mockResolvedValue(makeTicket(WaitingStatus.WAITING));

    await mountComposable();

    expect(mockGetById).toHaveBeenCalledOnce();
    expect(mockGetById).toHaveBeenCalledWith("ticket-1");
    expect(setIntervalSpy).toHaveBeenCalledOnce();
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 10000);
  });

  it("accelerates polling to 5s when status becomes called", async () => {
    const setIntervalSpy = vi.spyOn(window, "setInterval");
    const clearIntervalSpy = vi.spyOn(window, "clearInterval");
    mockGetById.mockResolvedValue(makeTicket(WaitingStatus.CALLED));

    const state = await mountComposable();

    expect(mockGetById).toHaveBeenCalledOnce();
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 5000);
    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(state.intervalMs.value).toBe(5000);
  });

  it.each([
    WaitingStatus.SEATED,
    WaitingStatus.CANCELLED,
    WaitingStatus.EXPIRED,
    WaitingStatus.NO_SHOW,
  ])("stops polling on terminal status %s", async (status) => {
    const clearIntervalSpy = vi.spyOn(window, "clearInterval");
    mockGetById.mockResolvedValue(makeTicket(status));
    localStorage.setItem("wl:lastTicket", JSON.stringify({ ticketId: "x" }));

    await mountComposable();

    expect(mockGetById).toHaveBeenCalledOnce();
    expect(clearIntervalSpy).toHaveBeenCalled();
    expect(localStorage.getItem("wl:lastTicket")).toBeNull();
  });

  it("clears interval on unmount", async () => {
    const clearIntervalSpy = vi.spyOn(window, "clearInterval");
    mockGetById.mockResolvedValue(makeTicket(WaitingStatus.WAITING));

    await mountComposable();
    lifecycle.unmountedCallbacks.forEach((cb) => cb());

    expect(mockGetById).toHaveBeenCalledOnce();
    expect(clearIntervalSpy).toHaveBeenCalledOnce();
  });
});
