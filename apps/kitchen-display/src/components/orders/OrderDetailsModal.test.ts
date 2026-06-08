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

describe("OrderDetailsModal", () => {
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
});
