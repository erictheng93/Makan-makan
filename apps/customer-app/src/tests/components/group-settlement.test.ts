import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import GroupCartPanel from "@/components/group/GroupCartPanel.vue";
import type { GroupSplitBill } from "@/composables/useGroupOrder";

vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock("@/composables/useCurrency", () => ({
  // The panel destructures `formatAmount` and renames it.
  useCurrency: () => ({
    formatAmount: (value: number) => `$${value}`,
    formatPrice: (value: number) => `$${value}`,
  }),
}));

const MEMBERS = [
  { id: "m-1", name: "Alex", isHost: true, isOnline: true },
  { id: "m-2", name: "Bee", isHost: false, isOnline: true },
];

function splitBill(overrides: Partial<GroupSplitBill> = {}): GroupSplitBill {
  return {
    id: "bill-1",
    memberId: "m-1",
    subtotal: 100,
    serviceCharge: 10,
    taxAmount: 5,
    totalAmount: 115,
    isSettled: false,
    ...overrides,
  };
}

function mountPanel(props: Record<string, unknown> = {}) {
  return mount(GroupCartPanel, {
    props: {
      cartItems: [
        {
          id: "c-1",
          menuItemId: "1",
          menuItemName: "滷肉飯",
          menuItemPrice: 100,
          quantity: 1,
          addedBy: "m-1",
          addedByName: "Alex",
          addedAt: 0,
        },
      ],
      members: MEMBERS,
      currentUserId: "m-1",
      splitBillConfig: { mode: "by_item" },
      totalAmount: 230,
      mySubtotal: 100,
      myServiceCharge: 10,
      myTax: 5,
      myShare: 115,
      feeMode: "proportional",
      isHost: true,
      orderStatus: "active",
      splitBills: [],
      mySplitBill: undefined,
      ...props,
    } as never,
  });
}

describe("group settlement", () => {
  it("offers settlement only to the host after the order is submitted", () => {
    expect(mountPanel().find('[data-testid="start-settlement"]').exists()).toBe(
      false,
    );
    expect(
      mountPanel({ orderStatus: "completed" })
        .find('[data-testid="start-settlement"]')
        .exists(),
    ).toBe(true);
    expect(
      mountPanel({ isHost: false, orderStatus: "completed" })
        .find('[data-testid="start-settlement"]')
        .exists(),
    ).toBe(false);
    expect(
      mountPanel({ cartItems: [], orderStatus: "completed" })
        .find('[data-testid="start-settlement"]')
        .exists(),
    ).toBe(false);
  });

  it("asks to split when the host says so", async () => {
    const wrapper = mountPanel({ orderStatus: "completed" });

    await wrapper.get('[data-testid="start-settlement"]').trigger("click");

    expect(wrapper.emitted("start-settlement")).toHaveLength(1);
  });

  it("replaces the split button with everyone's shares once split", () => {
    const wrapper = mountPanel({
      splitBills: [splitBill(), splitBill({ id: "bill-2", memberId: "m-2" })],
      mySplitBill: splitBill(),
    });

    expect(wrapper.find('[data-testid="start-settlement"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="settlement-panel"]').exists()).toBe(
      true,
    );
    expect(wrapper.get('[data-testid="split-bill-m-1"]').text()).toContain(
      "Alex",
    );
    expect(wrapper.get('[data-testid="split-bill-m-2"]').text()).toContain(
      "$115",
    );
  });

  it("counts how many of the table have settled", () => {
    const wrapper = mountPanel({
      splitBills: [
        splitBill({ isSettled: true }),
        splitBill({ id: "bill-2", memberId: "m-2" }),
      ],
      mySplitBill: splitBill({ isSettled: true }),
    });

    expect(wrapper.get('[data-testid="settled-count"]').text()).toBe("1 / 2");
    expect(wrapper.find('[data-testid="settled-m-1"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="settled-m-2"]').exists()).toBe(false);
  });

  // Each diner settles their own share; the button is about you, so it shows
  // your amount and disappears once you are done.
  it("settles only your own share", async () => {
    const wrapper = mountPanel({
      splitBills: [splitBill(), splitBill({ id: "bill-2", memberId: "m-2" })],
      mySplitBill: splitBill(),
    });

    const button = wrapper.get('[data-testid="settle-my-share"]');
    expect(button.text()).toContain("$115");
    await button.trigger("click");

    expect(wrapper.emitted("settle-my-share")).toHaveLength(1);
  });

  it("says you are done instead of offering the button again", () => {
    const wrapper = mountPanel({
      splitBills: [splitBill({ isSettled: true })],
      mySplitBill: splitBill({ isSettled: true }),
    });

    expect(wrapper.find('[data-testid="settle-my-share"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="my-share-settled"]').exists()).toBe(
      true,
    );
  });

  // Someone who joined after the split has no bill of their own; they should
  // still see the table's progress rather than a broken panel.
  it("shows the table's progress to someone with no share of their own", () => {
    const wrapper = mountPanel({
      currentUserId: "m-3",
      splitBills: [splitBill()],
      mySplitBill: undefined,
    });

    expect(wrapper.find('[data-testid="settlement-panel"]').exists()).toBe(
      true,
    );
    expect(wrapper.find('[data-testid="settle-my-share"]').exists()).toBe(
      false,
    );
    expect(wrapper.find('[data-testid="my-share-settled"]').exists()).toBe(
      false,
    );
  });
});
