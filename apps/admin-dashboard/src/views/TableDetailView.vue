<template>
  <div class="table-detail-view">
    <!-- 返回按鈕 -->
    <div class="mb-6">
      <button
        class="flex items-center text-gray-600 hover:text-gray-900"
        @click="goBack"
      >
        <ArrowLeftIcon class="h-5 w-5 mr-2" />
        返回桌台列表
      </button>
    </div>

    <!-- 桌台資訊卡片 -->
    <div class="bg-white rounded-lg shadow p-6 mb-6">
      <div class="flex justify-between items-start">
        <div>
          <h1 class="text-2xl font-bold text-gray-900 mb-2">
            桌號 {{ table.tableNumber }}
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
              {{ table.qrMode === "table" ? "桌子模式" : "座位模式" }}
            </span>
          </div>
        </div>

        <div class="flex space-x-2">
          <button
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            @click="showEditModal = true"
          >
            編輯桌台
          </button>
          <button
            class="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
            @click="showModeSwitchModal = true"
          >
            切換模式
          </button>
        </div>
      </div>

      <!-- 桌台詳細資訊 -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
        <div>
          <div class="text-sm text-gray-600">容量</div>
          <div class="text-lg font-semibold">{{ table.capacity }} 人</div>
        </div>
        <div>
          <div class="text-sm text-gray-600">位置</div>
          <div class="text-lg font-semibold">
            {{ table.location || "未設定" }}
          </div>
        </div>
        <div v-if="table.qrMode === 'seat'">
          <div class="text-sm text-gray-600">座位數量</div>
          <div class="text-lg font-semibold">{{ seats.length }} 個</div>
        </div>
        <div>
          <div class="text-sm text-gray-600">使用次數</div>
          <div class="text-lg font-semibold">
            {{ table.totalUsage || 0 }} 次
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
      <h2 class="text-xl font-bold text-gray-900 mb-4">桌台 QR 碼</h2>

      <div class="flex flex-col items-center">
        <div class="p-6 bg-gray-50 rounded-lg">
          <div
            class="w-64 h-64 bg-white border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center"
          >
            <div class="text-center">
              <QRCodeIcon class="mx-auto h-24 w-24 text-gray-400 mb-2" />
              <p class="text-sm text-gray-500">QR 碼預覽</p>
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
            下載 QR 碼
          </button>
          <button
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            @click="printQRCode"
          >
            列印 QR 碼
          </button>
          <button
            class="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
            @click="regenerateQRCode"
          >
            重新生成
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
              <h3 class="text-lg font-semibold">切換 QR 模式</h3>
              <button
                class="text-gray-400 hover:text-gray-600"
                @click="showModeSwitchModal = false"
              >
                <XMarkIcon class="h-6 w-6" />
              </button>
            </div>

            <div class="mb-6">
              <p class="text-sm text-gray-600">
                當前模式:
                <span class="font-semibold">{{
                  table.qrMode === "table" ? "桌子模式" : "座位模式"
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
                取消
              </button>
              <button
                type="button"
                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                @click="switchQRMode"
              >
                切換模式
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
import { useRouter, useRoute } from "vue-router";
import { ArrowLeftIcon, XMarkIcon } from "@heroicons/vue/24/outline";
import QRCodeIcon from "@heroicons/vue/24/outline/QrCodeIcon";
import SeatManagement from "../components/tables/SeatManagement.vue";
import QRModeSelector from "../components/tables/QRModeSelector.vue";

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
  const texts: Record<string, string> = {
    available: "可用",
    occupied: "使用中",
    reserved: "已預約",
    maintenance: "維護中",
  };
  return texts[status] || status;
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
    alert("桌台使用中，無法切換模式");
    return;
  }

  if (
    !confirm(
      `確定要切換到${newQRMode.value === "table" ? "桌子模式" : "座位模式"}嗎？`,
    )
  ) {
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

    alert("模式切換成功");
  } catch (error) {
    console.error("Failed to switch QR mode:", error);
    alert("模式切換失敗");
  }
};

const downloadQRCode = () => {
  alert("QR 碼下載功能開發中...");
};

const printQRCode = () => {
  alert("QR 碼列印功能開發中...");
};

const regenerateQRCode = async () => {
  if (!confirm("確定要重新生成 QR 碼嗎？")) {
    return;
  }

  try {
    // TODO: 調用 API 重新生成 QR
    console.log("Regenerating QR code for table:", table.value.id);
    alert("QR 碼已重新生成");
  } catch (error) {
    console.error("Failed to regenerate QR code:", error);
    alert("重新生成 QR 碼失敗");
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
