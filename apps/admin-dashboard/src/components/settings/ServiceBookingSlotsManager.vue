<template>
  <section
    class="rounded-lg bg-white p-6 shadow"
    data-testid="service-booking-slots-manager"
  >
    <div
      class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
    >
      <div>
        <h3 class="text-lg font-semibold text-gray-900">服務預約容量</h3>
        <p class="mt-1 text-sm text-gray-500">
          設定每個可預約服務在指定日期與時段的可接容量。
        </p>
      </div>
      <button
        type="button"
        class="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        :disabled="isLoading"
        @click="loadData"
      >
        重新整理
      </button>
    </div>

    <div
      v-if="!restaurantId"
      class="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
    >
      請先選擇要管理的店家。
    </div>

    <template v-else>
      <div
        v-if="bookableServices.length === 0 && !isLoading"
        class="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
      >
        目前沒有啟用「需預約」的服務，請先在服務項目中建立。
      </div>

      <form class="mt-5 space-y-4" @submit.prevent="createSlot">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-5">
          <div class="md:col-span-2">
            <label class="mb-2 block text-sm font-medium text-gray-700">
              服務
            </label>
            <select
              v-model.number="form.serviceItemId"
              data-testid="slot-service-select"
              required
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            >
              <option :value="0" disabled>選擇服務</option>
              <option
                v-for="service in bookableServices"
                :key="service.id"
                :value="service.id"
              >
                {{ service.name }}
              </option>
            </select>
          </div>
          <div>
            <label class="mb-2 block text-sm font-medium text-gray-700">
              日期
            </label>
            <input
              v-model="form.date"
              data-testid="slot-date-input"
              type="date"
              required
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div>
            <label class="mb-2 block text-sm font-medium text-gray-700">
              時段
            </label>
            <input
              v-model="form.timeSlot"
              data-testid="slot-time-input"
              type="time"
              required
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div>
            <label class="mb-2 block text-sm font-medium text-gray-700">
              容量
            </label>
            <input
              v-model.number="form.maxCapacity"
              data-testid="slot-capacity-input"
              type="number"
              min="1"
              max="1000"
              required
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-3">
          <label class="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              v-model="form.isAvailable"
              type="checkbox"
              class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            開放預約
          </label>
          <button
            type="submit"
            data-testid="slot-create-submit"
            class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            :disabled="isSaving || !canSubmitSingle"
          >
            儲存時段
          </button>
        </div>
      </form>

      <section class="mt-6 border-t border-gray-200 pt-5">
        <h4 class="text-base font-semibold text-gray-900">批次建立</h4>
        <div class="mt-3 grid grid-cols-1 gap-4 md:grid-cols-5">
          <input
            v-model="batch.startDate"
            data-testid="slot-batch-start"
            type="date"
            class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
          <input
            v-model="batch.endDate"
            data-testid="slot-batch-end"
            type="date"
            class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
          <input
            v-model="batch.timeSlotsText"
            data-testid="slot-batch-times"
            type="text"
            class="md:col-span-2 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            placeholder="10:00, 11:00, 14:30"
          />
          <button
            type="button"
            data-testid="slot-batch-submit"
            class="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            :disabled="isSaving || !canSubmitBatch"
            @click="batchCreateSlots"
          >
            批次建立
          </button>
        </div>
      </section>

      <p v-if="errorMessage" class="mt-4 text-sm text-red-600">
        {{ errorMessage }}
      </p>
      <p v-if="successMessage" class="mt-4 text-sm text-green-700">
        {{ successMessage }}
      </p>

      <section class="mt-6 border-t border-gray-200 pt-5">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div>
            <label class="mb-2 block text-sm font-medium text-gray-700">
              查詢日期
            </label>
            <input
              v-model="filters.date"
              data-testid="slot-filter-date"
              type="date"
              class="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              @change="loadSlots"
            />
          </div>
        </div>

        <div class="mt-4 overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 text-sm">
            <thead class="bg-gray-50 text-left text-xs uppercase text-gray-500">
              <tr>
                <th class="px-3 py-2">服務</th>
                <th class="px-3 py-2">日期</th>
                <th class="px-3 py-2">時段</th>
                <th class="px-3 py-2">容量</th>
                <th class="px-3 py-2">已預約</th>
                <th class="px-3 py-2">狀態</th>
                <th class="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-gray-100 bg-white">
              <tr v-if="slots.length === 0">
                <td colspan="7" class="px-3 py-6 text-center text-gray-500">
                  尚無時段容量。
                </td>
              </tr>
              <tr
                v-for="slot in slots"
                :key="slot.id"
                data-testid="service-booking-slot-row"
              >
                <td class="px-3 py-2 font-medium text-gray-900">
                  {{ serviceName(slot.serviceItemId) }}
                </td>
                <td class="px-3 py-2 text-gray-600">{{ slot.date }}</td>
                <td class="px-3 py-2 text-gray-600">{{ slot.timeSlot }}</td>
                <td class="px-3 py-2 text-gray-600">
                  {{ slot.maxCapacity }}
                </td>
                <td class="px-3 py-2 text-gray-600">
                  {{ slot.currentBookings }}
                </td>
                <td class="px-3 py-2">
                  <span
                    class="rounded-full px-2 py-1 text-xs font-medium"
                    :class="
                      slot.isAvailable
                        ? 'bg-green-50 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    "
                  >
                    {{ slot.isAvailable ? "開放" : "封鎖" }}
                  </span>
                </td>
                <td class="px-3 py-2 text-right">
                  <button
                    type="button"
                    :data-testid="`slot-block-${slot.id}`"
                    class="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    :disabled="isSaving || !slot.isAvailable"
                    @click="blockSlot(slot)"
                  >
                    封鎖
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import type { RestaurantServiceItem } from "@makanmasak/shared-types";
import { restaurantServiceItemsService } from "@/services/restaurantServiceItemsService";
import {
  serviceBookingsService,
  type ServiceBookingSlot,
} from "@/services/serviceBookingsService";

const props = defineProps<{
  restaurantId?: string | null;
}>();

const services = ref<RestaurantServiceItem[]>([]);
const slots = ref<ServiceBookingSlot[]>([]);
const isLoading = ref(false);
const isSaving = ref(false);
const errorMessage = ref("");
const successMessage = ref("");

const today = new Date().toISOString().slice(0, 10);

const form = reactive({
  serviceItemId: 0,
  date: today,
  timeSlot: "10:00",
  maxCapacity: 1,
  isAvailable: true,
});

const batch = reactive({
  startDate: today,
  endDate: today,
  timeSlotsText: "10:00, 11:00, 14:00",
});

const filters = reactive({
  date: today,
});

const bookableServices = computed(() =>
  services.value.filter((service) => service.requiresBooking),
);

const canSubmitSingle = computed(
  () =>
    Boolean(props.restaurantId) &&
    form.serviceItemId > 0 &&
    Boolean(form.date) &&
    Boolean(form.timeSlot) &&
    form.maxCapacity > 0,
);

const batchTimeSlots = computed(() =>
  batch.timeSlotsText
    .split(",")
    .map((slot) => slot.trim())
    .filter(Boolean),
);

const canSubmitBatch = computed(
  () =>
    canSubmitSingle.value &&
    Boolean(batch.startDate) &&
    Boolean(batch.endDate) &&
    batchTimeSlots.value.length > 0,
);

watch(
  () => props.restaurantId,
  () => {
    void loadData();
  },
);

onMounted(() => {
  void loadData();
});

async function loadData() {
  if (!props.restaurantId) return;
  isLoading.value = true;
  errorMessage.value = "";
  try {
    services.value = await restaurantServiceItemsService.list(
      props.restaurantId,
    );
    if (!form.serviceItemId && bookableServices.value[0]) {
      form.serviceItemId = bookableServices.value[0].id;
    }
    await loadSlots();
  } catch (error) {
    console.error("Load service booking slots failed:", error);
    errorMessage.value = "載入服務預約容量失敗。";
  } finally {
    isLoading.value = false;
  }
}

async function loadSlots() {
  if (!props.restaurantId) return;
  slots.value = await serviceBookingsService.listSlots({
    restaurantId: props.restaurantId,
    date: filters.date || undefined,
  });
}

async function createSlot() {
  if (!props.restaurantId || !canSubmitSingle.value) return;
  await runSaving(async () => {
    const slot = await serviceBookingsService.createSlot({
      restaurantId: props.restaurantId as string,
      serviceItemId: form.serviceItemId,
      date: form.date,
      timeSlot: form.timeSlot,
      maxCapacity: form.maxCapacity,
      isAvailable: form.isAvailable,
    });
    filters.date = slot.date;
    successMessage.value = "時段容量已儲存。";
    await loadSlots();
  });
}

async function batchCreateSlots() {
  if (!props.restaurantId || !canSubmitBatch.value) return;
  await runSaving(async () => {
    const result = await serviceBookingsService.batchCreateSlots({
      restaurantId: props.restaurantId as string,
      serviceItemId: form.serviceItemId,
      startDate: batch.startDate,
      endDate: batch.endDate,
      timeSlots: batchTimeSlots.value,
      maxCapacity: form.maxCapacity,
      isAvailable: form.isAvailable,
    });
    filters.date = batch.startDate;
    successMessage.value = `已建立 ${result.created} 個時段。`;
    await loadSlots();
  });
}

async function blockSlot(slot: ServiceBookingSlot) {
  if (!props.restaurantId) return;
  await runSaving(async () => {
    await serviceBookingsService.blockSlot({
      restaurantId: props.restaurantId as string,
      serviceItemId: slot.serviceItemId,
      date: slot.date,
      timeSlot: slot.timeSlot,
      blockReason: "Admin blocked",
    });
    successMessage.value = "時段已封鎖。";
    await loadSlots();
  });
}

async function runSaving(action: () => Promise<void>) {
  isSaving.value = true;
  errorMessage.value = "";
  successMessage.value = "";
  try {
    await action();
  } catch (error) {
    console.error("Save service booking slot failed:", error);
    errorMessage.value = "儲存服務預約容量失敗。";
  } finally {
    isSaving.value = false;
  }
}

function serviceName(serviceItemId: number): string {
  return (
    services.value.find((service) => service.id === serviceItemId)?.name ??
    `服務 #${serviceItemId}`
  );
}
</script>
