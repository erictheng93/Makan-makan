<template>
  <div class="table-detail-view">
    <!-- 返回按鈕 -->
    <div class="mb-6">
      <button
        class="flex items-center text-gray-600 hover:text-gray-900"
        @click="goBack"
      >
        <ArrowLeftIcon class="h-5 w-5 mr-2" />
        {{ t("tableDetail.backToList") }}
      </button>
    </div>

    <!-- 桌台資訊卡片 -->
    <div class="bg-white rounded-lg shadow p-6 mb-6">
      <div class="flex justify-between items-start">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 mb-2">
            {{ t("tableDetail.tableNumber", { number: table.tableNumber }) }}
          </h1>
          <div class="flex items-center space-x-4">
            <span
              :class="getStatusBadgeClass(table.status)"
              class="px-3 py-1 text-sm font-medium rounded-full"
            >
              {{ getStatusText(table.status) }}
            </span>
            <span
              class="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full"
            >
              {{
                table.qrMode === "table"
                  ? t("tableDetail.tableMode")
                  : t("tableDetail.seatMode")
              }}
            </span>
          </div>
        </div>

        <div class="flex space-x-2">
          <button
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            @click="showEditModal = true"
          >
            {{ t("tableDetail.editTable") }}
          </button>
          <button
            class="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
            @click="showModeSwitchModal = true"
          >
            {{ t("tableDetail.switchMode") }}
          </button>
        </div>
      </div>

      <!-- 桌台詳細資訊 -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        <div>
          <div class="text-sm text-gray-600">
            {{ t("tableDetail.capacity") }}
          </div>
          <div class="text-lg font-semibold">
            {{ t("tableDetail.capacityValue", { count: table.capacity }) }}
          </div>
        </div>
        <div>
          <div class="text-sm text-gray-600">
            {{ t("tableDetail.location") }}
          </div>
          <div class="text-lg font-semibold">
            {{ table.location || t("tableDetail.locationNotSet") }}
          </div>
        </div>
        <div v-if="table.qrMode === 'seat'">
          <div class="text-sm text-gray-600">
            {{ t("tableDetail.seatCount") }}
          </div>
          <div class="text-lg font-semibold">
            {{ t("tableDetail.seatCountValue", { count: seats.length }) }}
          </div>
        </div>
        <div>
          <div class="text-sm text-gray-600">
            {{ t("tableDetail.usageCount") }}
          </div>
          <div class="text-lg font-semibold">
            {{
              t("tableDetail.usageCountValue", { count: table.totalUsage || 0 })
            }}
          </div>
        </div>
      </div>
    </div>

    <!-- 座位管理（座位模式） -->
    <div v-if="table.qrMode === 'seat'">
      <SeatManagement
        :table-id="table.id"
        :table-number="table.tableNumber"
        :seats="seats"
        :grid-columns="4"
        @update="loadSeats"
      />
    </div>

    <!-- 桌子 QR 碼（桌子模式） -->
    <div v-else class="bg-white rounded-lg shadow p-6">
      <h2 class="text-xl font-bold text-gray-900 mb-4">
        {{ t("tableDetail.qrCode.title") }}
      </h2>

      <div class="flex flex-col items-center">
        <div class="p-6 bg-gray-50 rounded-lg">
          <div
            class="w-64 h-64 bg-white border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center"
          >
            <div class="text-center">
              <QRCodeIcon class="mx-auto h-24 w-24 text-gray-400 mb-2" />
              <p class="text-sm text-gray-500">
                {{ t("tableDetail.qrCode.preview") }}
              </p>
              <p class="text-xs text-gray-400 mt-2 break-all px-4">
                {{ table.qrCode }}
              </p>
            </div>
          </div>
        </div>

        <div class="mt-6 flex space-x-3">
          <button
            class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            @click="downloadQRCode"
          >
            {{ t("tableDetail.qrCode.download") }}
          </button>
          <button
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            @click="printQRCode"
          >
            {{ t("tableDetail.qrCode.print") }}
          </button>
          <button
            class="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
            @click="regenerateQRCode"
          >
            {{ t("tableDetail.qrCode.regenerate") }}
          </button>
        </div>
      </div>
    </div>

    <!-- 模式切換 Modal -->
    <div v-if="showModeSwitchModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4">
        <div
          class="fixed inset-0 bg-black opacity-30"
          @click="showModeSwitchModal = false"
        />
        <div
          class="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        >
          <div class="p-6">
            <div class="flex justify-between items-center mb-4">
              <h3 class="text-lg font-semibold">
                {{ t("tableDetail.modeSwitch.title") }}
              </h3>
              <button
                class="text-gray-400 hover:text-gray-600"
                @click="showModeSwitchModal = false"
              >
                <XMarkIcon class="h-6 w-6" />
              </button>
            </div>

            <div class="mb-6">
              <p class="text-sm text-gray-600">
                {{ t("tableDetail.modeSwitch.currentMode") }}
                <span class="font-semibold">{{
                  table.qrMode === "table"
                    ? t("tableDetail.tableMode")
                    : t("tableDetail.seatMode")
                }}</span>
              </p>
            </div>

            <QRModeSelector
              v-model="newQRMode"
              v-model:seat-config="newSeatConfig"
            />

            <div class="flex justify-end space-x-3 mt-6">
              <button
                type="button"
                class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                @click="showModeSwitchModal = false"
              >
                {{ t("tableDetail.modeSwitch.cancel") }}
              </button>
              <button
                type="button"
                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                @click="switchQRMode"
              >
                {{ t("tableDetail.modeSwitch.confirm") }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useI18n } from "@/i18n";
import { useToast } from "vue-toastification";
import { useConfirmModal } from "@/composables/useConfirmModal";
import { useRouter, useRoute } from "vue-router";
import { api } from "@/services/api";
import { ArrowLeftIcon, XMarkIcon } from "@heroicons/vue/24/outline";
import QRCodeIcon from "@heroicons/vue/24/outline/QrCodeIcon";
import SeatManagement from "../components/tables/SeatManagement.vue";
import QRModeSelector from "../components/tables/QRModeSelector.vue";

const { t } = useI18n();
const toast = useToast();
const { confirm: confirmModal } = useConfirmModal();
const router = useRouter();
const route = useRoute();

// 響應式數據
const isLoading = ref(false);

const table = ref({
  id: 0,
  tableNumber: "",
  tableName: "",
  capacity: 0,
  location: "",
  status: "available",
  qrMode: "table" as "table" | "seat",
  qrCode: "",
  totalUsage: 0,
});

const seats = ref<any[]>([]);
const showEditModal = ref(false);
const showModeSwitchModal = ref(false);

const newQRMode = ref<"table" | "seat">("table");
const newSeatConfig = ref({
  count: 10,
  numberingStyle: "numeric" as "numeric" | "alphabetic" | "custom",
});

// 方法
const goBack = () => {
  router.push("/tables");
};

const getStatusBadgeClass = (status: string) => {
  const classes: Record<string, string> = {
    available: "bg-green-100 text-green-800",
    occupied: "bg-red-100 text-red-800",
    reserved: "bg-yellow-100 text-yellow-800",
    maintenance: "bg-gray-100 text-gray-800",
  };
  return classes[status] || "bg-gray-100 text-gray-800";
};

const getStatusText = (status: string) => {
  const keys: Record<string, string> = {
    available: "tableDetail.status.available",
    occupied: "tableDetail.status.occupied",
    reserved: "tableDetail.status.reserved",
    maintenance: "tableDetail.status.maintenance",
  };
  return keys[status] ? t(keys[status]) : status;
};

const loadSeats = async () => {
  if (table.value.qrMode !== "seat" || !table.value.id) return;

  try {
    const response = await api.get("/seats", {
      tableId: table.value.id,
    });
    if (response.data.success && response.data.data) {
      seats.value = response.data.data as any[];
    }
  } catch (error) {
    console.error("Failed to load seats:", error);
  }
};

const switchQRMode = async () => {
  if (table.value.status === "occupied") {
    toast.error(t("tableDetail.confirm.occupiedError"));
    return;
  }

  const modeName =
    newQRMode.value === "table"
      ? t("tableDetail.tableMode")
      : t("tableDetail.seatMode");
  const confirmed = await confirmModal({
    type: "warning",
    title: t("tableDetail.confirm.switchModeTitle"),
    message: t("tableDetail.confirm.switchMode", { mode: modeName }),
    confirmLabel: t("tableDetail.confirm.switchModeAction"),
  });
  if (!confirmed) return;

  try {
    if (newQRMode.value === "seat") {
      // Switch to seat mode: batch-create seats
      await api.post("/seats/batch-create", {
        tableId: table.value.id,
        seatCount: newSeatConfig.value.count,
        numberingStyle: newSeatConfig.value.numberingStyle,
      });
    } else {
      // Switch to table mode: delete all seats for this table
      await api.delete(`/seats/table/${table.value.id}`);
    }

    table.value.qrMode = newQRMode.value;
    showModeSwitchModal.value = false;

    if (newQRMode.value === "seat") {
      await loadSeats();
    } else {
      seats.value = [];
    }
  } catch (error) {
    console.error("Failed to switch QR mode:", error);
    toast.error(t("tableDetail.confirm.switchFailed"));
  }
};

const downloadQRCode = () => {
  if (!table.value.qrCode) return;
  // Create a simple text download of the QR code value (the QR image rendering
  // is handled by the QRCodeRenderer component in the parent list view)
  const link = document.createElement("a");
  link.download = `QR-${table.value.tableNumber || "table"}.txt`;
  link.href = `data:text/plain;charset=utf-8,${encodeURIComponent(table.value.qrCode)}`;
  link.click();
};

const printQRCode = () => {
  const tableNum = table.value.tableNumber || "";
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const doc = printWindow.document;
  const style = doc.createElement("style");
  style.textContent =
    "body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;font-family:system-ui}" +
    "h2{margin-bottom:16px;font-size:24px}p{font-size:14px;color:#666}";
  doc.head.appendChild(style);

  const heading = doc.createElement("h2");
  heading.textContent = t("tableDetail.qrCode.title") + " - " + tableNum;
  doc.body.appendChild(heading);

  const code = doc.createElement("p");
  code.textContent = table.value.qrCode;
  doc.body.appendChild(code);

  setTimeout(() => printWindow.print(), 300);
};

const regenerateQRCode = async () => {
  const confirmed = await confirmModal({
    type: "warning",
    title: t("tableDetail.confirm.regenerateTitle"),
    message: t("tableDetail.confirm.regenerateConfirm"),
    confirmLabel: t("tableDetail.confirm.regenerateAction"),
  });
  if (!confirmed) return;

  try {
    const response = await api.post(
      `/tables/${table.value.id}/regenerate-qr`,
      {},
    );
    if (response.data.success && response.data.data) {
      const result = response.data.data as { qrCode: string };
      table.value.qrCode = result.qrCode;
    }
  } catch (error) {
    console.error("Failed to regenerate QR code:", error);
    toast.error(t("tableDetail.confirm.regenerateFailed"));
  }
};

const loadTableData = async () => {
  const tableId = route.params.id;
  if (!tableId) return;

  isLoading.value = true;
  try {
    const response = await api.get(`/tables/${tableId}`);
    if (response.data.success && response.data.data) {
      const data = response.data.data as any;
      table.value = {
        id: data.id,
        tableNumber: data.number || data.tableNumber || "",
        tableName: data.name || data.tableName || "",
        capacity: data.capacity ?? 0,
        location: data.location || "",
        status: !data.isActive
          ? "maintenance"
          : data.isOccupied
            ? "occupied"
            : "available",
        qrMode: data.qrMode || "table",
        qrCode: data.qrCode || "",
        totalUsage: data.totalUsage || 0,
      };

      // 初始化新模式為當前模式
      newQRMode.value = table.value.qrMode;

      // 如果是座位模式，載入座位數據
      if (table.value.qrMode === "seat") {
        await loadSeats();
      }
    }
  } catch (error) {
    console.error("Failed to load table:", error);
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  loadTableData();
});
</script>

<style scoped>
.table-detail-view {
  padding: 1.5rem;
  max-width: 1400px;
  margin: 0 auto;
}

@media (max-width: 640px) {
  .table-detail-view {
    padding: 1rem;
  }
}
</style>
