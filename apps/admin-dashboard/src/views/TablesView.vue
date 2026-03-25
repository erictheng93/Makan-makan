<template>
  <div class="tables-view">
    <!-- 頁面標題和操作 -->
    <div class="flex justify-between items-center mb-8">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">
          {{ t("tables.title") }}
        </h1>
        <p class="text-gray-600">{{ t("tables.subtitle") }}</p>
      </div>
      <div class="flex space-x-4">
        <button
          class="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          @click="generateAllQRCodes"
        >
          <PhotoIcon class="h-4 w-4 mr-2" />
          {{ t("tables.batchGenerateQR") }}
        </button>
        <button
          class="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          @click="showTableModal = true"
        >
          <PlusIcon class="h-4 w-4 mr-2" />
          {{ t("tables.addTable") }}
        </button>
      </div>
    </div>

    <!-- 桌台統計 -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-2 bg-green-100 rounded-lg">
            <CheckCircleIcon class="h-6 w-6 text-green-600" />
          </div>
          <div class="ml-4">
            <h3 class="text-lg font-semibold text-gray-900">
              {{ t("tables.stats.available") }}
            </h3>
            <p class="text-2xl font-bold text-green-600">
              {{ stats.available }}
            </p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-2 bg-red-100 rounded-lg">
            <UserGroupIcon class="h-6 w-6 text-red-600" />
          </div>
          <div class="ml-4">
            <h3 class="text-lg font-semibold text-gray-900">
              {{ t("tables.stats.occupied") }}
            </h3>
            <p class="text-2xl font-bold text-red-600">
              {{ stats.occupied }}
            </p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-2 bg-yellow-100 rounded-lg">
            <ClockIcon class="h-6 w-6 text-yellow-600" />
          </div>
          <div class="ml-4">
            <h3 class="text-lg font-semibold text-gray-900">
              {{ t("tables.stats.reserved") }}
            </h3>
            <p class="text-2xl font-bold text-yellow-600">
              {{ stats.reserved }}
            </p>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="p-2 bg-gray-100 rounded-lg">
            <WrenchIcon class="h-6 w-6 text-gray-600" />
          </div>
          <div class="ml-4">
            <h3 class="text-lg font-semibold text-gray-900">
              {{ t("tables.stats.maintenance") }}
            </h3>
            <p class="text-2xl font-bold text-gray-600">
              {{ stats.maintenance }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- 桌台篩選 -->
    <div class="bg-white rounded-lg shadow mb-6">
      <div class="p-6">
        <div class="flex flex-col sm:flex-row gap-4">
          <div class="relative flex-1">
            <MagnifyingGlassIcon
              class="absolute left-3 top-3 h-4 w-4 text-gray-400"
            />
            <input
              v-model="searchQuery"
              type="text"
              :placeholder="t('tables.searchPlaceholder')"
              class="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <select
            v-model="statusFilter"
            class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">{{ t("tables.filter.allStatus") }}</option>
            <option value="available">
              {{ t("tables.status.available") }}
            </option>
            <option value="occupied">{{ t("tables.status.occupied") }}</option>
            <option value="reserved">{{ t("tables.status.reserved") }}</option>
            <option value="maintenance">
              {{ t("tables.status.maintenance") }}
            </option>
          </select>
          <select
            v-model="capacityFilter"
            class="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">{{ t("tables.filter.allCapacity") }}</option>
            <option value="2">{{ t("tables.filter.seats2") }}</option>
            <option value="4">{{ t("tables.filter.seats4") }}</option>
            <option value="6">{{ t("tables.filter.seats6") }}</option>
            <option value="8">{{ t("tables.filter.seats8plus") }}</option>
          </select>
        </div>
      </div>
    </div>

    <!-- 桌台網格視圖 -->
    <div
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
    >
      <div
        v-for="table in filteredTables"
        :key="table.id"
        class="bg-white rounded-lg shadow hover:shadow-lg transition-shadow"
      >
        <!-- 桌台卡片 -->
        <div class="p-6">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center">
              <div
                :class="getStatusColor(table.status)"
                class="w-3 h-3 rounded-full mr-3"
              />
              <h3 class="text-lg font-semibold text-gray-900">
                {{ t("tables.tableNumber") }} {{ table.tableNumber }}
              </h3>
            </div>
            <span
              :class="getStatusBadgeClass(table.status)"
              class="px-2 py-1 text-xs font-medium rounded-full"
            >
              {{ getStatusText(table.status) }}
            </span>
          </div>

          <div class="space-y-2 mb-4">
            <div class="flex items-center text-sm text-gray-600">
              <UserGroupIcon class="h-4 w-4 mr-2" />
              <span
                >{{ t("tables.capacity") }}: {{ table.capacity }}
                {{ t("tables.people") }}</span
              >
            </div>
            <div class="flex items-center text-sm text-gray-600">
              <MapPinIcon class="h-4 w-4 mr-2" />
              <span
                >{{ t("tables.location") }}:
                {{ table.location || t("tables.notSet") }}</span
              >
            </div>
            <div
              v-if="table.currentOrderId"
              class="flex items-center text-sm text-gray-600"
            >
              <DocumentTextIcon class="h-4 w-4 mr-2" />
              <span>{{ t("tables.order") }}: #{{ table.currentOrderId }}</span>
            </div>
          </div>

          <!-- QR 碼預覽 -->
          <div class="mb-4 text-center">
            <div class="inline-block p-2 bg-gray-50 rounded-xl">
              <QRCodeRenderer :content="table.qrCode" :size="72" :padding="4" />
            </div>
          </div>

          <!-- 操作按鈕 -->
          <div class="flex flex-wrap gap-2">
            <button
              class="flex-1 px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              @click="viewQRCode(table)"
            >
              {{ t("tables.viewQR") }}
            </button>
            <button
              class="px-3 py-2 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              @click="editTable(table)"
            >
              {{ t("common.edit") }}
            </button>
            <button
              :class="getStatusButtonClass(table.status)"
              class="px-3 py-2 text-sm rounded-lg transition-colors"
              @click="changeTableStatus(table)"
            >
              {{ getStatusButtonText(table.status) }}
            </button>
          </div>
        </div>
      </div>

      <!-- 空狀態 -->
      <div
        v-if="filteredTables.length === 0"
        class="col-span-full text-center py-12"
      >
        <TableCellsIcon class="mx-auto h-12 w-12 text-gray-400" />
        <h3 class="mt-2 text-sm font-medium text-gray-900">
          {{ t("tables.empty.title") }}
        </h3>
        <p class="mt-1 text-sm text-gray-500">
          {{ t("tables.empty.subtitle") }}
        </p>
        <button
          class="mt-4 inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          @click="showTableModal = true"
        >
          <PlusIcon class="h-4 w-4 mr-2" />
          {{ t("tables.addTable") }}
        </button>
      </div>
    </div>

    <!-- 桌台管理模態框 -->
    <div v-if="showTableModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4">
        <div
          class="fixed inset-0 bg-black opacity-30"
          @click="closeTableModal"
        />
        <div
          class="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        >
          <div class="p-6">
            <h3 class="text-lg font-semibold mb-4">
              {{ editingTable ? t("tables.editTable") : t("tables.addTable") }}
            </h3>

            <form @submit.prevent="saveTable">
              <div class="space-y-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    {{ t("tables.form.tableNumber") }}
                    <span class="text-red-500">*</span>
                  </label>
                  <input
                    v-model="tableForm.tableNumber"
                    type="text"
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">{{
                    t("tables.form.tableName")
                  }}</label>
                  <input
                    v-model="tableForm.tableName"
                    type="text"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">
                    {{ t("tables.form.capacity") }}
                    <span class="text-red-500">*</span>
                  </label>
                  <select
                    v-model.number="tableForm.capacity"
                    required
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="2">
                      {{ t("tables.form.persons", { count: 2 }) }}
                    </option>
                    <option value="4">
                      {{ t("tables.form.persons", { count: 4 }) }}
                    </option>
                    <option value="6">
                      {{ t("tables.form.persons", { count: 6 }) }}
                    </option>
                    <option value="8">
                      {{ t("tables.form.persons", { count: 8 }) }}
                    </option>
                    <option value="10">
                      {{ t("tables.form.persons", { count: 10 }) }}
                    </option>
                  </select>
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">{{
                    t("tables.form.location")
                  }}</label>
                  <input
                    v-model="tableForm.location"
                    type="text"
                    :placeholder="t('tables.form.locationPlaceholder')"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1">{{
                    t("tables.form.status")
                  }}</label>
                  <select
                    v-model="tableForm.status"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="available">
                      {{ t("tables.status.available") }}
                    </option>
                    <option value="occupied">
                      {{ t("tables.status.occupied") }}
                    </option>
                    <option value="reserved">
                      {{ t("tables.status.reserved") }}
                    </option>
                    <option value="maintenance">
                      {{ t("tables.status.maintenance") }}
                    </option>
                  </select>
                </div>
              </div>

              <!-- QR 模式選擇器 -->
              <div class="mt-6">
                <QRModeSelector
                  v-model="tableForm.qrMode"
                  v-model:seat-config="tableForm.seatConfig"
                />
              </div>

              <div class="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  @click="closeTableModal"
                >
                  {{ t("common.cancel") }}
                </button>
                <button
                  type="submit"
                  class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {{ editingTable ? t("common.update") : t("common.add") }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>

    <!-- QR 碼預覽模態框 -->
    <div v-if="showQRModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4">
        <div
          class="fixed inset-0 bg-black opacity-30"
          @click="showQRModal = false"
        />
        <div class="relative bg-white rounded-lg shadow-xl max-w-md w-full">
          <div class="p-6 text-center">
            <h3 class="text-lg font-semibold mb-4">
              {{
                t("tables.qrModal.title", {
                  number: selectedTable?.tableNumber,
                })
              }}
            </h3>

            <div class="mb-6">
              <div class="inline-block p-4 bg-[#F2F2F7] rounded-2xl">
                <QRCodeRenderer
                  ref="qrModalRef"
                  :content="selectedTable?.qrCode || ''"
                  :size="200"
                  :padding="12"
                  container-class="shadow-sm"
                />
              </div>
              <p class="text-xs text-gray-400 mt-2 font-mono">
                {{ selectedTable?.qrCode }}
              </p>
            </div>

            <div class="flex justify-center space-x-3">
              <button
                class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                @click="downloadQRCode"
              >
                {{ t("tables.qrModal.download") }}
              </button>
              <button
                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                @click="printQRCode"
              >
                {{ t("tables.qrModal.print") }}
              </button>
              <button
                class="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                @click="showQRModal = false"
              >
                {{ t("common.close") }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useI18n } from "@/i18n";
import { api } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import {
  PlusIcon,
  MagnifyingGlassIcon,
  PhotoIcon,
  CheckCircleIcon,
  UserGroupIcon,
  ClockIcon,
  MapPinIcon,
  DocumentTextIcon,
  TableCellsIcon,
  WrenchIcon,
} from "@heroicons/vue/24/outline";
import QRModeSelector from "../components/tables/QRModeSelector.vue";
import QRCodeRenderer from "../components/tables/QRCodeRenderer.vue";

const { t } = useI18n();
const authStore = useAuthStore();
const qrModalRef = ref<InstanceType<typeof QRCodeRenderer> | null>(null);

// 響應式數據
const searchQuery = ref("");
const statusFilter = ref("");
const capacityFilter = ref("");
const showTableModal = ref(false);
const showQRModal = ref(false);
const editingTable = ref<any>(null);
const selectedTable = ref<any>(null);
const isLoading = ref(false);

/** Map API table object to the shape used by this view */
const mapTable = (t: any) => ({
  id: t.id,
  tableNumber: t.number || t.tableNumber || "",
  tableName: t.name || t.tableName || "",
  capacity: t.capacity ?? 0,
  location: t.location || "",
  status: !t.isActive ? "maintenance" : t.isOccupied ? "occupied" : "available",
  qrCode: t.qrCode || "",
  currentOrderId: t.orderId || null,
});

// 桌台數據
const tables = ref<any[]>([]);

// 表單數據
const tableForm = ref({
  tableNumber: "",
  tableName: "",
  capacity: 4,
  location: "",
  status: "available",
  qrMode: "table" as "table" | "seat",
  seatConfig: {
    count: 10,
    numberingStyle: "numeric" as "numeric" | "alphabetic" | "custom",
  },
});

// 計算屬性
const stats = computed(() => ({
  available: tables.value.filter((t) => t.status === "available").length,
  occupied: tables.value.filter((t) => t.status === "occupied").length,
  reserved: tables.value.filter((t) => t.status === "reserved").length,
  maintenance: tables.value.filter((t) => t.status === "maintenance").length,
}));

const filteredTables = computed(() => {
  let filtered = tables.value;

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(
      (table) =>
        table.tableNumber.toLowerCase().includes(query) ||
        table.tableName?.toLowerCase().includes(query) ||
        table.location?.toLowerCase().includes(query),
    );
  }

  if (statusFilter.value) {
    filtered = filtered.filter((table) => table.status === statusFilter.value);
  }

  if (capacityFilter.value) {
    const capacity = parseInt(capacityFilter.value);
    if (capacity === 8) {
      filtered = filtered.filter((table) => table.capacity >= 8);
    } else {
      filtered = filtered.filter((table) => table.capacity === capacity);
    }
  }

  return filtered.sort((a, b) => a.tableNumber.localeCompare(b.tableNumber));
});

// 方法
const getStatusColor = (status: string) => {
  const colors: Record<string, string> = {
    available: "bg-green-500",
    occupied: "bg-red-500",
    reserved: "bg-yellow-500",
    maintenance: "bg-gray-500",
  };
  return colors[status] || "bg-gray-500";
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
  const key = `tables.status.${status}`;
  return t(key) || status;
};

const getStatusButtonClass = (status: string) => {
  const classes: Record<string, string> = {
    available: "bg-red-600 text-white hover:bg-red-700",
    occupied: "bg-green-600 text-white hover:bg-green-700",
    reserved: "bg-blue-600 text-white hover:bg-blue-700",
    maintenance: "bg-yellow-600 text-white hover:bg-yellow-700",
  };
  return classes[status] || "bg-gray-600 text-white hover:bg-gray-700";
};

const getStatusButtonText = (status: string) => {
  const key = `tables.statusAction.${status}`;
  return t(key) || t("tables.statusAction.change");
};

const generateAllQRCodes = async () => {
  if (!confirm(t("tables.confirm.regenerateAllQR"))) return;

  const restaurantId = authStore.restaurantId;
  if (!restaurantId) return;

  try {
    const tableIds = tables.value.map((t) => t.id);
    await api.post("/tables/bulk-qr", {
      restaurantId: Number(restaurantId),
      tableIds,
    });
    // Reload tables to get updated QR codes
    await fetchTables();
  } catch (error) {
    console.error("Failed to generate QR codes:", error);
  }
};

const viewQRCode = (table: any) => {
  selectedTable.value = table;
  showQRModal.value = true;
};

const editTable = (table: any) => {
  editingTable.value = table;
  tableForm.value = {
    ...table,
    qrMode: table.qrMode || "table",
    seatConfig: table.seatConfig || {
      count: table.capacity || 4,
      numberingStyle: "numeric" as "numeric" | "alphabetic" | "custom",
    },
  };
  showTableModal.value = true;
};

const changeTableStatus = async (table: any) => {
  try {
    if (table.status === "occupied") {
      // Release the table
      await api.post(`/tables/${table.id}/release`);
    } else if (table.status === "available") {
      // Occupy the table (orderId is required by the API; use a placeholder since
      // actual order creation happens elsewhere)
      await api.post(`/tables/${table.id}/occupy`, {
        orderId: 0,
        occupiedBy: "manual",
      });
    } else if (table.status === "maintenance") {
      // Re-activate: update table to active state
      await api.put(`/tables/${table.id}`, { isActive: true });
    } else if (table.status === "reserved") {
      // Move reserved -> occupied
      await api.post(`/tables/${table.id}/occupy`, {
        orderId: 0,
        occupiedBy: "reservation",
      });
    }
    // Reload tables to reflect server state
    await fetchTables();
  } catch (error) {
    console.error("Failed to change table status:", error);
  }
};

const closeTableModal = () => {
  showTableModal.value = false;
  editingTable.value = null;
  tableForm.value = {
    tableNumber: "",
    tableName: "",
    capacity: 4,
    location: "",
    status: "available",
    qrMode: "table",
    seatConfig: {
      count: 10,
      numberingStyle: "numeric",
    },
  };
};

const saveTable = async () => {
  const restaurantId = authStore.restaurantId;
  if (!restaurantId) return;

  try {
    if (editingTable.value) {
      // 更新現有桌台
      await api.put(`/tables/${editingTable.value.id}`, {
        number: tableForm.value.tableNumber,
        name: tableForm.value.tableName || undefined,
        capacity: tableForm.value.capacity,
        location: tableForm.value.location || undefined,
        isActive: tableForm.value.status !== "maintenance",
      });
    } else {
      // 新增桌台
      await api.post("/tables", {
        restaurantId: Number(restaurantId),
        number: tableForm.value.tableNumber,
        name: tableForm.value.tableName || undefined,
        capacity: tableForm.value.capacity,
        location: tableForm.value.location || undefined,
      });
    }
    closeTableModal();
    await fetchTables();
  } catch (error) {
    console.error("Failed to save table:", error);
  }
};

const downloadQRCode = () => {
  const dataUrl = qrModalRef.value?.getDataUrl();
  if (!dataUrl) return;
  const link = document.createElement("a");
  link.download = `QR-${selectedTable.value?.tableNumber || "table"}.png`;
  link.href = dataUrl;
  link.click();
};

const printQRCode = () => {
  const dataUrl = qrModalRef.value?.getDataUrl();
  if (!dataUrl) return;
  const tableNum = selectedTable.value?.tableNumber || "";
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const doc = printWindow.document;
  const style = doc.createElement("style");
  style.textContent =
    "body{display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100vh;margin:0;font-family:system-ui}" +
    "h2{margin-bottom:16px;font-size:24px}img{border:1px solid #eee;border-radius:12px}";
  doc.head.appendChild(style);

  const heading = doc.createElement("h2");
  heading.textContent = t("tables.qrModal.title", { number: tableNum });
  doc.body.appendChild(heading);

  const img = doc.createElement("img");
  img.src = dataUrl;
  img.width = 300;
  img.height = 300;
  doc.body.appendChild(img);

  setTimeout(() => printWindow.print(), 300);
};

const fetchTables = async () => {
  const restaurantId = authStore.restaurantId;
  if (!restaurantId) return;

  isLoading.value = true;
  try {
    const response = await api.get("/tables", {
      restaurantId,
    });
    if (response.data.success && response.data.data) {
      tables.value = (response.data.data as any[]).map(mapTable);
    }
  } catch (error) {
    console.error("Failed to fetch tables:", error);
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  fetchTables();
});
</script>

<style scoped>
.tables-view {
  padding: 1.5rem;
}

@media (max-width: 640px) {
  .tables-view {
    padding: 1rem;
  }
}
</style>
