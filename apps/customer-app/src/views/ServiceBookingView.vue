<template>
  <div class="min-h-screen bg-ios-bg">
    <nav class="sticky top-0 z-10 border-b border-gray-100 bg-white shadow-sm">
      <div class="mx-auto flex max-w-md items-center gap-3 px-4 py-3">
        <button
          type="button"
          class="text-gray-500 hover:text-gray-700"
          aria-label="返回服務"
          @click="goBack"
        >
          <svg
            class="h-6 w-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <div class="min-w-0">
          <h1 class="truncate text-lg font-semibold text-gray-900">服務預約</h1>
          <p class="truncate text-xs text-gray-500">
            {{ serviceItem?.name || "載入中" }}
          </p>
        </div>
      </div>
    </nav>

    <main class="mx-auto max-w-md px-4 py-5">
      <div
        v-if="isLoadingService"
        class="py-12 text-center text-sm text-gray-500"
      >
        載入服務中...
      </div>

      <section
        v-else-if="loadError"
        class="rounded-xl border border-red-100 bg-white p-4 text-sm text-red-700"
      >
        {{ loadError }}
      </section>

      <template v-else-if="serviceItem">
        <section
          class="rounded-xl border border-gray-200 bg-white p-4"
          data-testid="service-booking-service-summary"
        >
          <p class="text-xs font-medium uppercase tracking-wide text-gray-500">
            {{ serviceTypeLabel(serviceItem.serviceType) }}
          </p>
          <h2 class="mt-1 text-xl font-semibold text-gray-900">
            {{ serviceItem.name }}
          </h2>
          <p
            v-if="serviceItem.description"
            class="mt-2 text-sm leading-6 text-gray-600"
          >
            {{ serviceItem.description }}
          </p>
          <div class="mt-3 flex flex-wrap gap-2 text-sm">
            <span class="font-semibold text-gray-900">
              {{ servicePriceLabel }}
            </span>
            <span v-if="serviceItem.durationMinutes" class="text-gray-500">
              約 {{ serviceItem.durationMinutes }} 分鐘
            </span>
          </div>
        </section>

        <section class="mt-4 rounded-xl border border-gray-200 bg-white p-4">
          <div class="flex items-end gap-3">
            <div class="flex-1">
              <label class="mb-2 block text-sm font-medium text-gray-700">
                預約日期
              </label>
              <input
                v-model="bookingDate"
                data-testid="service-booking-date"
                type="date"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ios-blue focus:ring-2 focus:ring-blue-500/20"
                @change="loadAvailability"
              />
            </div>
            <button
              type="button"
              data-testid="service-booking-load-slots"
              class="rounded-lg border border-ios-blue px-3 py-2 text-sm font-semibold text-ios-blue disabled:opacity-50"
              :disabled="isLoadingSlots"
              @click="loadAvailability"
            >
              查時段
            </button>
          </div>

          <div class="mt-4 grid grid-cols-2 gap-2">
            <button
              v-for="slot in slots"
              :key="slot.timeSlot"
              type="button"
              data-testid="service-booking-slot"
              class="rounded-lg border px-3 py-2 text-sm font-medium"
              :class="
                selectedTime === slot.timeSlot
                  ? 'border-ios-blue bg-blue-50 text-ios-blue'
                  : slot.isAvailable
                    ? 'border-gray-200 text-gray-700'
                    : 'border-gray-100 bg-gray-50 text-gray-400'
              "
              :disabled="!slot.isAvailable"
              @click="selectedTime = slot.timeSlot"
            >
              <span>{{ slot.timeSlot }}</span>
              <span class="ml-1 text-xs">
                {{
                  slot.remaining === null ? "可預約" : `剩 ${slot.remaining}`
                }}
              </span>
            </button>
          </div>
          <p
            v-if="slots.length === 0 && !isLoadingSlots"
            data-testid="service-booking-empty-slots"
            class="mt-3 text-sm text-gray-500"
          >
            目前沒有可顯示的時段，請選擇其他日期。
          </p>
        </section>

        <form
          class="mt-4 space-y-3 rounded-xl border border-gray-200 bg-white p-4"
          @submit.prevent="createBooking"
        >
          <div>
            <label class="mb-2 block text-sm font-medium text-gray-700">
              姓名
            </label>
            <input
              v-model="form.customerName"
              data-testid="service-booking-name"
              type="text"
              required
              maxlength="100"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ios-blue focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div>
            <label class="mb-2 block text-sm font-medium text-gray-700">
              電話
            </label>
            <input
              v-model="form.customerPhone"
              data-testid="service-booking-phone"
              type="tel"
              required
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ios-blue focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div>
            <label class="mb-2 block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              v-model="form.customerEmail"
              data-testid="service-booking-email"
              type="email"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ios-blue focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="mb-2 block text-sm font-medium text-gray-700">
                人數
              </label>
              <input
                v-model.number="form.partySize"
                data-testid="service-booking-party-size"
                type="number"
                min="1"
                max="100"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ios-blue focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <label class="mb-2 block text-sm font-medium text-gray-700">
                卷碼
              </label>
              <input
                v-model="form.voucherCode"
                data-testid="service-booking-voucher"
                type="text"
                maxlength="64"
                class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ios-blue focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>
          <div>
            <label class="mb-2 block text-sm font-medium text-gray-700">
              備註
            </label>
            <textarea
              v-model="form.specialRequests"
              data-testid="service-booking-requests"
              rows="2"
              maxlength="500"
              class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-ios-blue focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <button
            type="submit"
            data-testid="service-booking-create"
            class="w-full rounded-lg bg-ios-blue px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            :disabled="isCreating || !selectedTime"
          >
            建立預約
          </button>
        </form>

        <section
          v-if="booking"
          class="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4"
          data-testid="service-booking-confirmation"
        >
          <h2 class="text-base font-semibold text-emerald-900">預約已建立</h2>
          <p class="mt-1 text-sm text-emerald-800">
            確認碼：
            <span class="font-mono font-semibold">{{
              booking.confirmationCode
            }}</span>
          </p>
          <dl class="mt-3 grid grid-cols-2 gap-2 text-sm text-emerald-900">
            <div>
              <dt>應付</dt>
              <dd class="font-semibold">
                {{ formatCents(booking.amountDueCents) }}
              </dd>
            </div>
            <div>
              <dt>狀態</dt>
              <dd class="font-semibold">{{ statusLabel(booking.status) }}</dd>
            </div>
          </dl>
          <div class="mt-4 space-y-2">
            <input
              v-model="creditCardPublicId"
              data-testid="service-booking-credit-id"
              type="text"
              class="w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm"
              placeholder="代幣卡 public id"
            />
            <input
              v-model="creditPin"
              data-testid="service-booking-credit-pin"
              type="password"
              class="w-full rounded-lg border border-emerald-200 px-3 py-2 text-sm"
              placeholder="PIN（可選）"
            />
            <button
              type="button"
              data-testid="service-booking-pay"
              class="w-full rounded-lg bg-emerald-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
              :disabled="isPaying || !creditCardPublicId.trim()"
              @click="payBooking"
            >
              代幣付款
            </button>
          </div>
        </section>

        <section class="mt-4 rounded-xl border border-gray-200 bg-white p-4">
          <h2 class="text-base font-semibold text-gray-900">查詢/取消預約</h2>
          <div class="mt-3 flex gap-2">
            <input
              v-model="verifyCode"
              data-testid="service-booking-verify-code"
              type="text"
              class="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="輸入確認碼"
            />
            <button
              type="button"
              data-testid="service-booking-verify"
              class="rounded-lg border border-ios-blue px-3 py-2 text-sm font-semibold text-ios-blue"
              @click="verifyBooking"
            >
              查詢
            </button>
          </div>
          <div
            v-if="verifiedBooking"
            data-testid="service-booking-verified"
            class="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700"
          >
            {{ verifiedBooking.serviceNameSnapshot }} ·
            {{ verifiedBooking.bookingDate }}
            {{ verifiedBooking.bookingTime }} ·
            {{ statusLabel(verifiedBooking.status) }}
            <button
              v-if="
                verifiedBooking.status === 'pending' ||
                verifiedBooking.status === 'confirmed'
              "
              type="button"
              data-testid="service-booking-cancel"
              class="mt-2 block rounded-lg border border-red-300 px-3 py-2 text-sm font-semibold text-red-600"
              @click="cancelVerifiedBooking"
            >
              取消預約
            </button>
          </div>
        </section>

        <p v-if="errorMessage" class="mt-3 text-sm text-red-600">
          {{ errorMessage }}
        </p>
        <p v-if="successMessage" class="mt-3 text-sm text-emerald-700">
          {{ successMessage }}
        </p>
      </template>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from "vue";
import { useRouter } from "vue-router";
import type { RestaurantServiceItem } from "@makanmakan/shared-types";
import { restaurantContactApi } from "@/services/restaurantContactApi";
import {
  serviceBookingsApi,
  type ServiceBooking,
  type ServiceBookingAvailabilitySlot,
  type ServiceBookingStatus,
} from "@/services/serviceBookingsApi";

const props = defineProps<{
  restaurantId: string;
  serviceItemId: number;
}>();

const router = useRouter();
const today = new Date().toISOString().slice(0, 10);

const serviceItem = ref<RestaurantServiceItem | null>(null);
const slots = ref<ServiceBookingAvailabilitySlot[]>([]);
const booking = ref<ServiceBooking | null>(null);
const verifiedBooking = ref<ServiceBooking | null>(null);
const isLoadingService = ref(true);
const isLoadingSlots = ref(false);
const isCreating = ref(false);
const isPaying = ref(false);
const loadError = ref("");
const errorMessage = ref("");
const successMessage = ref("");
const bookingDate = ref(today);
const selectedTime = ref("");
const creditCardPublicId = ref("");
const creditPin = ref("");
const verifyCode = ref("");

const form = reactive({
  customerName: "",
  customerPhone: "",
  customerEmail: "",
  partySize: 1,
  voucherCode: "",
  specialRequests: "",
});

const servicePriceLabel = computed(() => {
  if (!serviceItem.value) return "";
  if (serviceItem.value.priceLabel) return serviceItem.value.priceLabel;
  if (serviceItem.value.priceCents != null) {
    return formatCents(serviceItem.value.priceCents);
  }
  return "依店家現場報價";
});

onMounted(async () => {
  await loadService();
  await loadAvailability();
});

async function loadService() {
  isLoadingService.value = true;
  loadError.value = "";
  try {
    const services = await restaurantContactApi.listServiceItems(
      props.restaurantId,
    );
    serviceItem.value =
      services.find((service) => service.id === props.serviceItemId) ?? null;
    if (!serviceItem.value) {
      loadError.value = "找不到此服務。";
    } else if (!serviceItem.value.requiresBooking) {
      loadError.value = "此服務目前不接受站內預約。";
    }
  } catch (error) {
    console.error("Load service item failed:", error);
    loadError.value = "載入服務失敗。";
  } finally {
    isLoadingService.value = false;
  }
}

async function loadAvailability() {
  if (!serviceItem.value || !bookingDate.value) return;
  isLoadingSlots.value = true;
  errorMessage.value = "";
  selectedTime.value = "";
  try {
    slots.value = await serviceBookingsApi.getAvailability({
      serviceItemId: props.serviceItemId,
      date: bookingDate.value,
    });
    selectedTime.value =
      slots.value.find((slot) => slot.isAvailable)?.timeSlot ?? "";
  } catch (error) {
    console.error("Load service booking availability failed:", error);
    errorMessage.value = "查詢可預約時段失敗。";
  } finally {
    isLoadingSlots.value = false;
  }
}

async function createBooking() {
  if (!serviceItem.value || !selectedTime.value) return;
  isCreating.value = true;
  errorMessage.value = "";
  successMessage.value = "";
  try {
    booking.value = await serviceBookingsApi.createBooking({
      restaurantId: props.restaurantId,
      serviceItemId: props.serviceItemId,
      customerName: form.customerName.trim(),
      customerPhone: form.customerPhone.trim(),
      customerEmail: form.customerEmail.trim() || undefined,
      bookingDate: bookingDate.value,
      bookingTime: selectedTime.value,
      partySize: form.partySize,
      specialRequests: form.specialRequests.trim() || undefined,
      voucherCode: form.voucherCode.trim() || undefined,
    });
    verifyCode.value = booking.value.confirmationCode;
    successMessage.value = "預約已建立，請保留確認碼。";
    await loadAvailability();
  } catch (error) {
    console.error("Create service booking failed:", error);
    errorMessage.value =
      error instanceof Error ? error.message : "建立預約失敗，請稍後再試。";
  } finally {
    isCreating.value = false;
  }
}

async function payBooking() {
  if (!booking.value) return;
  isPaying.value = true;
  errorMessage.value = "";
  successMessage.value = "";
  try {
    booking.value = await serviceBookingsApi.payWithCredits({
      bookingId: booking.value.id,
      creditCardPublicId: creditCardPublicId.value.trim(),
      pin: creditPin.value.trim() || undefined,
    });
    verifiedBooking.value = booking.value;
    successMessage.value = "代幣付款完成，預約已確認。";
  } catch (error) {
    console.error("Pay service booking failed:", error);
    errorMessage.value =
      error instanceof Error ? error.message : "代幣付款失敗，請稍後再試。";
  } finally {
    isPaying.value = false;
  }
}

async function verifyBooking() {
  if (!verifyCode.value.trim()) return;
  errorMessage.value = "";
  successMessage.value = "";
  try {
    verifiedBooking.value = await serviceBookingsApi.verify(
      verifyCode.value.trim(),
    );
  } catch (error) {
    console.error("Verify service booking failed:", error);
    errorMessage.value =
      error instanceof Error ? error.message : "查詢預約失敗。";
  }
}

async function cancelVerifiedBooking() {
  if (!verifyCode.value.trim()) return;
  errorMessage.value = "";
  successMessage.value = "";
  try {
    verifiedBooking.value = await serviceBookingsApi.cancelByCode(
      verifyCode.value.trim(),
    );
    if (
      booking.value?.confirmationCode === verifiedBooking.value.confirmationCode
    ) {
      booking.value = verifiedBooking.value;
    }
    successMessage.value = "預約已取消。";
    await loadAvailability();
  } catch (error) {
    console.error("Cancel service booking failed:", error);
    errorMessage.value =
      error instanceof Error ? error.message : "取消預約失敗。";
  }
}

function goBack() {
  router.push({
    name: "ShopMenu",
    params: { restaurantId: props.restaurantId },
    query: { services: "true" },
  });
}

function formatCents(cents: number): string {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function statusLabel(status: ServiceBookingStatus): string {
  const labels: Record<ServiceBookingStatus, string> = {
    pending: "待付款",
    confirmed: "已確認",
    completed: "已完成",
    cancelled: "已取消",
    no_show: "未到",
  };
  return labels[status];
}

function serviceTypeLabel(type: RestaurantServiceItem["serviceType"]): string {
  const labels: Record<RestaurantServiceItem["serviceType"], string> = {
    general: "一般服務",
    booking: "預約",
    pickup: "自取",
    delivery: "外送",
    consultation: "諮詢",
    rental: "租借",
    activity: "活動",
  };
  return labels[type] ?? type;
}
</script>
