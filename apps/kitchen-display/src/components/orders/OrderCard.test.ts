import { mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { describe, expect, it } from "vitest";
import OrderCard from "./OrderCard.vue";
import type { KitchenOrder } from "@/types";

const baseOrder: KitchenOrder = {
  id: 1,
  orderNumber: "A001",
  tableName: "Table 4",
  status: "pending",
  deliveryInfo: { type: "dine_in" },
  items: [
    {
      id: 10,
      name: "Noodles",
      quantity: 1,
      status: "pending",
      priority: "normal",
    },
  ],
  createdAt: "2026-05-25T12:00:00.000Z",
  totalItems: 1,
  priority: "normal",
  elapsedTime: 2,
};

function mountOrderCard(tableName: string) {
  return mount(OrderCard, {
    props: {
      order: { ...baseOrder, tableName },
      statusType: "pending",
    },
    global: {
      plugins: [createPinia()],
    },
  });
}

describe("OrderCard", () => {
  it("strips localized table prefixes only when followed by a separator", () => {
    expect(mountOrderCard("Table 4").text()).toContain("桌 4");
    expect(mountOrderCard("Table-4").text()).toContain("桌 4");
    expect(mountOrderCard("桌 4").text()).toContain("桌 4");
    expect(mountOrderCard("桌-4").text()).toContain("桌 4");

    expect(mountOrderCard("桌子 4").text()).toContain("桌 桌子 4");
    expect(mountOrderCard("Tabletop 4").text()).toContain("桌 Tabletop 4");
  });
});
