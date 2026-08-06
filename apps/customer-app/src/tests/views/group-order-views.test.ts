import { describe, expect, it, vi, beforeEach } from "vitest";
import { mount, RouterLinkStub, flushPromises } from "@vue/test-utils";

const push = vi.hoisted(() => vi.fn());
const groupApi = vi.hoisted(() => ({
  get: vi.fn(),
}));

const groupOrderMock = vi.hoisted(() => ({
  groupOrder: { value: null as Record<string, unknown> | null },
  isLoading: { value: false },
  error: { value: null as string | null },
  isConnected: { value: false },
  recoveryCode: { value: null as string | null },
  isHost: { value: true },
  myItems: { value: [] as unknown[] },
  totalAmount: { value: 0 },
  myShare: { value: 0 },
  onlineMembers: { value: [] as unknown[] },
  loadGroupOrder: vi.fn(),
  joinGroupOrder: vi.fn(),
  connectToGroupOrder: vi.fn(),
  disconnectRealtime: vi.fn(),
  updateCartItem: vi.fn(),
  removeFromCart: vi.fn(),
}));

vi.mock("vue-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("vue-router")>();

  return {
    ...actual,
    useRouter: () => ({ push }),
    useRoute: () => ({ params: {} }),
  };
});

vi.mock("@/services/api", () => ({ apiClient: groupApi }));

vi.mock("@/composables/useGroupOrder", () => ({
  useGroupOrder: () => groupOrderMock,
}));

vi.mock("@/composables/useI18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock("@/composables/useCurrency", () => ({
  useCurrency: () => ({
    formatAmount: (value: number) => `$${value}`,
    formatPrice: (value: number) => `$${value}`,
  }),
}));

vi.mock("vue-i18n", async (importOriginal) => {
  const actual = await importOriginal<typeof import("vue-i18n")>();

  return {
    ...actual,
    useI18n: () => ({ t: (key: string) => key }),
  };
});

import GroupOrderJoinView from "@/views/GroupOrderJoinView.vue";
import GroupOrderView from "@/views/GroupOrderView.vue";
import GroupCartPanel from "@/components/group/GroupCartPanel.vue";

const mountOptions = {
  global: { stubs: { RouterLink: RouterLinkStub } },
};

function previewPayload(overrides: Record<string, unknown> = {}) {
  return {
    groupOrderId: "go-1",
    restaurantId: "rest-1",
    hostName: "Alex",
    memberCount: 2,
    fulfillmentType: "dine_in",
    expiresAt: new Date("2026-06-07T00:45:00.000Z").toISOString(),
    status: "active",
    ...overrides,
  };
}

function loadedGroupOrder(status = "active") {
  return {
    id: "go-1",
    restaurantId: "rest-1",
    shareCode: "ABC12345",
    hostId: "m-1",
    hostName: "Alex",
    status,
    members: [{ id: "m-1", name: "Alex", isHost: true, isOnline: true }],
    cartItems: [],
    splitBillConfig: { mode: "by_item" },
    createdAt: 0,
    updatedAt: 0,
  };
}

describe("GroupOrderJoinView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    groupOrderMock.groupOrder.value = null;
  });

  it("shows the preview without joining", async () => {
    groupApi.get.mockResolvedValueOnce(previewPayload());

    const wrapper = mount(GroupOrderJoinView, {
      ...mountOptions,
      props: { shareCode: "ABC12345" },
    });
    await flushPromises();

    expect(groupApi.get).toHaveBeenCalledWith("/orders/group/join/ABC12345");
    expect(wrapper.text()).toContain("Alex");
    expect(wrapper.text()).toContain("2");
    // Landing on a shared link must not enrol the visitor. Design decision 4:
    // they see who is ordering and decide, and a link opened by accident costs
    // nothing.
    expect(groupOrderMock.joinGroupOrder).not.toHaveBeenCalled();
  });

  it("requires an explicit action and a name before joining", async () => {
    groupApi.get.mockResolvedValueOnce(previewPayload());

    const wrapper = mount(GroupOrderJoinView, {
      ...mountOptions,
      props: { shareCode: "ABC12345" },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="join-name-input"]').exists()).toBe(
      false,
    );

    await wrapper.find('[data-testid="join-confirm-button"]').trigger("click");
    expect(wrapper.find('[data-testid="join-name-input"]').exists()).toBe(true);
    expect(groupOrderMock.joinGroupOrder).not.toHaveBeenCalled();
  });

  it("navigates to the loaded group order id after joining, never undefined", async () => {
    groupApi.get.mockResolvedValueOnce(previewPayload());
    groupOrderMock.joinGroupOrder.mockImplementationOnce(async () => {
      groupOrderMock.groupOrder.value = loadedGroupOrder();
      return true;
    });

    const wrapper = mount(GroupOrderJoinView, {
      ...mountOptions,
      props: { shareCode: "ABC12345" },
    });
    await flushPromises();

    await wrapper.find('[data-testid="join-confirm-button"]').trigger("click");
    await wrapper.find('[data-testid="join-name-input"]').setValue("Sam");
    await wrapper.find('[data-testid="join-submit-button"]').trigger("click");
    await flushPromises();

    expect(groupOrderMock.joinGroupOrder).toHaveBeenCalledWith(
      "ABC12345",
      "Sam",
    );
    expect(push).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "GroupOrder",
        params: { groupOrderId: "go-1" },
      }),
    );
  });

  it("renders a not-found state for an unknown or expired share code", async () => {
    groupApi.get.mockRejectedValueOnce(new Error("404"));

    const wrapper = mount(GroupOrderJoinView, {
      ...mountOptions,
      props: { shareCode: "NOPE0000" },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="join-not-found"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="join-confirm-button"]').exists()).toBe(
      false,
    );
  });

  it("does not collapse transient preview failures into not found", async () => {
    groupApi.get.mockRejectedValueOnce(
      Object.assign(new Error("Server unavailable"), { status: 500 }),
    );

    const wrapper = mount(GroupOrderJoinView, {
      ...mountOptions,
      props: { shareCode: "ABC12345" },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="join-not-found"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="join-preview-error"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="join-retry-button"]').exists()).toBe(
      true,
    );
  });
});

describe("GroupOrderView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    groupOrderMock.groupOrder.value = loadedGroupOrder();
  });

  it("loads the group order and opens realtime on mount", async () => {
    mount(GroupOrderView, {
      ...mountOptions,
      props: { groupOrderId: "go-1" },
    });
    await flushPromises();

    expect(groupOrderMock.loadGroupOrder).toHaveBeenCalledWith("go-1");
    expect(groupOrderMock.connectToGroupOrder).toHaveBeenCalledWith("go-1");
  });

  it("closes realtime on unmount", async () => {
    const wrapper = mount(GroupOrderView, {
      ...mountOptions,
      props: { groupOrderId: "go-1" },
    });
    await flushPromises();

    wrapper.unmount();

    // A socket left open after the view is gone keeps receiving another
    // table's traffic and holds a Durable Object session for nobody.
    expect(groupOrderMock.disconnectRealtime).toHaveBeenCalled();
  });

  it("renders the cart panel while the group is still active", async () => {
    const wrapper = mount(GroupOrderView, {
      ...mountOptions,
      props: { groupOrderId: "go-1" },
    });
    await flushPromises();

    expect(wrapper.findComponent(GroupCartPanel).exists()).toBe(true);
    expect(wrapper.find('[data-testid="group-order-locked"]').exists()).toBe(
      false,
    );
  });

  it.each(["finalizing", "finalizing_failed", "checkout", "completed"])(
    "locks editing once the group order reaches %s",
    async (status) => {
      groupOrderMock.groupOrder.value = loadedGroupOrder(status);

      const wrapper = mount(GroupOrderView, {
        ...mountOptions,
        props: { groupOrderId: "go-1" },
      });
      await flushPromises();

      // The order is being turned into a real one, or already has been.
      // Showing an editable cart invites changes that will never reach it.
      expect(wrapper.find('[data-testid="group-order-locked"]').exists()).toBe(
        true,
      );
      expect(wrapper.findComponent(GroupCartPanel).exists()).toBe(false);
    },
  );

  it("locks editing for any future non-active status", async () => {
    groupOrderMock.groupOrder.value = loadedGroupOrder("paused_for_review");

    const wrapper = mount(GroupOrderView, {
      ...mountOptions,
      props: { groupOrderId: "go-1" },
    });
    await flushPromises();

    expect(wrapper.find('[data-testid="group-order-locked"]').exists()).toBe(
      true,
    );
    expect(wrapper.findComponent(GroupCartPanel).exists()).toBe(false);
  });
});

describe("group ordering routes", () => {
  it("registers the join route on the same shape getShareLink builds", async () => {
    const { default: router } = await import("@/router");
    const join = router
      .getRoutes()
      .find((route) => route.name === "GroupOrderJoin");

    // getShareLink() emits /group/:shareCode. If the route disagrees, every
    // link a host shares resolves to nothing.
    expect(join?.path).toBe("/group/:shareCode");
  });

  it("registers the group order route keyed by group order id", async () => {
    const { default: router } = await import("@/router");
    const view = router
      .getRoutes()
      .find((route) => route.name === "GroupOrder");

    expect(view?.path).toBe("/group/order/:groupOrderId");
  });

  it("resolves a shared link to the join view", async () => {
    const { default: router } = await import("@/router");
    const resolved = router.resolve("/group/ABC12345");

    expect(resolved.name).toBe("GroupOrderJoin");
    expect(resolved.params).toMatchObject({ shareCode: "ABC12345" });
  });
});
