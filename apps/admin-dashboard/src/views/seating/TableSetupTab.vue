<template>
  <div class="space-y-6">
    <!-- Action Bar -->
    <div class="flex flex-wrap justify-end gap-3 mb-0">
      <button
        class="flex items-center px-5 py-2.5 rounded-full text-[13px] font-semibold bg-[#34C759] text-white hover:bg-[#2DB84D] transition-colors shadow-sm"
        @click="generateAllQRCodes"
      >
        <QrCode class="w-4 h-4 mr-1.5" />
        {{ t("tables.batchGenerateQR") }}
      </button>
      <button
        v-if="selectedPrintableCount > 0"
        class="flex items-center px-5 py-2.5 rounded-full text-[13px] font-semibold bg-[#1C1C1E] text-white hover:bg-[#1C1C1E]/85 transition-colors shadow-sm"
        @click="printSelectedTableQRCodes"
      >
        <QrCode class="w-4 h-4 mr-1.5" />
        {{
          t("tables.qrModal.printSelected", { count: selectedPrintableCount })
        }}
      </button>
      <button
        class="flex items-center px-5 py-2.5 rounded-full text-[13px] font-semibold bg-[#1C1C1E]/10 text-[#1C1C1E] hover:bg-[#1C1C1E]/20 transition-colors"
        @click="printAllTableQRCodes"
      >
        <QrCode class="w-4 h-4 mr-1.5" />
        {{ t("tables.qrModal.printAll") }}
      </button>
      <button
        class="flex items-center px-5 py-2.5 rounded-full text-[13px] font-semibold bg-[#007AFF] text-white hover:bg-[#0066D6] transition-colors shadow-sm"
        @click="showTableModal = true"
      >
        <Plus class="w-4 h-4 mr-1.5" />
        {{ t("tables.addTable") }}
      </button>
    </div>

    <!-- Filters -->
    <div class="card p-6">
      <div class="flex flex-col sm:flex-row gap-4">
        <div class="relative flex-1">
          <Search class="absolute left-3 top-3 h-4 w-4 text-[#1C1C1E]/30" />
          <input
            v-model="searchQuery"
            type="text"
            :placeholder="t('tables.searchPlaceholder')"
            class="w-full pl-10 pr-4 py-2 border border-[#E5E5EA] rounded-xl focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF] bg-[#F2F2F7]/50 text-sm"
          />
        </div>
        <select
          v-model="statusFilter"
          class="px-3 py-2 border border-[#E5E5EA] rounded-xl focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF] bg-[#F2F2F7]/50 text-sm"
        >
          <option value="">{{ t("tables.filter.allStatus") }}</option>
          <option value="available">{{ t("tables.status.available") }}</option>
          <option value="occupied">{{ t("tables.status.occupied") }}</option>
          <option value="reserved">{{ t("tables.status.reserved") }}</option>
          <option value="maintenance">
            {{ t("tables.status.maintenance") }}
          </option>
        </select>
        <label
          v-if="filteredTables.length > 0"
          class="flex items-center px-3 py-2 text-sm text-[#1C1C1E]/70 cursor-pointer select-none whitespace-nowrap"
        >
          <input
            type="checkbox"
            class="h-4 w-4 mr-2 rounded border-[#E5E5EA] text-[#007AFF] focus:ring-[#007AFF]/30"
            :checked="allFilteredSelected"
            @change="toggleSelectAllFiltered"
          />
          {{ t("tables.qrModal.selectAllFiltered") }}
        </label>
        <select
          v-model="capacityFilter"
          class="px-3 py-2 border border-[#E5E5EA] rounded-xl focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF] bg-[#F2F2F7]/50 text-sm"
        >
          <option value="">{{ t("tables.filter.allCapacity") }}</option>
          <option value="2">{{ t("tables.filter.seats2") }}</option>
          <option value="4">{{ t("tables.filter.seats4") }}</option>
          <option value="6">{{ t("tables.filter.seats6") }}</option>
          <option value="8">{{ t("tables.filter.seats8plus") }}</option>
        </select>
      </div>
    </div>

    <!-- Tables Grid -->
    <div
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
    >
      <div
        v-for="table in filteredTables"
        :key="table.id"
        class="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.06)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.1)] transition-all"
      >
        <div class="p-6">
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center">
              <input
                type="checkbox"
                class="h-4 w-4 mr-3 rounded border-[#E5E5EA] text-[#007AFF] focus:ring-[#007AFF]/30 cursor-pointer"
                :checked="isTableSelected(table.id)"
                :aria-label="
                  t('tables.qrModal.selectForPrint', {
                    number: table.tableNumber,
                  })
                "
                :data-testid="`select-table-${table.id}`"
                @change="toggleTableSelection(table.id)"
              />
              <div
                :class="getStatusColor(table.status)"
                class="w-3 h-3 rounded-full mr-3"
              />
              <h3 class="text-lg font-semibold text-[#1C1C1E]">
                {{ t("tables.tableNumber") }} {{ table.tableNumber }}
              </h3>
            </div>
            <span
              :class="getStatusBadgeClass(table.status)"
              class="px-2.5 py-1 text-xs font-medium rounded-full"
            >
              {{ getStatusText(table.status) }}
            </span>
          </div>

          <div class="space-y-2 mb-4">
            <div class="flex items-center text-sm text-[#1C1C1E]/60">
              <Users class="h-4 w-4 mr-2" />
              <span
                >{{ t("tables.capacity") }}: {{ table.capacity }}
                {{ t("tables.people") }}</span
              >
            </div>
            <div class="flex items-center text-sm text-[#1C1C1E]/60">
              <MapPin class="h-4 w-4 mr-2" />
              <span
                >{{ t("tables.location") }}:
                {{ table.location || t("tables.notSet") }}</span
              >
            </div>
            <div
              v-if="table.currentOrderId"
              class="flex items-center text-sm text-[#1C1C1E]/60"
            >
              <FileText class="h-4 w-4 mr-2" />
              <span>{{ t("tables.order") }}: #{{ table.currentOrderId }}</span>
            </div>
          </div>

          <!-- QR Code Preview -->
          <div class="mb-4 text-center">
            <div class="inline-block p-2 bg-[#F2F2F7] rounded-xl">
              <QRCodeRenderer :content="table.qrCode" :size="72" :padding="4" />
            </div>
          </div>

          <!-- Actions -->
          <div class="flex flex-wrap gap-2">
            <button
              class="flex-1 px-3 py-2 text-sm bg-[#007AFF] text-white rounded-full hover:bg-[#0066D6] transition-colors"
              @click="viewQRCode(table)"
            >
              {{ t("tables.viewQR") }}
            </button>
            <button
              v-if="table.qrMode === 'seat'"
              class="px-3 py-2 text-sm bg-[#34C759] text-white rounded-full hover:bg-[#2DB84D] transition-colors"
              @click="manageSeats(table)"
            >
              {{ t("seatManagement.title") }}
            </button>
            <button
              class="px-3 py-2 text-sm bg-[#1C1C1E]/10 text-[#1C1C1E] rounded-full hover:bg-[#1C1C1E]/20 transition-colors"
              @click="editTable(table)"
            >
              {{ t("common.edit") }}
            </button>
            <button
              :class="getStatusButtonClass(table.status)"
              class="px-3 py-2 text-sm rounded-full transition-colors"
              @click="changeTableStatus(table)"
            >
              {{ getStatusButtonText(table.status) }}
            </button>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div
        v-if="filteredTables.length === 0"
        class="col-span-full text-center py-12"
      >
        <TableProperties class="mx-auto h-12 w-12 text-[#1C1C1E]/30" />
        <h3 class="mt-2 text-sm font-medium text-[#1C1C1E]">
          {{ t("tables.empty.title") }}
        </h3>
        <p class="mt-1 text-sm text-[#1C1C1E]/50">
          {{ t("tables.empty.subtitle") }}
        </p>
        <button
          class="mt-4 inline-flex items-center px-5 py-2.5 bg-[#007AFF] text-white rounded-full hover:bg-[#0066D6] transition-colors text-sm font-semibold"
          @click="showTableModal = true"
        >
          <Plus class="h-4 w-4 mr-1.5" />
          {{ t("tables.addTable") }}
        </button>
      </div>
    </div>

    <!-- Table Management Modal -->
    <div v-if="showTableModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4">
        <div class="fixed inset-0 bg-black/30" @click="closeTableModal" />
        <div
          class="relative bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
        >
          <div class="p-6">
            <h3 class="text-lg font-semibold text-[#1C1C1E] mb-4">
              {{ editingTable ? t("tables.editTable") : t("tables.addTable") }}
            </h3>

            <form @submit.prevent="saveTable">
              <div class="space-y-4">
                <div>
                  <label
                    class="block text-sm font-medium text-[#1C1C1E]/70 mb-1"
                  >
                    {{ t("tables.form.tableNumber") }}
                    <span class="text-[#FF3B30]">*</span>
                  </label>
                  <input
                    v-model="tableForm.tableNumber"
                    type="text"
                    required
                    class="w-full px-3 py-2 border border-[#E5E5EA] rounded-xl focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF] text-sm"
                  />
                </div>

                <div>
                  <label
                    class="block text-sm font-medium text-[#1C1C1E]/70 mb-1"
                    >{{ t("tables.form.tableName") }}</label
                  >
                  <input
                    v-model="tableForm.tableName"
                    type="text"
                    class="w-full px-3 py-2 border border-[#E5E5EA] rounded-xl focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF] text-sm"
                  />
                </div>

                <div>
                  <label
                    class="block text-sm font-medium text-[#1C1C1E]/70 mb-1"
                  >
                    {{ t("tables.form.capacity") }}
                    <span class="text-[#FF3B30]">*</span>
                  </label>
                  <select
                    v-model.number="tableForm.capacity"
                    required
                    class="w-full px-3 py-2 border border-[#E5E5EA] rounded-xl focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF] text-sm"
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
                  <label
                    class="block text-sm font-medium text-[#1C1C1E]/70 mb-1"
                    >{{ t("tables.form.location") }}</label
                  >
                  <input
                    v-model="tableForm.location"
                    type="text"
                    :placeholder="t('tables.form.locationPlaceholder')"
                    class="w-full px-3 py-2 border border-[#E5E5EA] rounded-xl focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF] text-sm"
                  />
                </div>

                <div>
                  <label
                    class="block text-sm font-medium text-[#1C1C1E]/70 mb-1"
                    >{{ t("tables.form.status") }}</label
                  >
                  <select
                    v-model="tableForm.status"
                    class="w-full px-3 py-2 border border-[#E5E5EA] rounded-xl focus:ring-2 focus:ring-[#007AFF]/30 focus:border-[#007AFF] text-sm"
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

              <!-- QR Mode Selector -->
              <div class="mt-6">
                <QRModeSelector
                  v-model="tableForm.qrMode"
                  v-model:seat-config="tableForm.seatConfig"
                  :max-seat-count="tableForm.capacity"
                />
              </div>

              <div class="flex justify-end space-x-3 mt-6">
                <button
                  type="button"
                  class="px-5 py-2.5 text-[#1C1C1E] bg-[#F2F2F7] rounded-full hover:bg-[#E5E5EA] transition-colors text-sm font-semibold"
                  @click="closeTableModal"
                >
                  {{ t("common.cancel") }}
                </button>
                <button
                  type="submit"
                  class="px-5 py-2.5 bg-[#007AFF] text-white rounded-full hover:bg-[#0066D6] transition-colors text-sm font-semibold"
                >
                  {{ editingTable ? t("common.update") : t("common.add") }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>

    <!-- QR Code Preview Modal -->
    <div v-if="showQRModal" class="fixed inset-0 z-50 overflow-y-auto">
      <div class="flex items-center justify-center min-h-screen px-4">
        <div class="fixed inset-0 bg-black/30" @click="showQRModal = false" />
        <div class="relative bg-white rounded-2xl shadow-xl max-w-md w-full">
          <div class="p-6 text-center">
            <h3 class="text-lg font-semibold text-[#1C1C1E] mb-4">
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
              <p class="text-xs text-[#1C1C1E]/30 mt-2 font-mono">
                {{ selectedTable?.qrCode }}
              </p>
            </div>

            <div class="flex justify-center space-x-3">
              <button
                class="px-5 py-2.5 bg-[#34C759] text-white rounded-full hover:bg-[#2DB84D] transition-colors text-sm font-semibold"
                @click="downloadQRCode"
              >
                {{ t("tables.qrModal.download") }}
              </button>
              <button
                class="px-5 py-2.5 bg-[#007AFF] text-white rounded-full hover:bg-[#0066D6] transition-colors text-sm font-semibold"
                @click="printQRCode"
              >
                {{ t("tables.qrModal.print") }}
              </button>
              <button
                class="px-5 py-2.5 text-[#1C1C1E] bg-[#F2F2F7] rounded-full hover:bg-[#E5E5EA] transition-colors text-sm font-semibold"
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
import { ref, computed, onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "@/i18n";
import { useToast } from "vue-toastification";
import { useConfirmModal } from "@/composables/useConfirmModal";
import { api, unwrapApiList } from "@/services/api";
import { useAuthStore } from "@/stores/auth";
import {
  Plus,
  Search,
  QrCode,
  Users,
  MapPin,
  FileText,
  TableProperties,
} from "lucide-vue-next";
import QRModeSelector from "@/components/tables/QRModeSelector.vue";
import QRCodeRenderer from "@/components/tables/QRCodeRenderer.vue";
import { printQRCodeSheet, toPrintableDataUrl } from "@/utils/qrPrintSheet";

const { t } = useI18n();
const toast = useToast();
const { confirm: confirmModal } = useConfirmModal();
const authStore = useAuthStore();
const router = useRouter();
const qrModalRef = ref<InstanceType<typeof QRCodeRenderer> | null>(null);

const searchQuery = ref("");
const statusFilter = ref("");
const capacityFilter = ref("");
const showTableModal = ref(false);
const showQRModal = ref(false);
const editingTable = ref<any>(null);
const selectedTable = ref<any>(null);

/** Map API table object to the shape used by this view */
const mapTable = (t: any) => ({
  id: t.id,
  tableNumber: t.number || t.tableNumber || "",
  tableName: t.name || t.tableName || "",
  capacity: t.capacity ?? 0,
  location: t.location || "",
  status: !t.isActive ? "maintenance" : t.isOccupied ? "occupied" : "available",
  qrCode: t.qrCode || "",
  qrMode: t.qrMode || "table",
  seatCount: t.seatCount ?? 0,
  seatNumberingStyle: t.seatNumberingStyle || "numeric",
  currentOrderId: t.orderId || null,
});

const tables = ref<any[]>([]);

const defaultTableForm = () => ({
  tableNumber: "",
  tableName: "",
  capacity: 4,
  location: "",
  status: "available",
  qrMode: "table" as "table" | "seat",
  seatConfig: {
    count: 4,
    numberingStyle: "numeric" as "numeric" | "alphabetic",
  },
});

const tableForm = ref(defaultTableForm());

watch(
  () => tableForm.value.capacity,
  (capacity) => {
    if (tableForm.value.seatConfig.count > capacity) {
      tableForm.value.seatConfig.count = capacity;
    }
  },
);

const filteredTables = computed(() => {
  const query = searchQuery.value.toLowerCase();
  const status = statusFilter.value;
  const capVal = capacityFilter.value ? parseInt(capacityFilter.value) : 0;

  return tables.value
    .filter((table) => {
      if (
        query &&
        !(
          table.tableNumber.toLowerCase().includes(query) ||
          table.tableName?.toLowerCase().includes(query) ||
          table.location?.toLowerCase().includes(query)
        )
      )
        return false;
      if (status && table.status !== status) return false;
      if (capVal) {
        if (capVal === 8 ? table.capacity < 8 : table.capacity !== capVal)
          return false;
      }
      return true;
    })
    .sort((a, b) => a.tableNumber.localeCompare(b.tableNumber));
});

/**
 * QR print selection.
 *
 * Kept independent of the active filter on purpose: building a print run
 * section by section (filter to 1F, select, filter to 2F, add more) is the
 * reason to select at all, so changing the filter must not silently discard
 * what is already picked. Select-all, by contrast, acts on what is visible.
 */
const selectedTableIds = ref<number[]>([]);

const isTableSelected = (id: number) => selectedTableIds.value.includes(id);

const toggleTableSelection = (id: number) => {
  selectedTableIds.value = isTableSelected(id)
    ? selectedTableIds.value.filter((selected) => selected !== id)
    : [...selectedTableIds.value, id];
};

const allFilteredSelected = computed(
  () =>
    filteredTables.value.length > 0 &&
    filteredTables.value.every((table) => isTableSelected(table.id)),
);

const toggleSelectAllFiltered = () => {
  const visibleIds = filteredTables.value.map((table) => table.id);
  if (allFilteredSelected.value) {
    selectedTableIds.value = selectedTableIds.value.filter(
      (id) => !visibleIds.includes(id),
    );
    return;
  }
  const merged = new Set([...selectedTableIds.value, ...visibleIds]);
  selectedTableIds.value = [...merged];
};

const selectedPrintableTables = computed(() =>
  tables.value.filter(
    (table) => isTableSelected(table.id) && Boolean(table.qrCode),
  ),
);

const selectedPrintableCount = computed(
  () => selectedPrintableTables.value.length,
);

const printSelectedTableQRCodes = async () => {
  await printTableQRCodes(selectedPrintableTables.value);
};

const STATUS_COLORS: Record<string, string> = {
  available: "bg-[#34C759]",
  occupied: "bg-[#FF3B30]",
  reserved: "bg-[#FF9500]",
  maintenance: "bg-[#8E8E93]",
};

const STATUS_BADGE_CLASSES: Record<string, string> = {
  available: "bg-emerald-50 text-emerald-700",
  occupied: "bg-red-50 text-red-700",
  reserved: "bg-amber-50 text-amber-700",
  maintenance: "bg-slate-100 text-slate-700",
};

const STATUS_BUTTON_CLASSES: Record<string, string> = {
  available: "bg-[#FF3B30] text-white hover:bg-[#E0352B]",
  occupied: "bg-[#34C759] text-white hover:bg-[#2DB84D]",
  reserved: "bg-[#007AFF] text-white hover:bg-[#0066D6]",
  maintenance: "bg-[#FF9500] text-white hover:bg-[#E08600]",
};

const getStatusColor = (status: string) =>
  STATUS_COLORS[status] || STATUS_COLORS.maintenance;
const getStatusBadgeClass = (status: string) =>
  STATUS_BADGE_CLASSES[status] || STATUS_BADGE_CLASSES.maintenance;
const getStatusText = (status: string) =>
  t(`tables.status.${status}`) || status;
const getStatusButtonClass = (status: string) =>
  STATUS_BUTTON_CLASSES[status] || "bg-[#8E8E93] text-white hover:bg-[#7C7C80]";
const getStatusButtonText = (status: string) =>
  t(`tables.statusAction.${status}`) || t("tables.statusAction.change");

const generateAllQRCodes = async () => {
  const confirmed = await confirmModal({
    type: "warning",
    title: t("tables.confirm.regenerateAllQRTitle"),
    message: t("tables.confirm.regenerateAllQR"),
    confirmLabel: t("tables.confirm.regenerateAllQRAction"),
  });
  if (!confirmed) return;

  const restaurantId = authStore.restaurantId;
  if (!restaurantId) return;

  try {
    const tableIds = tables.value.map((t) => t.id);
    await api.post("/tables/bulk-qr", {
      restaurantId,
      tableIds,
    });
    await fetchTables();
    toast.success(t("tables.alert.qrGenerated"));
  } catch (error) {
    console.error("Failed to generate QR codes:", error);
    toast.error(t("tables.alert.qrGenerateFailed"));
  }
};

const viewQRCode = (table: any) => {
  selectedTable.value = table;
  showQRModal.value = true;
};

const manageSeats = (table: any) => {
  router.push({
    name: "TableDetail",
    params: { id: table.id },
  });
};

const editTable = (table: any) => {
  editingTable.value = table;
  tableForm.value = {
    ...table,
    qrMode: table.qrMode || "table",
    seatConfig: {
      count: table.seatCount || table.capacity || 4,
      numberingStyle: table.seatNumberingStyle || "numeric",
    },
  };
  showTableModal.value = true;
};

const changeTableStatus = async (table: any) => {
  try {
    if (table.status === "occupied") {
      await api.post(`/tables/${table.id}/release`);
    } else if (table.status === "available") {
      // Manual seating from the floor plan — no order exists yet, so omit orderId
      await api.post(`/tables/${table.id}/occupy`, { occupiedBy: "manual" });
    } else if (table.status === "maintenance") {
      await api.put(`/tables/${table.id}`, { isActive: true });
    } else if (table.status === "reserved") {
      await api.post(`/tables/${table.id}/occupy`, {
        occupiedBy: "reservation",
      });
    }
    await fetchTables();
  } catch (error) {
    console.error("Failed to change table status:", error);
    toast.error(t("tables.alert.statusChangeFailed"));
  }
};

const closeTableModal = () => {
  showTableModal.value = false;
  editingTable.value = null;
  tableForm.value = defaultTableForm();
};

const saveTable = async () => {
  const restaurantId = authStore.restaurantId;
  if (!restaurantId) return;

  // Captured before closeTableModal() clears editingTable
  const isEdit = Boolean(editingTable.value);

  try {
    if (editingTable.value) {
      await api.put(`/tables/${editingTable.value.id}`, {
        number: tableForm.value.tableNumber,
        name: tableForm.value.tableName || undefined,
        capacity: tableForm.value.capacity,
        location: tableForm.value.location || undefined,
        isActive: tableForm.value.status !== "maintenance",
        qrMode: tableForm.value.qrMode,
        seatCount:
          tableForm.value.qrMode === "seat"
            ? tableForm.value.seatConfig.count
            : 0,
        seatNumberingStyle: tableForm.value.seatConfig.numberingStyle,
      });
    } else {
      await api.post("/tables", {
        restaurantId,
        number: tableForm.value.tableNumber,
        name: tableForm.value.tableName || undefined,
        capacity: tableForm.value.capacity,
        location: tableForm.value.location || undefined,
        qrMode: tableForm.value.qrMode,
        seatCount:
          tableForm.value.qrMode === "seat"
            ? tableForm.value.seatConfig.count
            : 0,
        seatNumberingStyle: tableForm.value.seatConfig.numberingStyle,
      });
    }
    closeTableModal();
    await fetchTables();
    toast.success(
      isEdit
        ? t("tables.alert.updateSuccess")
        : t("tables.alert.createSuccess"),
    );
  } catch (error) {
    console.error("Failed to save table:", error);
    toast.error(t("tables.alert.saveFailed"));
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
  const label = t("tables.qrModal.title", {
    number: selectedTable.value?.tableNumber || "",
  });
  if (!printQRCodeSheet(label, [{ label, dataUrl }])) {
    toast.error(t("tables.alert.printFailed"));
  }
};

/**
 * Re-stickering a venue means printing many codes at once — one sheet per table
 * is not workable for a rollout (#88 phase 2).
 */
const printTableQRCodes = async (
  targets: Array<{ tableNumber: string; qrCode: string }>,
) => {
  if (targets.length === 0) {
    toast.warning(t("tables.alert.nothingToPrint"));
    return;
  }

  try {
    const qrCodes = await Promise.all(
      targets.map(async (table) => ({
        label: t("tables.qrModal.title", { number: table.tableNumber }),
        dataUrl: await toPrintableDataUrl(table.qrCode),
      })),
    );
    if (!printQRCodeSheet(t("tables.qrModal.printAllTitle"), qrCodes)) {
      toast.error(t("tables.alert.printFailed"));
    }
  } catch (error) {
    console.error("Failed to prepare table QR codes for printing:", error);
    toast.error(t("tables.alert.printFailed"));
  }
};

const printAllTableQRCodes = async () => {
  await printTableQRCodes(filteredTables.value.filter((table) => table.qrCode));
};

const fetchTables = async () => {
  const restaurantId = authStore.restaurantId;
  if (!restaurantId) return;

  try {
    const response = await api.get("/tables", { restaurantId });
    if (response.data.success && response.data.data) {
      tables.value = unwrapApiList(response.data.data).map(mapTable);
      // A selected id whose table has since been deleted would print a QR that
      // no longer resolves, so drop anything the server no longer returns.
      const liveIds = new Set(tables.value.map((table) => table.id));
      selectedTableIds.value = selectedTableIds.value.filter((id) =>
        liveIds.has(id),
      );
    }
  } catch (error) {
    console.error("Failed to fetch tables:", error);
    toast.error(t("tables.alert.loadFailed"));
  }
};

onMounted(() => {
  fetchTables();
});
</script>
