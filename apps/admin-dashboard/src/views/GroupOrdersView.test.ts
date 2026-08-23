// @vitest-environment jsdom

import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import GroupOrdersView from "./GroupOrdersView.vue";
import {
  groupOrdersService,
  type GroupOrder,
} from "@/services/groupOrdersService";

vi.mock("@/i18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock("@/stores/auth", () => ({
  useAuthStore: () => ({
    restaurantId: "restaurant-1",
    user: { username: "Admin" },
  }),
}));

vi.mock("@/composables/useCurrency", () => ({
  useCurrency: () => ({ formatPrice: (amount: number) => `$${amount}` }),
}));

vi.mock("@/composables/useDateFormatter", () => ({
  useDateFormatter: () => ({
    formatDateTime: (value: string) => value,
    formatTime: (value: Date) => value.toISOString(),
  }),
}));

vi.mock("@/services/groupOrdersService", () => ({
  groupOrdersService: {
    getGroupOrders: vi.fn(),
    getGroupOrderStats: vi.fn(),
    recoverFinalization: vi.fn(),
    createGroupOrder: vi.fn(),
    joinGroupOrder: vi.fn(),
    generateShareCode: vi.fn(),
    exportGroupOrders: vi.fn(),
  },
}));

const failedGroupOrder = (overrides: Partial<GroupOrder> = {}): GroupOrder => ({
  id: "group-1",
  shareCode: "GROUP1",
  masterOrderId: "order-1",
  tableNumber: "A1",
  status: "finalizing_failed",
  finalizeFailure: {
    code: "SPLIT_TOTAL_MISMATCH",
    splitError: "Totals do not match",
    failedAt: "2026-08-22T10:00:00.000Z",
    recoveryErrorDetails: [
      {
        code: "SPLIT_BILL_FAILED",
        splitError: "Retry did not complete",
        attemptedAt: "2026-08-22T10:05:00.000Z",
      },
    ],
  },
  hostName: "Admin",
  memberCount: 1,
  totalAmount: 120,
  subtotal: 120,
  serviceCharge: 0,
  taxAmount: 0,
  itemCount: 1,
  members: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      groupOrderId: "group-1",
      name: "Alex",
      itemCount: 1,
      totalAmount: 120,
      paymentStatus: "unpaid",
      joinedAt: "2026-08-22T09:00:00.000Z",
    },
  ],
  createdAt: "2026-08-22T09:00:00.000Z",
  completedAt: null,
  expiresAt: "2026-08-22T12:00:00.000Z",
  ...overrides,
});

const stats = {
  activeGroupOrders: 1,
  totalGroupOrders: 1,
  averageGroupSize: 1,
  averageOrderValue: 120,
  conversionRate: 0,
  popularTimeSlots: [],
  paymentMethodDistribution: {},
};

const apiError = (code: string, status: number) => ({
  response: {
    status,
    data: {
      error: {
        code,
        requestId: "request-1",
      },
    },
  },
});

describe("GroupOrdersView finalization recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(groupOrdersService.getGroupOrders).mockResolvedValue([
      failedGroupOrder(),
    ]);
    vi.mocked(groupOrdersService.getGroupOrderStats).mockResolvedValue(stats);
    vi.mocked(groupOrdersService.recoverFinalization).mockResolvedValue({
      masterOrderId: "order-1",
      status: "checkout",
    });
  });

  async function mountSelectedOrder(order = failedGroupOrder()) {
    vi.mocked(groupOrdersService.getGroupOrders).mockResolvedValue([order]);
    const wrapper = mount(GroupOrdersView);
    await flushPromises();
    await wrapper
      .get('[data-testid="group-order-details-group-1"]')
      .trigger("click");
    return wrapper;
  }

  it("shows recovery only for failed finalizations and renders retry history", async () => {
    const wrapper = await mountSelectedOrder();

    expect(
      wrapper.get('[data-testid="recover-finalization-group-1"]'),
    ).toBeTruthy();
    expect(wrapper.text()).toContain("SPLIT_BILL_FAILED");
    expect(wrapper.text()).toContain("2026-08-22T10:05:00.000Z");

    for (const status of [
      "active",
      "finalizing",
      "checkout",
      "completed",
      "cancelled",
    ] as const) {
      const nonFailedWrapper = await mountSelectedOrder(
        failedGroupOrder({ status, finalizeFailure: undefined }),
      );
      expect(
        nonFailedWrapper
          .find('[data-testid="recover-finalization-group-1"]')
          .exists(),
      ).toBe(false);
    }
  });

  it("calls recovery and refreshes the group orders after success", async () => {
    const wrapper = await mountSelectedOrder();
    vi.clearAllMocks();
    vi.mocked(groupOrdersService.getGroupOrders).mockResolvedValue([
      failedGroupOrder({ status: "checkout", finalizeFailure: undefined }),
    ]);
    vi.mocked(groupOrdersService.getGroupOrderStats).mockResolvedValue(stats);

    await wrapper
      .get('[data-testid="recover-finalization-group-1"]')
      .trigger("click");
    await flushPromises();

    expect(groupOrdersService.recoverFinalization).toHaveBeenCalledWith(
      "group-1",
    );
    expect(groupOrdersService.getGroupOrders).toHaveBeenCalledWith(
      expect.objectContaining({ restaurantId: "restaurant-1" }),
    );
    expect(groupOrdersService.getGroupOrderStats).toHaveBeenCalledWith(
      expect.objectContaining({ restaurantId: "restaurant-1" }),
    );
  });

  it("sends the selected member as the full-payment bearer", async () => {
    const wrapper = await mountSelectedOrder();
    vi.clearAllMocks();

    await wrapper
      .get('[data-testid="finalization-bearer-group-1"]')
      .setValue("22222222-2222-4222-8222-222222222222");
    await wrapper
      .get('[data-testid="recover-finalization-group-1"]')
      .trigger("click");
    await flushPromises();

    expect(groupOrdersService.recoverFinalization).toHaveBeenCalledWith(
      "group-1",
      { bearerMemberId: "22222222-2222-4222-8222-222222222222" },
    );
  });

  it("disables the recovery control while the request is in progress", async () => {
    let resolveRecovery: (() => void) | undefined;
    vi.mocked(groupOrdersService.recoverFinalization).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRecovery = () =>
            resolve({ masterOrderId: "order-1", status: "checkout" });
        }),
    );
    const wrapper = await mountSelectedOrder();

    await wrapper
      .get('[data-testid="recover-finalization-group-1"]')
      .trigger("click");

    expect(
      wrapper
        .get('[data-testid="recover-finalization-group-1"]')
        .attributes("disabled"),
    ).toBeDefined();
    expect(wrapper.text()).toContain("groupOrders.finalizeFailure.recovering");

    resolveRecovery?.();
    await flushPromises();
  });

  it.each([
    [
      "GROUP_ORDER_FINALIZATION_RECOVERY_IN_PROGRESS",
      409,
      "groupOrders.finalizeFailure.recoveryInProgress",
    ],
    [
      "GROUP_ORDER_FINALIZATION_RECOVERY_RECLAIMED",
      409,
      "groupOrders.finalizeFailure.recoveryReclaimed",
    ],
    ["BAD_REQUEST", 400, "groupOrders.finalizeFailure.recoveryRetryFailed"],
  ])(
    "shows localized recovery guidance for %s and refreshes retry history",
    async (code, status, expectedKey) => {
      vi.mocked(groupOrdersService.recoverFinalization).mockRejectedValueOnce(
        apiError(code, status),
      );
      const wrapper = await mountSelectedOrder();
      vi.clearAllMocks();
      vi.mocked(groupOrdersService.getGroupOrders).mockResolvedValue([
        failedGroupOrder(),
      ]);
      vi.mocked(groupOrdersService.getGroupOrderStats).mockResolvedValue(stats);

      await wrapper
        .get('[data-testid="recover-finalization-group-1"]')
        .trigger("click");
      await flushPromises();

      const error = wrapper.get('[data-testid="finalization-recovery-error"]');
      expect(error.text()).toContain(expectedKey);
      expect(error.text()).not.toContain("Request failed with status code");
      expect(groupOrdersService.getGroupOrders).toHaveBeenCalledWith(
        expect.objectContaining({ restaurantId: "restaurant-1" }),
      );
    },
  );
});
