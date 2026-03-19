<script setup lang="ts">
import type { KitchenOrder } from "@/types";
import DragDropOrderBoard from "./DragDropOrderBoard.vue";

// Accept same props as DragDropOrderBoard and pass through
// This is the named component from the spec (Section 12 Core Components)
interface Props {
  pendingOrders: KitchenOrder[];
  preparingOrders: KitchenOrder[];
  readyOrders: KitchenOrder[];
}

defineProps<Props>();

defineEmits<{
  "start-cooking": [orderId: number, itemId: number];
  "mark-ready": [orderId: number, itemId: number];
  "view-details": [order: KitchenOrder];
  "order-status-changed": [
    orderId: number,
    newStatus: "pending" | "preparing" | "ready",
  ];
  "batch-start-order": [orderId: number];
  "batch-complete-order": [orderId: number];
  "toggle-selection": [orderId: number];
}>();
</script>

<template>
  <div class="kanban-board h-full">
    <DragDropOrderBoard
      v-bind="$attrs"
      :pending-orders="pendingOrders"
      :preparing-orders="preparingOrders"
      :ready-orders="readyOrders"
    />
  </div>
</template>
