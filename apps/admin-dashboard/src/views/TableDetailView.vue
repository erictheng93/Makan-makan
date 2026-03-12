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
import { useRouter, useRoute } from "vue-router";
import { ArrowLeftIcon, XMarkIcon } from "@heroicons/vue/24/outline";
import QRCodeIcon from "@heroicons/vue/24/outline/QrCodeIcon";
import SeatManagement from "../components/tables/SeatManagement.vue";
import QRModeSelector from "../components/tables/QRModeSelector.vue";

const { t } = useI18n();
const router = useRouter();
const route = useRoute();

// 響應式數據
const table = ref({
  id: 1,
  tableNumber: "T01",
  tableName: "Table 1",
  capacity: 4,
  location: "靠窗位置",
  status: "available",
  qrMode: "table" as "table" | "seat",
  qrCode: "QR_REST1_T01_ABC123",
  totalUsage: 45,
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
  if (table.value.qrMode === "seat") {
    // TODO: 從 API 載入座位數據
    console.log("Loading seats for table:", table.value.id);

    // 模擬數據
    seats.value = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      tableId: table.value.id,
      seatNumber: String(i + 1).padStart(2, "0"),
      seatName: `座位 ${i + 1}`,
      qrCode: `QR_SEAT_${table.value.id}_${String(i + 1).padStart(2, "0")}`,
      isOccupied: Math.random() > 0.7,
      isActive: true,
      totalUsage: Math.floor(Math.random() * 50),
      currentOrderId:
        Math.random() > 0.7 ? Math.floor(Math.random() * 1000) : undefined,
      occupiedBy:
        Math.random() > 0.7
          ? `User ${Math.floor(Math.random() * 100)}`
          : undefined,
    }));
  }
};

const switchQRMode = async () => {
  if (table.value.status === "occupied") {
    alert(t("tableDetail.confirm.occupiedError"));
    return;
  }

  const modeName =
    newQRMode.value === "table"
      ? t("tableDetail.tableMode")
      : t("tableDetail.seatMode");
  if (!confirm(t("tableDetail.confirm.switchMode", { mode: modeName }))) {
    return;
  }

  try {
    // TODO: 調用 API 切換模式
    console.log("Switching QR mode:", {
      tableId: table.value.id,
      newMode: newQRMode.value,
      seatConfig: newSeatConfig.value,
    });

    table.value.qrMode = newQRMode.value;
    showModeSwitchModal.value = false;

    if (newQRMode.value === "seat") {
      await loadSeats();
    }

    alert(t("tableDetail.confirm.switchSuccess"));
  } catch (error) {
    console.error("Failed to switch QR mode:", error);
    alert(t("tableDetail.confirm.switchFailed"));
  }
};

const downloadQRCode = () => {
  alert(t("tableDetail.confirm.downloadInProgress"));
};

const printQRCode = () => {
  alert(t("tableDetail.confirm.printInProgress"));
};

const regenerateQRCode = async () => {
  if (!confirm(t("tableDetail.confirm.regenerateConfirm"))) {
    return;
  }

  try {
    // TODO: 調用 API 重新生成 QR
    console.log("Regenerating QR code for table:", table.value.id);
    alert(t("tableDetail.confirm.regenerateSuccess"));
  } catch (error) {
    console.error("Failed to regenerate QR code:", error);
    alert(t("tableDetail.confirm.regenerateFailed"));
  }
};

onMounted(() => {
  // 從路由參數獲取桌台 ID 並載入數據
  const tableId = route.params.id;
  console.log("Loading table:", tableId);

  // TODO: 從 API 載入桌台數據
  // 如果是座位模式，載入座位數據
  if (table.value.qrMode === "seat") {
    loadSeats();
  }

  // 初始化新模式為當前模式
  newQRMode.value = table.value.qrMode;
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
