import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import OrderDetailsModal from "./OrderDetailsModal.vue";
import type { KitchenOrder } from "@/types";

const order: KitchenOrder = {
  id: 1001,
  orderNumber: "A001",
  status: "preparing",
  deliveryInfo: { type: "dine_in" },
  items: [
    {
      id: 501,
      name: "Noodles",
      quantity: 1,
      status: "pending",
      priority: "normal",
    },
    {
      id: 502,
      name: "Dumplings",
      quantity: 1,
      status: "preparing",
      priority: "normal",
    },
  ],
  createdAt: "2026-06-08T01:00:00.000Z",
  totalItems: 2,
  priority: "normal",
  elapsedTime: 5,
};

const expectedTime = (dateString: string) =>
  new Date(dateString).toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });

describe("OrderDetailsModal", () => {
  it("renders order metadata, item status labels, notes, and timestamps", () => {
    const wrapper = mount(OrderDetailsModal, {
      props: {
        order: {
          ...order,
          tableName: "Table 8",
          elapsedTime: 65,
          notes: "No peanuts",
          deliveryInfo: { type: "delivery" },
          items: [
            {
              id: 501,
              name: "Noodles",
              quantity: 1,
              status: "pending",
              priority: "normal",
              notes: "Extra spicy",
              customizations: ["less oil"],
            },
            {
              id: 502,
              name: "Dumplings",
              quantity: 2,
              status: "preparing",
              priority: "normal",
              startedAt: "2026-06-08T01:05:00.000Z",
            },
            {
              id: 503,
              name: "Tea",
              quantity: 1,
              status: "completed",
              priority: "normal",
              completedAt: "2026-06-08T01:10:00.000Z",
            },
          ],
        },
        show: true,
      },
      global: {
        stubs: {
          Teleport: true,
          Transition: false,
        },
      },
    });

    expect(wrapper.text()).toContain("A001");
    expect(wrapper.text()).toContain("Table 8");
    expect(wrapper.text()).toContain("外送");
    expect(wrapper.text()).toContain("等待 1時5分");
    expect(wrapper.text()).toContain("待處理");
    expect(wrapper.text()).toContain("製作中");
    expect(wrapper.text()).toContain("已送達");
    expect(wrapper.text()).toContain("Extra spicy");
    expect(wrapper.text()).toContain("less oil");
    expect(wrapper.text()).toContain("No peanuts");
    expect(wrapper.text()).toContain(
      `開始 ${expectedTime("2026-06-08T01:05:00.000Z")}`,
    );
    expect(wrapper.text()).toContain(
      `完成 ${expectedTime("2026-06-08T01:10:00.000Z")}`,
    );
  });

  it("emits individual item status updates and close events", async () => {
    const wrapper = mount(OrderDetailsModal, {
      props: { order, show: true },
      global: {
        stubs: {
          Teleport: true,
          Transition: false,
        },
      },
    });

    const buttons = wrapper.findAll("button");

    await buttons.find((button) => button.text() === "開始")!.trigger("click");
    await buttons.find((button) => button.text() === "完成")!.trigger("click");
    await buttons[0].trigger("click");

    expect(wrapper.emitted("update-status")).toEqual([
      [1001, 501, "preparing"],
      [1001, 502, "ready"],
    ]);
    expect(wrapper.emitted("close")).toEqual([[]]);
  });

  it("emits each item's next actionable status for bulk actions", async () => {
    const wrapper = mount(OrderDetailsModal, {
      props: { order, show: true },
      global: {
        stubs: {
          Teleport: true,
          Transition: false,
        },
      },
    });

    await wrapper.find("button.w-full").trigger("click");

    expect(wrapper.emitted("update-status")).toEqual([
      [1001, 501, "preparing"],
      [1001, 502, "ready"],
    ]);
  });

  it("shows completed action state and closes when all items are ready", async () => {
    const completedOrder: KitchenOrder = {
      ...order,
      items: order.items.map((item) => ({ ...item, status: "ready" })),
    };

    const wrapper = mount(OrderDetailsModal, {
      props: { order: completedOrder, show: true },
      global: {
        stubs: {
          Teleport: true,
          Transition: false,
        },
      },
    });

    const footerButton = wrapper.find("button.w-full");

    expect(footerButton.text()).toBe("全部已完成");

    await footerButton.trigger("click");

    expect(wrapper.emitted("update-status")).toBeUndefined();
    expect(wrapper.emitted("close")).toEqual([[]]);
  });

  it("does not render modal content when hidden", () => {
    const wrapper = mount(OrderDetailsModal, {
      props: { order, show: false },
      global: {
        stubs: {
          Teleport: true,
          Transition: false,
        },
      },
    });

    expect(wrapper.text()).not.toContain("A001");
    expect(wrapper.find("button").exists()).toBe(false);
  });
});
