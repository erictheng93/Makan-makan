import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent } from "vue";
import { mount } from "@vue/test-utils";
import { useAudioNotifications } from "./useAudioNotifications";
import { audioService } from "@/services/audioService";
import type { KitchenSSEEvent } from "@/types";

vi.mock("@/services/audioService", () => ({
  audioService: {
    playNewOrder: vi.fn(async () => undefined),
    playOrderReady: vi.fn(async () => undefined),
    playOrderComplete: vi.fn(async () => undefined),
    playWarning: vi.fn(async () => undefined),
    playSuccess: vi.fn(async () => undefined),
    playError: vi.fn(async () => undefined),
    play: vi.fn(async () => undefined),
    updateSettings: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    setMasterVolume: vi.fn(),
  },
}));

const kitchenEvent = (
  type: KitchenSSEEvent["type"],
  payload?: KitchenSSEEvent["payload"],
  data?: KitchenSSEEvent["data"],
): KitchenSSEEvent => ({
  type,
  ...(payload !== undefined ? { payload } : {}),
  data,
  timestamp: "2026-06-08T01:00:00.000Z",
  restaurantId: "restaurant-1",
});

describe("useAudioNotifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("plays new order audio for legacy and shared realtime event names", async () => {
    let notifications: ReturnType<typeof useAudioNotifications> | undefined;
    const wrapper = mount(
      defineComponent({
        setup() {
          notifications = useAudioNotifications();
          return () => null;
        },
      }),
    );

    await notifications!.handleSSEEvent(kitchenEvent("NEW_ORDER"));
    await notifications!.handleSSEEvent(kitchenEvent("new_order"));
    await notifications!.handleSSEEvent(
      kitchenEvent("new_order", { priority: "urgent" }),
    );

    expect(audioService.playNewOrder).toHaveBeenNthCalledWith(1, false);
    expect(audioService.playNewOrder).toHaveBeenNthCalledWith(2, false);
    expect(audioService.playNewOrder).toHaveBeenNthCalledWith(3, true);
    wrapper.unmount();
  });

  it("plays status audio from shared realtime data payloads", async () => {
    let notifications: ReturnType<typeof useAudioNotifications> | undefined;
    const wrapper = mount(
      defineComponent({
        setup() {
          notifications = useAudioNotifications();
          return () => null;
        },
      }),
    );

    await notifications!.handleSSEEvent(
      kitchenEvent("order_status_update", undefined, { status: "ready" }),
    );
    await notifications!.handleSSEEvent(
      kitchenEvent("order_status_update", undefined, { status: "completed" }),
    );

    expect(audioService.playOrderReady).toHaveBeenCalledTimes(1);
    expect(audioService.playOrderComplete).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });
});
