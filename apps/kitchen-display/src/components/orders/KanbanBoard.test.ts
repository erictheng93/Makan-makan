import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import KanbanBoard from "./KanbanBoard.vue";
import type { KitchenOrder } from "@/types";

const order: KitchenOrder = {
  id: 1001,
  orderNumber: "A001",
  status: "confirmed",
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
  totalAmount: 120,
};

function mountKanbanBoard() {
  return mount(KanbanBoard, {
    props: {
      pendingOrders: [order],
      preparingOrders: [],
      readyOrders: [],
    },
    global: {
      stubs: {
        DragDropOrderBoard: {
          emits: [
            "start-cooking",
            "mark-ready",
            "view-details",
            "order-status-changed",
            "batch-start-order",
            "batch-complete-order",
            "toggle-selection",
          ],
          template: `
            <div>
              <button data-testid="start" @click="$emit('start-cooking', 1001, 501)" />
              <button data-testid="ready" @click="$emit('mark-ready', 1001, 501)" />
              <button data-testid="details" @click="$emit('view-details', pendingOrders[0])" />
              <button data-testid="status" @click="$emit('order-status-changed', 1001, 'preparing')" />
              <button data-testid="batch-start" @click="$emit('batch-start-order', 1001)" />
              <button data-testid="batch-complete" @click="$emit('batch-complete-order', 1001)" />
              <button data-testid="toggle" @click="$emit('toggle-selection', 1001)" />
            </div>
          `,
          props: ["pendingOrders", "preparingOrders", "readyOrders"],
        },
      },
    },
  });
}

describe("KanbanBoard", () => {
  it("forwards order action events from the drag/drop board", async () => {
    const wrapper = mountKanbanBoard();

    await wrapper.get('[data-testid="start"]').trigger("click");
    await wrapper.get('[data-testid="ready"]').trigger("click");
    await wrapper.get('[data-testid="details"]').trigger("click");
    await wrapper.get('[data-testid="status"]').trigger("click");
    await wrapper.get('[data-testid="batch-start"]').trigger("click");
    await wrapper.get('[data-testid="batch-complete"]').trigger("click");
    await wrapper.get('[data-testid="toggle"]').trigger("click");

    expect(wrapper.emitted("start-cooking")).toEqual([[1001, 501]]);
    expect(wrapper.emitted("mark-ready")).toEqual([[1001, 501]]);
    expect(wrapper.emitted("view-details")).toEqual([[order]]);
    expect(wrapper.emitted("order-status-changed")).toEqual([
      [1001, "preparing"],
    ]);
    expect(wrapper.emitted("batch-start-order")).toEqual([[1001]]);
    expect(wrapper.emitted("batch-complete-order")).toEqual([[1001]]);
    expect(wrapper.emitted("toggle-selection")).toEqual([[1001]]);
  });
});
