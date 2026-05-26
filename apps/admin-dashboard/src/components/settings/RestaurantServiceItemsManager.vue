<template>
  <section class="rounded-lg bg-white p-6 shadow" data-testid="service-manager">
    <div
      class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"
    >
      <div>
        <h3 class="text-lg font-semibold text-gray-900">店家服務項目</h3>
        <p class="mt-1 text-sm text-gray-500">
          維護會顯示在店鋪菜單與夜市/商圈搜尋裡的預約、外送、租借或現場服務。
        </p>
      </div>
      <button
        type="button"
        class="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        @click="resetForm"
      >
        新增服務
      </button>
    </div>

    <div
      v-if="!restaurantId"
      class="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
    >
      請先選擇要管理的店家。
    </div>

    <template v-else>
      <form class="mt-5 space-y-4" @submit.prevent="saveService">
        <div class="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div class="md:col-span-2">
            <label class="mb-2 block text-sm font-medium text-gray-700">
              服務名稱
            </label>
            <input
              v-model="form.name"
              data-testid="service-name-input"
              type="text"
              required
              maxlength="100"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              placeholder="例：代客切水果"
            />
          </div>
          <div>
            <label class="mb-2 block text-sm font-medium text-gray-700">
              類型
            </label>
            <select
              v-model="form.serviceType"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            >
              <option value="general">一般服務</option>
              <option value="booking">預約</option>
              <option value="pickup">自取</option>
              <option value="delivery">外送</option>
              <option value="consultation">諮詢</option>
              <option value="rental">租借</option>
              <option value="activity">活動</option>
            </select>
          </div>
          <div>
            <label class="mb-2 block text-sm font-medium text-gray-700">
              排序
            </label>
            <input
              v-model.number="form.sortOrder"
              type="number"
              min="0"
              max="1000"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div class="md:col-span-4">
            <label class="mb-2 block text-sm font-medium text-gray-700">
              說明
            </label>
            <textarea
              v-model="form.description"
              data-testid="service-description-input"
              rows="2"
              maxlength="1000"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              placeholder="說明服務內容、條件或使用方式"
            />
          </div>
          <div>
            <label class="mb-2 block text-sm font-medium text-gray-700">
              價格（分）
            </label>
            <input
              v-model.number="form.priceCents"
              type="number"
              min="0"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div>
            <label class="mb-2 block text-sm font-medium text-gray-700">
              價格文字
            </label>
            <input
              v-model="form.priceLabel"
              data-testid="service-price-label-input"
              type="text"
              maxlength="80"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              placeholder="例：依距離報價"
            />
          </div>
          <div>
            <label class="mb-2 block text-sm font-medium text-gray-700">
              預估分鐘
            </label>
            <input
              v-model.number="form.durationMinutes"
              type="number"
              min="1"
              max="1440"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div>
            <label class="mb-2 block text-sm font-medium text-gray-700">
              標籤
            </label>
            <input
              v-model="tagsText"
              type="text"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              placeholder="水果, 分裝"
            />
          </div>
          <div class="md:col-span-4">
            <label class="mb-2 block text-sm font-medium text-gray-700">
              預約連結
            </label>
            <input
              v-model="form.bookingUrl"
              type="url"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              placeholder="https://..."
            />
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-4">
          <label class="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              v-model="form.requiresBooking"
              type="checkbox"
              class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            需預約
          </label>
          <label class="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              v-model="form.isPublic"
              type="checkbox"
              class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            公開顯示
          </label>
          <label class="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              v-model="form.isActive"
              type="checkbox"
              class="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            啟用
          </label>
        </div>

        <div class="flex items-center justify-end gap-2">
          <button
            v-if="editingServiceId"
            type="button"
            class="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
            @click="resetForm"
          >
            取消編輯
          </button>
          <button
            type="submit"
            class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            :disabled="isSaving || !form.name.trim()"
          >
            {{ editingServiceId ? "更新服務" : "新增服務" }}
          </button>
        </div>
      </form>

      <div
        v-if="error"
        class="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
      >
        {{ error }}
      </div>

      <div v-if="isLoading" class="mt-6 text-sm text-gray-500">
        載入服務中...
      </div>
      <div
        v-else-if="services.length === 0"
        class="mt-6 rounded-lg border border-dashed border-gray-300 p-5 text-sm text-gray-500"
      >
        尚未建立服務項目。
      </div>
      <div
        v-else
        class="mt-6 divide-y divide-gray-100 rounded-lg border border-gray-200"
      >
        <div
          v-for="service in services"
          :key="service.id"
          class="flex flex-col gap-3 p-4 md:flex-row md:items-start md:justify-between"
        >
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <h4 class="font-medium text-gray-900">{{ service.name }}</h4>
              <span
                class="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
              >
                {{ serviceTypeLabel(service.serviceType) }}
              </span>
              <span
                class="rounded px-2 py-0.5 text-xs"
                :class="
                  service.isPublic
                    ? 'bg-green-50 text-green-700'
                    : 'bg-gray-100 text-gray-500'
                "
              >
                {{ service.isPublic ? "公開" : "未公開" }}
              </span>
              <span
                class="rounded px-2 py-0.5 text-xs"
                :class="
                  service.isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-red-50 text-red-700'
                "
              >
                {{ service.isActive ? "啟用" : "停用" }}
              </span>
            </div>
            <p v-if="service.description" class="mt-1 text-sm text-gray-500">
              {{ service.description }}
            </p>
            <p class="mt-2 text-sm text-gray-700">
              {{ servicePriceLabel(service) || "未設定價格" }}
            </p>
          </div>
          <div class="flex shrink-0 gap-2">
            <button
              type="button"
              :data-testid="`edit-service-${service.id}`"
              class="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              @click="editService(service)"
            >
              編輯
            </button>
            <button
              type="button"
              :data-testid="`delete-service-${service.id}`"
              class="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
              @click="deleteService(service.id)"
            >
              刪除
            </button>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, watch } from "vue";
import type {
  RestaurantServiceItem,
  RestaurantServiceType,
} from "@makanmakan/shared-types";
import { restaurantServiceItemsService } from "@/services/restaurantServiceItemsService";

const props = defineProps<{
  restaurantId?: string | null;
}>();

const services = ref<RestaurantServiceItem[]>([]);
const isLoading = ref(false);
const isSaving = ref(false);
const error = ref<string | null>(null);
const editingServiceId = ref<number | null>(null);
const tagsText = ref("");

const defaultForm = () => ({
  name: "",
  description: "",
  serviceType: "general" as RestaurantServiceType,
  priceCents: undefined as number | undefined,
  priceLabel: "",
  durationMinutes: undefined as number | undefined,
  requiresBooking: false,
  bookingUrl: "",
  sortOrder: 0,
  isActive: true,
  isPublic: true,
});

const form = reactive(defaultForm());

async function loadServices() {
  if (!props.restaurantId) return;

  isLoading.value = true;
  error.value = null;
  try {
    services.value = await restaurantServiceItemsService.list(
      props.restaurantId,
    );
  } catch (loadError) {
    error.value =
      loadError instanceof Error ? loadError.message : "載入服務項目失敗";
  } finally {
    isLoading.value = false;
  }
}

function resetForm() {
  Object.assign(form, defaultForm());
  tagsText.value = "";
  editingServiceId.value = null;
}

function servicePayload() {
  const tags = tagsText.value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);

  return {
    name: form.name.trim(),
    description: form.description.trim() || null,
    serviceType: form.serviceType,
    priceCents:
      typeof form.priceCents === "number" ? form.priceCents : undefined,
    priceLabel: form.priceLabel.trim() || null,
    durationMinutes:
      typeof form.durationMinutes === "number"
        ? form.durationMinutes
        : undefined,
    requiresBooking: form.requiresBooking,
    bookingUrl: form.bookingUrl.trim() || null,
    tags,
    keywords: tags.join(" ") || undefined,
    sortOrder: form.sortOrder,
    isActive: form.isActive,
    isPublic: form.isPublic,
  };
}

async function saveService() {
  if (!props.restaurantId || !form.name.trim()) return;

  isSaving.value = true;
  error.value = null;
  try {
    if (editingServiceId.value) {
      await restaurantServiceItemsService.update(
        props.restaurantId,
        editingServiceId.value,
        servicePayload(),
      );
    } else {
      await restaurantServiceItemsService.create(
        props.restaurantId,
        servicePayload(),
      );
    }
    resetForm();
    await loadServices();
  } catch (saveError) {
    error.value =
      saveError instanceof Error ? saveError.message : "儲存服務項目失敗";
  } finally {
    isSaving.value = false;
  }
}

function editService(service: RestaurantServiceItem) {
  editingServiceId.value = service.id;
  form.name = service.name;
  form.description = service.description ?? "";
  form.serviceType = service.serviceType;
  form.priceCents = service.priceCents;
  form.priceLabel = service.priceLabel ?? "";
  form.durationMinutes = service.durationMinutes;
  form.requiresBooking = service.requiresBooking;
  form.bookingUrl = service.bookingUrl ?? "";
  form.sortOrder = service.sortOrder;
  form.isActive = service.isActive;
  form.isPublic = service.isPublic;
  tagsText.value = service.tags?.join(", ") ?? "";
}

async function deleteService(serviceId: number) {
  if (!props.restaurantId) return;

  error.value = null;
  try {
    await restaurantServiceItemsService.remove(props.restaurantId, serviceId);
    services.value = services.value.filter(
      (service) => service.id !== serviceId,
    );
    if (editingServiceId.value === serviceId) resetForm();
  } catch (deleteError) {
    error.value =
      deleteError instanceof Error ? deleteError.message : "刪除服務項目失敗";
  }
}

function serviceTypeLabel(type: RestaurantServiceType) {
  const labels: Record<RestaurantServiceType, string> = {
    general: "一般服務",
    booking: "預約",
    pickup: "自取",
    delivery: "外送",
    consultation: "諮詢",
    rental: "租借",
    activity: "活動",
  };
  return labels[type];
}

function servicePriceLabel(service: RestaurantServiceItem) {
  if (service.priceLabel) return service.priceLabel;
  if (typeof service.priceCents === "number") {
    return `NT$${Math.round(service.priceCents / 100)}`;
  }
  return "";
}

onMounted(loadServices);

watch(
  () => props.restaurantId,
  () => {
    resetForm();
    loadServices();
  },
);
</script>
