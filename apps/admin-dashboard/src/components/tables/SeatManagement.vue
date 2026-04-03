<template>
  <div class="seat-management">
    <!-- 座位管理標題 -->
    <div class="flex justify-between items-center mb-6">
      <div>
        <h2 class="text-xl font-bold text-gray-900">
          {{ t("seatManagement.title") }}
        </h2>
        <p class="text-sm text-gray-600">
          {{ t("seatManagement.tableInfo", { tableNumber }) }}
        </p>
      </div>
      <div class="flex space-x-3">
        <button
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
          @click="showBatchCreateModal = true"
        >
          <PlusIcon class="h-4 w-4 mr-2" />
          {{ t("seatManagement.batchCreate") }}
        </button>
        <button
          class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center"
          @click="regenerateAllQR"
        >
          <QRCodeIcon class="h-4 w-4 mr-2" />
          {{ t("seatManagement.regenerateQR") }}
        </button>
      </div>
    </div>

    <!-- 座位網格 -->
    <SeatGrid
      :seats="seats"
      :columns="gridColumns"
      :show-details="true"
      @seat-click="handleSeatClick"
    />

    <!-- 座位詳情 Modal -->
    <div v-if="showSeatModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4">
        <div
          class="fixed inset-0 bg-black opacity-30"
          @click="closeSeatModal"
        />
        <div class="relative bg-white rounded-lg shadow-xl max-w-2xl w-full">
          <div class="p-6">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-lg font-semibold">
                {{ t("seatManagement.seatDetail") }}:
                {{ selectedSeat?.seatNumber }}
              </h3>
              <button
                class="text-gray-400 hover:text-gray-600"
                @click="closeSeatModal"
              >
                <XMarkIcon class="h-6 w-6" />
              </button>
            </div>

            <!-- 座位資訊 -->
            <div class="space-y-4 mb-6">
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    {{ t("seatManagement.seatNumber") }}
                  </label>
                  <input
                    v-model="seatForm.seatNumber"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    {{ t("seatManagement.seatName") }}
                  </label>
                  <input
                    v-model="seatForm.seatName"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">
                  {{ t("seatManagement.positionDesc") }}
                </label>
                <input
                  v-model="seatForm.position"
                  type="text"
                  :placeholder="t('seatManagement.positionPlaceholder')"
                  class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div class="flex items-center">
                <input
                  id="isActive"
                  v-model="seatForm.isActive"
                  type="checkbox"
                  class="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label for="isActive" class="ml-2 text-sm text-gray-700">
                  {{ t("seatManagement.enableSeat") }}
                </label>
              </div>

              <!-- 座位狀態資訊 -->
              <div class="bg-gray-50 rounded-lg p-4">
                <h4 class="text-sm font-medium text-gray-900 mb-2">
                  {{ t("seatManagement.seatStatus") }}
                </h4>
                <div class="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span class="text-gray-600"
                      >{{ t("seatManagement.statusLabel") }}:</span
                    >
                    <span
                      :class="
                        selectedSeat?.isOccupied
                          ? 'text-red-600'
                          : 'text-green-600'
                      "
                      class="ml-2 font-medium"
                    >
                      {{
                        selectedSeat?.isOccupied
                          ? t("seatManagement.occupied")
                          : t("seatManagement.available")
                      }}
                    </span>
                  </div>
                  <div>
                    <span class="text-gray-600"
                      >{{ t("seatManagement.usageCount") }}:</span
                    >
                    <span class="ml-2 font-medium">{{
                      selectedSeat?.totalUsage
                    }}</span>
                  </div>
                  <div v-if="selectedSeat?.currentOrderId" class="col-span-2">
                    <span class="text-gray-600"
                      >{{ t("seatManagement.currentOrder") }}:</span
                    >
                    <span class="ml-2 font-medium"
                      >#{{ selectedSeat.currentOrderId }}</span
                    >
                  </div>
                  <div v-if="selectedSeat?.occupiedBy" class="col-span-2">
                    <span class="text-gray-600"
                      >{{ t("seatManagement.occupiedBy") }}:</span
                    >
                    <span class="ml-2 font-medium">{{
                      selectedSeat.occupiedBy
                    }}</span>
                  </div>
                </div>
              </div>

              <!-- QR Code -->
              <div class="text-center bg-gray-50 rounded-lg p-4">
                <h4 class="text-sm font-medium text-gray-900 mb-2">QR Code</h4>
                <div class="inline-block p-3 bg-white rounded-lg border">
                  <div
                    class="w-32 h-32 bg-gray-100 border-2 border-dashed border-gray-300 rounded flex items-center justify-center"
                  >
                    <QRCodeIcon class="h-16 w-16 text-gray-400" />
                  </div>
                </div>
                <div class="mt-2 text-xs text-gray-500 break-all">
                  {{ selectedSeat?.qrCode }}
                </div>
              </div>
            </div>

            <!-- 操作按鈕 -->
            <div class="flex justify-between">
              <div class="space-x-2">
                <button
                  v-if="selectedSeat?.isOccupied"
                  class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  @click="releaseSeat"
                >
                  {{ t("seatManagement.releaseSeat") }}
                </button>
                <button
                  class="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                  @click="regenerateSeatQR"
                >
                  {{ t("seatManagement.regenerateQR") }}
                </button>
              </div>
              <div class="space-x-2">
                <button
                  class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  @click="deleteSeat"
                >
                  {{ t("seatManagement.deleteSeat") }}
                </button>
                <button
                  class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  @click="updateSeat"
                >
                  {{ t("seatManagement.updateSeat") }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 批量創建座位 Modal -->
    <div v-if="showBatchCreateModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4">
        <div
          class="fixed inset-0 bg-black opacity-30"
          @click="showBatchCreateModal = false"
        />
        <div class="relative bg-white rounded-lg shadow-xl max-w-md w-full">
          <div class="p-6">
            <h3 class="text-lg font-semibold mb-4">
              {{ t("seatManagement.batchCreate") }}
            </h3>

            <form @submit.prevent="batchCreateSeats">
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    {{ t("seatManagement.seatCount") }}
                    <span class="text-red-500">*</span>
                  </label>
                  <input
                    v-model.number="batchForm.count"
                    type="number"
                    min="1"
                    max="100"
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    {{ t("seatManagement.numberingStyle") }}
                    <span class="text-red-500">*</span>
                  </label>
                  <select
                    v-model="batchForm.numberingStyle"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="numeric">
                      {{ t("seatManagement.numeric") }}
                    </option>
                    <option value="alphabetic">
                      {{ t("seatManagement.alphabetic") }}
                    </option>
                    <option value="custom">
                      {{ t("seatManagement.custom") }}
                    </option>
                  </select>
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    {{ t("seatManagement.prefix") }}
                  </label>
                  <input
                    v-model="batchForm.prefix"
                    type="text"
                    :placeholder="t('seatManagement.prefixPlaceholder')"
                    maxlength="10"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <p class="text-xs text-gray-500 mt-1">
                    {{ t("seatManagement.preview") }}: {{ batchForm.prefix }}01,
                    {{ batchForm.prefix }}02...
                  </p>
                </div>
              </div>

              <div class="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  @click="showBatchCreateModal = false"
                >
                  {{ t("common.cancel") }}
                </button>
                <button
                  type="submit"
                  class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {{ t("seatManagement.create") }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "@/i18n";
import { useConfirmModal } from "@/composables/useConfirmModal";
import { api } from "@/services/api";
import { PlusIcon, XMarkIcon } from "@heroicons/vue/24/outline";

const { t } = useI18n();
const { confirm: confirmModal } = useConfirmModal();
import QRCodeIcon from "@heroicons/vue/24/outline/QrCodeIcon";
import SeatGrid from "./SeatGrid.vue";

interface Seat {
  id: number;
  tableId: number;
  seatNumber: string;
  seatName?: string;
  position?: string;
  qrCode: string;
  isOccupied: boolean;
  isActive: boolean;
  currentOrderId?: number;
  occupiedBy?: string;
  totalUsage: number;
}

interface Props {
  tableId: number;
  tableNumber: string;
  seats: Seat[];
  gridColumns?: number;
}

interface Emits {
  (e: "update"): void;
  (e: "seatUpdated", seat: Seat): void;
  (e: "seatDeleted", seatId: number): void;
  (e: "seatsCreated", seats: Seat[]): void;
}

const props = withDefaults(defineProps<Props>(), {
  gridColumns: 4,
});

const emit = defineEmits<Emits>();

// 響應式數據
const showSeatModal = ref(false);
const showBatchCreateModal = ref(false);
const selectedSeat = ref<Seat | null>(null);

const seatForm = ref({
  seatNumber: "",
  seatName: "",
  position: "",
  isActive: true,
});

const batchForm = ref({
  count: 10,
  numberingStyle: "numeric" as "numeric" | "alphabetic" | "custom",
  prefix: "",
});

// 處理座位點擊
const handleSeatClick = (seat: Seat) => {
  selectedSeat.value = seat;
  seatForm.value = {
    seatNumber: seat.seatNumber,
    seatName: seat.seatName || "",
    position: seat.position || "",
    isActive: seat.isActive,
  };
  showSeatModal.value = true;
};

// 關閉座位詳情 Modal
const closeSeatModal = () => {
  showSeatModal.value = false;
  selectedSeat.value = null;
  seatForm.value = {
    seatNumber: "",
    seatName: "",
    position: "",
    isActive: true,
  };
};

// 更新座位
const updateSeat = async () => {
  if (!selectedSeat.value) return;

  try {
    const response = await api.put(`/seats/${selectedSeat.value.id}`, {
      seatNumber: seatForm.value.seatNumber,
      seatName: seatForm.value.seatName || undefined,
      position: seatForm.value.position || undefined,
      isActive: seatForm.value.isActive,
    });

    emit("seatUpdated", {
      ...selectedSeat.value,
      ...(response.data?.data || seatForm.value),
    });

    closeSeatModal();
    emit("update");
  } catch (error) {
    console.error("Failed to update seat:", error);
    alert(t("seatManagement.alerts.updateFailed"));
  }
};

// 刪除座位
const deleteSeat = async () => {
  if (!selectedSeat.value) return;

  if (selectedSeat.value.isOccupied) {
    alert(t("seatManagement.alerts.cannotDeleteOccupied"));
    return;
  }

  const confirmed = await confirmModal({
    type: "danger",
    title: t("seatManagement.deleteSeat"),
    message: t("seatManagement.alerts.deleteConfirm", {
      seat: selectedSeat.value.seatNumber,
    }),
    confirmLabel: t("common.delete"),
  });
  if (!confirmed) return;

  try {
    await api.delete(`/seats/${selectedSeat.value.id}`);

    emit("seatDeleted", selectedSeat.value.id);
    closeSeatModal();
    emit("update");
  } catch (error) {
    console.error("Failed to delete seat:", error);
    alert(t("seatManagement.alerts.deleteFailed"));
  }
};

// 釋放座位
const releaseSeat = async () => {
  if (!selectedSeat.value) return;

  const confirmed = await confirmModal({
    type: "warning",
    title: t("seatManagement.releaseSeat"),
    message: t("seatManagement.alerts.releaseConfirm", {
      seat: selectedSeat.value.seatNumber,
    }),
    confirmLabel: t("seatManagement.releaseSeat"),
  });
  if (!confirmed) return;

  try {
    await api.post(`/seats/${selectedSeat.value.id}/release`);

    emit("update");
    closeSeatModal();
  } catch (error) {
    console.error("Failed to release seat:", error);
    alert(t("seatManagement.alerts.releaseFailed"));
  }
};

// 重新生成座位 QR
const regenerateSeatQR = async () => {
  if (!selectedSeat.value) return;

  const confirmed = await confirmModal({
    type: "warning",
    title: t("seatManagement.regenerateQR"),
    message: t("seatManagement.alerts.regenerateConfirm", {
      seat: selectedSeat.value.seatNumber,
    }),
    confirmLabel: t("seatManagement.regenerateQR"),
  });
  if (!confirmed) return;

  try {
    await api.post(`/seats/${selectedSeat.value.id}/regenerate-qr`);

    emit("update");
    alert(t("seatManagement.alerts.regenerateSuccess"));
  } catch (error) {
    console.error("Failed to regenerate QR:", error);
    alert(t("seatManagement.alerts.regenerateFailed"));
  }
};

// 批量創建座位
const batchCreateSeats = async () => {
  try {
    const response = await api.post("/seats/batch-create", {
      tableId: props.tableId,
      seatCount: batchForm.value.count,
      numberingStyle: batchForm.value.numberingStyle,
      prefix: batchForm.value.prefix || undefined,
    });

    const createdSeats = (response.data?.data || []) as Seat[];
    emit("seatsCreated", createdSeats);
    showBatchCreateModal.value = false;
    emit("update");
    alert(
      t("seatManagement.alerts.batchCreateSuccess", {
        count: batchForm.value.count,
      }),
    );
  } catch (error) {
    console.error("Failed to batch create seats:", error);
    alert(t("seatManagement.alerts.batchCreateFailed"));
  }
};

// 重新生成所有 QR
const regenerateAllQR = async () => {
  const confirmed = await confirmModal({
    type: "warning",
    title: t("seatManagement.regenerateQR"),
    message: t("seatManagement.alerts.regenerateAllConfirm"),
    confirmLabel: t("seatManagement.regenerateQR"),
  });
  if (!confirmed) return;

  try {
    await api.post("/seats/batch-regenerate-qr", {
      tableId: props.tableId,
    });

    emit("update");
    alert(t("seatManagement.alerts.regenerateAllSuccess"));
  } catch (error) {
    console.error("Failed to regenerate all QR codes:", error);
    alert(t("seatManagement.alerts.regenerateFailed"));
  }
};
</script>

<style scoped>
.seat-management {
  /* 樣式 */
}
</style>
