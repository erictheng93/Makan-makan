<template>
  <div class="drag-drop-board grid grid-cols-1 lg:grid-cols-3 gap-6">
    <!-- Pending Orders Column -->
    <div class="order-column">
      <div class="column-header flex items-center justify-between mb-4">
        <h2 class="text-xl font-semibold text-gray-900 flex items-center">
          <ClockIcon class="w-6 h-6 mr-2 text-yellow-500" />
          待處理訂單
          <span
            class="ml-2 bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full text-sm"
          >
            {{ pendingOrders.length }}
          </span>
        </h2>
      </div>

      <div
        ref="pendingColumn"
        :class="[
          'order-list space-y-3 min-h-96 p-3 rounded-lg transition-colors',
          {
            'bg-yellow-50 border-2 border-dashed border-yellow-300':
              dragOverColumn === 'pending',
          },
        ]"
        data-status="pending"
      >
        <DraggableOrderCard
          v-for="order in pendingOrders"
          :key="`pending-${order.id}`"
          :order="order"
          status-type="pending"
          :is-dragging="draggedOrderId === order.id"
          :is-drag-over="dragOverColumn === 'pending'"
          :is-selected="isOrderSelected(order.id)"
          @start-cooking="handleStartCooking"
          @mark-ready="handleMarkReady"
          @view-details="handleViewDetails"
          @toggle-selection="handleToggleSelection"
        />

        <div
          v-if="pendingOrders.length === 0"
          class="empty-state text-center py-8 text-gray-500"
        >
          <ClockIcon class="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>目前沒有待處理的訂單</p>
          <p class="text-sm text-gray-400 mt-1">新訂單會自動出現在這裡</p>
        </div>
      </div>
    </div>

    <!-- Preparing Orders Column -->
    <div class="order-column">
      <div class="column-header flex items-center justify-between mb-4">
        <h2 class="text-xl font-semibold text-gray-900 flex items-center">
          <FireIcon class="w-6 h-6 mr-2 text-blue-500" />
          製作中訂單
          <span
            class="ml-2 bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm"
          >
            {{ preparingOrders.length }}
          </span>
        </h2>
      </div>

      <div
        ref="preparingColumn"
        :class="[
          'order-list space-y-3 min-h-96 p-3 rounded-lg transition-colors',
          {
            'bg-blue-50 border-2 border-dashed border-blue-300':
              dragOverColumn === 'preparing',
          },
        ]"
        data-status="preparing"
      >
        <DraggableOrderCard
          v-for="order in preparingOrders"
          :key="`preparing-${order.id}`"
          :order="order"
          status-type="preparing"
          :is-dragging="draggedOrderId === order.id"
          :is-drag-over="dragOverColumn === 'preparing'"
          :is-selected="isOrderSelected(order.id)"
          @start-cooking="handleStartCooking"
          @mark-ready="handleMarkReady"
          @view-details="handleViewDetails"
          @toggle-selection="handleToggleSelection"
        />

        <div
          v-if="preparingOrders.length === 0"
          class="empty-state text-center py-8 text-gray-500"
        >
          <FireIcon class="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>目前沒有正在製作的訂單</p>
          <p class="text-sm text-gray-400 mt-1">拖拽待處理訂單到此處開始製作</p>
        </div>
      </div>
    </div>

    <!-- Ready Orders Column -->
    <div class="order-column">
      <div class="column-header flex items-center justify-between mb-4">
        <h2 class="text-xl font-semibold text-gray-900 flex items-center">
          <CheckCircleIcon class="w-6 h-6 mr-2 text-green-500" />
          準備完成
          <span
            class="ml-2 bg-green-100 text-green-800 px-2 py-1 rounded-full text-sm"
          >
            {{ readyOrders.length }}
          </span>
        </h2>
      </div>

      <div
        ref="readyColumn"
        :class="[
          'order-list space-y-3 min-h-96 p-3 rounded-lg transition-colors',
          {
            'bg-green-50 border-2 border-dashed border-green-300':
              dragOverColumn === 'ready',
          },
        ]"
        data-status="ready"
      >
        <DraggableOrderCard
          v-for="order in readyOrders"
          :key="`ready-${order.id}`"
          :order="order"
          status-type="ready"
          :is-dragging="draggedOrderId === order.id"
          :is-drag-over="dragOverColumn === 'ready'"
          :is-selected="isOrderSelected(order.id)"
          @start-cooking="handleStartCooking"
          @mark-ready="handleMarkReady"
          @view-details="handleViewDetails"
          @toggle-selection="handleToggleSelection"
        />

        <div
          v-if="readyOrders.length === 0"
          class="empty-state text-center py-8 text-gray-500"
        >
          <CheckCircleIcon class="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>目前沒有準備完成的訂單</p>
          <p class="text-sm text-gray-400 mt-1">拖拽製作中訂單到此處標記完成</p>
        </div>
      </div>
    </div>
  </div>

  <!-- Drag Instructions -->
  <div
    v-if="showDragInstructions"
    class="drag-instructions mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg"
  >
    <div class="flex items-center space-x-2 text-blue-700 mb-2">
      <svg
        class="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span class="font-medium">拖拽操作說明</span>
    </div>
    <ul class="text-sm text-blue-600 space-y-1">
      <li>• 拖拽訂單卡片到不同欄位來改變狀態</li>
      <li>• 待處理 → 製作中：自動開始所有待製作項目</li>
      <li>• 製作中 → 準備完成：自動完成所有項目</li>
      <li>• 拖拽時會顯示視覺提示效果</li>
    </ul>
    <button
      class="mt-2 text-xs text-blue-500 hover:text-blue-700"
      @click="hideDragInstructions"
    >
      不再顯示
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from "vue";
import { useSortable } from "@vueuse/integrations/useSortable";
import { useToast } from "vue-toastification";
import {
  ClockIcon,
  FireIcon,
  CheckCircleIcon,
} from "@heroicons/vue/24/outline";
import { useOrderManagementStore } from "@/stores/orderManagement";
import type { KitchenOrder } from "@/types";
import DraggableOrderCard from "./DraggableOrderCard.vue";

// Props
interface Props {
  pendingOrders: KitchenOrder[];
  preparingOrders: KitchenOrder[];
  readyOrders: KitchenOrder[];
}

defineProps<Props>();

// Emits
const emit = defineEmits<{
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

const toast = useToast();

// Order Management Store
const orderManagementStore = useOrderManagementStore();
const { isOrderSelected, toggleOrderSelection } = orderManagementStore;

// State
const pendingColumn = ref<HTMLElement>();
const preparingColumn = ref<HTMLElement>();
const readyColumn = ref<HTMLElement>();
const draggedOrderId = ref<number | null>(null);
const dragOverColumn = ref<string | null>(null);
const showDragInstructions = ref(true);

// Drag and Drop Setup
const setupSortable = () => {
  if (!pendingColumn.value || !preparingColumn.value || !readyColumn.value)
    return;

  const columns = [
    { element: pendingColumn.value, status: "pending" },
    { element: preparingColumn.value, status: "preparing" },
    { element: readyColumn.value, status: "ready" },
  ];

  columns.forEach(({ element, status: _status }) => {
    useSortable(element, [], {
      group: "kitchen-orders",
      animation: 200,
      ghostClass: "sortable-ghost",
      dragClass: "sortable-drag",
      chosenClass: "sortable-chosen",
      forceFallback: true,
      fallbackClass: "sortable-fallback",

      onStart: (evt) => {
        const orderId = Number(evt.item.dataset.orderId);
        draggedOrderId.value = orderId;
        document.body.classList.add("dragging-order");
      },

      onEnd: (evt) => {
        draggedOrderId.value = null;
        dragOverColumn.value = null;
        document.body.classList.remove("dragging-order");

        const orderId = Number(evt.item.dataset.orderId);
        const newStatus = evt.to.dataset.status as
          | "pending"
          | "preparing"
          | "ready";
        const oldStatus = evt.from.dataset.status as
          | "pending"
          | "preparing"
          | "ready";

        if (newStatus !== oldStatus && orderId) {
          handleStatusChange(orderId, newStatus, oldStatus);
        }
      },

      onMove: (evt) => {
        const targetStatus = evt.to.dataset.status;
        dragOverColumn.value = targetStatus || null;
        return true;
      },
    });
  });
};

// Methods
const handleStatusChange = async (
  orderId: number,
  newStatus: string,
  oldStatus: string,
) => {
  try {
    emit("order-status-changed", orderId, newStatus as any);

    // Show feedback based on status change
    if (oldStatus === "pending" && newStatus === "preparing") {
      emit("batch-start-order", orderId);
      toast.success("訂單已開始製作！");
    } else if (oldStatus === "preparing" && newStatus === "ready") {
      emit("batch-complete-order", orderId);
      toast.success("訂單製作完成！");
    } else if (oldStatus === "ready" && newStatus === "preparing") {
      toast.info("訂單已移回製作中");
    } else if (oldStatus === "preparing" && newStatus === "pending") {
      toast.info("訂單已移回待處理");
    }
  } catch (error: any) {
    console.error("Status change failed:", error);
    toast.error("狀態更新失敗：" + error.message);
  }
};

const handleStartCooking = (orderId: number, itemId: number) => {
  emit("start-cooking", orderId, itemId);
};

const handleMarkReady = (orderId: number, itemId: number) => {
  emit("mark-ready", orderId, itemId);
};

const handleViewDetails = (order: KitchenOrder) => {
  emit("view-details", order);
};

const handleToggleSelection = (orderId: number) => {
  toggleOrderSelection(orderId);
  emit("toggle-selection", orderId);
};

const hideDragInstructions = () => {
  showDragInstructions.value = false;
  localStorage.setItem("kitchen-hide-drag-instructions", "true");
};

// Lifecycle
onMounted(async () => {
  // Check if user has hidden instructions before
  const hideInstructions = localStorage.getItem(
    "kitchen-hide-drag-instructions",
  );
  if (hideInstructions === "true") {
    showDragInstructions.value = false;
  }

  await nextTick();
  setupSortable();
});
</script>

<style scoped>
.drag-drop-board {
  min-height: 600px;
}

.order-column {
  flex: 1;
  min-width: 300px;
}

.order-list {
  background: linear-gradient(
    145deg,
    rgba(255, 255, 255, 0.8),
    rgba(255, 255, 255, 0.4)
  );
  backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  max-height: 70vh;
  overflow-y: auto;
}

.empty-state {
  pointer-events: none;
}

/* Global drag styles */
:global(body.dragging-order) {
  cursor: grabbing !important;
}

:global(body.dragging-order *) {
  cursor: grabbing !important;
}

/* Sortable styles */
:global(.sortable-ghost) {
  opacity: 0.4;
  background: rgba(59, 130, 246, 0.1);
  border: 2px dashed rgb(59 130 246);
}

:global(.sortable-drag) {
  opacity: 1;
  transform: rotate(3deg) scale(1.02);
  box-shadow:
    0 20px 25px -5px rgba(0, 0, 0, 0.1),
    0 10px 10px -5px rgba(0, 0, 0, 0.04);
}

:global(.sortable-chosen) {
  cursor: grabbing;
}

:global(.sortable-fallback) {
  opacity: 0.8;
}

/* Custom scrollbar */
.order-list::-webkit-scrollbar {
  width: 6px;
}

.order-list::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
}

.order-list::-webkit-scrollbar-thumb {
  background: rgba(156, 163, 175, 0.5);
  border-radius: 3px;
}

.order-list::-webkit-scrollbar-thumb:hover {
  background: rgba(156, 163, 175, 0.7);
}
</style>
