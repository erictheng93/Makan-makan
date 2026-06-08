import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import DraggableOrderCard from "./DraggableOrderCard.vue";
import type { KitchenOrder } from "@/types";

const order: KitchenOrder = {
  id: 1001,
  orderNumber: "A001",
  tableName: "Table 3",
  status: "pending",
  deliveryInfo: { type: "dine_in" },
  items: [
    {
      id: 501,
      name: "Noodles",
      quantity: 1,
      status: "pending",
      priority: "normal",
    },
  ],
  createdAt: "2026-06-08T01:00:00.000Z",
  totalItems: 1,
  priority: "normal",
  elapsedTime: 5,
};

function mountDraggableOrderCard(props = {}) {
  return mount(DraggableOrderCard, {
    props: {
      order,
      statusType: "pending",
      ...props,
    },
    global: {
      stubs: {
        OrderCard: {
          props: ["order", "statusType"],
          emits: ["start-cooking", "mark-ready", "view-details"],
          template: `
            <div data-testid="stub-order-card">
              <button data-testid="start" @click="$emit('start-cooking', order.id, 501)" />
              <button data-testid="ready" @click="$emit('mark-ready', order.id, 501)" />
              <button data-testid="details" @click="$emit('view-details', order)" />
            </div>
          `,
        },
      },
    },
  });
}

describe("DraggableOrderCard", () => {
  it("renders drag metadata and selected/dragging visual states", () => {
    const wrapper = mountDraggableOrderCard({
      isDragging: true,
      isSelected: true,
    });

    expect(wrapper.attributes("data-order-id")).toBe("1001");
    expect(wrapper.attributes("data-status")).toBe("pending");
    expect(wrapper.classes()).toContain("opacity-50");
    expect(wrapper.classes()).toContain("scale-95");
    expect(wrapper.classes()).toContain("ring-2");
  });

  it("forwards order action events from the wrapped order card", async () => {
    const wrapper = mountDraggableOrderCard();

    await wrapper.get('[data-testid="start"]').trigger("click");
    await wrapper.get('[data-testid="ready"]').trigger("click");
    await wrapper.get('[data-testid="details"]').trigger("click");

    expect(wrapper.emitted("start-cooking")).toEqual([[1001, 501]]);
    expect(wrapper.emitted("mark-ready")).toEqual([[1001, 501]]);
    expect(wrapper.emitted("view-details")).toEqual([[order]]);
  });

  it("emits toggle-selection without forwarding the checkbox click", async () => {
    const wrapper = mountDraggableOrderCard({ isSelected: true });
    const checkbox = wrapper.get('input[type="checkbox"]');

    expect((checkbox.element as HTMLInputElement).checked).toBe(true);

    await checkbox.trigger("change");
    await checkbox.trigger("click");

    expect(wrapper.emitted("toggle-selection")).toEqual([[1001]]);
    expect(wrapper.emitted("view-details")).toBeUndefined();
  });
});
