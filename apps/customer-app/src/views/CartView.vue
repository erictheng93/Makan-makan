<template>
  <div class="min-h-screen bg-gray-50">
    <!-- 頂部導航 -->
    <nav class="sticky top-0 z-40 bg-white shadow-sm border-b border-gray-200">
      <div class="max-w-md mx-auto px-4 py-4">
        <div class="flex items-center justify-between">
          <button
            class="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-gray-900 transition-colors"
            @click="router.back()"
          >
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
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>

          <div class="flex-1 text-center">
            <h1 class="text-lg font-semibold text-gray-900">
              {{ t("cart.title") }}
            </h1>
            <p class="text-sm text-gray-500">
              {{ restaurant?.name }} · {{ t("order.details.table") }}
              {{ tableId }}
            </p>
          </div>

          <div class="w-8 h-8" />
          <!-- 占位符保持居中 -->
        </div>
      </div>
    </nav>

    <!-- 主要內容 -->
    <main class="max-w-md mx-auto">
      <!-- 空購物車狀態 -->
      <div v-if="cartStore.isEmpty" class="px-4 py-16 text-center">
        <div
          class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6"
        >
          <svg
            class="w-10 h-10 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M3 3h2l.4 2M7 13h10l4-8H5.4m2.6 8L6 2H3m4 11a3 3 0 100 6 3 3 0 000-6zm10 0a3 3 0 100 6 3 3 0 000-6z"
            />
          </svg>
        </div>
        <h2 class="text-xl font-semibold text-gray-900 mb-2">
          {{ t("cart.empty") }}
        </h2>
        <p class="text-gray-600 mb-8">
          {{ t("cart.emptyDesc") }}
        </p>
        <button
          class="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
          @click="router.push(`/restaurant/${restaurantId}/table/${tableId}`)"
        >
          {{ t("cart.goToMenu") }}
        </button>
      </div>

      <!-- 購物車項目 -->
      <div v-else class="px-4 py-6 space-y-6">
        <!-- 餐點列表 -->
        <div class="space-y-4">
          <CartItemCard
            v-for="item in cartStore.items"
            :key="item.id"
            :item="item"
            @update-quantity="handleUpdateQuantity"
            @update-notes="handleUpdateNotes"
            @remove="handleRemoveItem"
          />
        </div>

        <!-- 訂單摘要 -->
        <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">
            {{ t("order.title") }}
          </h3>

          <div class="space-y-3">
            <!-- 小計 -->
            <div class="flex justify-between text-gray-600">
              <span>{{ t("cart.subtotal") }}</span>
              <span>${{ formatPrice(cartStore.subtotal) }}</span>
            </div>

            <!-- 服務費 -->
            <div
              v-if="serviceCharge > 0"
              class="flex justify-between text-gray-600"
            >
              <span>{{ t("cart.serviceCharge") }}</span>
              <span>${{ formatPrice(serviceCharge) }}</span>
            </div>

            <!-- 稅費 -->
            <div v-if="tax > 0" class="flex justify-between text-gray-600">
              <span>{{ t("cart.tax") }}</span>
              <span>${{ formatPrice(tax) }}</span>
            </div>

            <!-- 折扣 -->
            <div
              v-if="discount > 0"
              class="flex justify-between text-green-600"
            >
              <span>{{ t("cart.discount") }}</span>
              <span>-${{ formatPrice(discount) }}</span>
            </div>

            <!-- 分隔線 -->
            <hr class="border-gray-200" />

            <!-- 最低消費提醒 -->
            <div
              v-if="minimumOrderEnabled && minimumOrderAmount > 0"
              class="p-3 rounded-lg"
              :class="[
                isMinimumOrderMet
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-yellow-50 border border-yellow-200',
              ]"
            >
              <div class="flex items-center space-x-2">
                <svg
                  v-if="isMinimumOrderMet"
                  class="w-5 h-5 text-green-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <svg
                  v-else
                  class="w-5 h-5 text-yellow-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div class="flex-1">
                  <p
                    class="text-sm font-medium"
                    :class="[
                      isMinimumOrderMet ? 'text-green-800' : 'text-yellow-800',
                    ]"
                  >
                    最低消費：${{ formatPrice(minimumOrderAmount) }}
                  </p>
                  <p
                    v-if="!isMinimumOrderMet"
                    class="text-sm text-yellow-600 mt-1"
                  >
                    還需加點 ${{ formatPrice(minimumOrderShortfall) }} 才能下單
                  </p>
                  <p v-else class="text-sm text-green-600 mt-1">
                    已達到最低消費標準 ✓
                  </p>
                </div>
              </div>
            </div>

            <!-- 總計 -->
            <div
              class="flex justify-between text-lg font-semibold text-gray-900"
            >
              <span>{{ t("cart.total") }}</span>
              <span>${{ formatPrice(totalAmount) }}</span>
            </div>
          </div>
        </div>

        <!-- 優惠券區域 -->
        <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <!-- 區域標題 -->
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold text-gray-900">
              {{ t("cart.coupons") }}
            </h3>
            <button
              v-if="!showAvailableCoupons"
              class="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
              @click="toggleAvailableCoupons"
            >
              {{ t("cart.viewAvailable") }}
            </button>
          </div>

          <!-- 可用優惠券列表 -->
          <div v-if="showAvailableCoupons" class="mb-6">
            <div class="flex items-center justify-between mb-3">
              <h4 class="text-md font-medium text-gray-800">
                {{ t("cart.availableCoupons") }}
              </h4>
              <button
                class="text-sm text-gray-500 hover:text-gray-700"
                @click="toggleAvailableCoupons"
              >
                {{ t("common.close") }}
              </button>
            </div>

            <!-- 加載中 -->
            <div v-if="isLoadingCoupons" class="flex justify-center py-4">
              <div
                class="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"
              />
            </div>

            <!-- 無可用優惠券 -->
            <div
              v-else-if="!availableCoupons.length"
              class="text-center py-4 text-gray-500"
            >
              {{ t("cart.noCouponsAvailable") }}
            </div>

            <!-- 優惠券列表 -->
            <div v-else class="space-y-3 max-h-60 overflow-y-auto">
              <div
                v-for="coupon in availableCoupons"
                :key="coupon.id"
                class="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                :class="{
                  'ring-2 ring-indigo-500 bg-indigo-50':
                    selectedCoupon?.id === coupon.id,
                }"
                @click="selectCoupon(coupon)"
              >
                <div class="flex justify-between items-start">
                  <div class="flex-1">
                    <div class="flex items-center space-x-2">
                      <h5 class="font-semibold text-gray-900">
                        {{ coupon.name }}
                      </h5>
                      <span
                        class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium"
                        :class="getCouponTypeClass(coupon.discountType)"
                      >
                        {{ getCouponTypeText(coupon.discountType) }}
                      </span>
                    </div>
                    <p class="text-sm text-gray-600 mt-1">
                      {{ coupon.description }}
                    </p>

                    <!-- 折扣信息 -->
                    <div class="mt-2 flex items-center space-x-4 text-sm">
                      <span class="text-indigo-600 font-semibold">
                        {{ formatCouponDiscount(coupon) }}
                      </span>
                      <span v-if="coupon.minOrderAmount" class="text-gray-500">
                        {{ t("cart.minOrder") }}: ${{
                          formatPrice(coupon.minOrderAmount)
                        }}
                      </span>
                      <span
                        v-if="
                          coupon.maxDiscountAmount &&
                          coupon.discountType === 'percentage'
                        "
                        class="text-gray-500"
                      >
                        {{ t("cart.maxDiscount") }}: ${{
                          formatPrice(coupon.maxDiscountAmount)
                        }}
                      </span>
                    </div>

                    <!-- 有效期 -->
                    <div class="mt-2 text-xs text-gray-400">
                      {{ t("cart.validUntil") }}:
                      {{ formatCouponExpiry(coupon.validTo) }}
                    </div>
                  </div>

                  <!-- 選擇指示器 -->
                  <div class="ml-3">
                    <div
                      v-if="selectedCoupon?.id === coupon.id"
                      class="w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center"
                    >
                      <svg
                        class="w-3 h-3 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <div
                      v-else
                      class="w-5 h-5 border-2 border-gray-300 rounded-full"
                    />
                  </div>
                </div>
              </div>
            </div>

            <!-- 應用選擇的優惠券 -->
            <div
              v-if="selectedCoupon && !appliedCoupon"
              class="mt-4 pt-4 border-t border-gray-200"
            >
              <button
                class="w-full bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 font-medium"
                @click="applyCouponFromList"
              >
                {{ t("cart.applyCoupon") }} -
                {{ formatCouponDiscount(selectedCoupon) }}
              </button>
            </div>
          </div>

          <!-- 手動輸入優惠券 -->
          <div>
            <div class="flex items-center space-x-2 mb-3">
              <span class="text-sm font-medium text-gray-700">{{
                t("cart.orEnterCode")
              }}</span>
              <div class="flex-1 h-px bg-gray-200" />
            </div>

            <div class="flex space-x-3">
              <input
                id="coupon-code"
                v-model="couponCode"
                type="text"
                :placeholder="t('cart.couponPlaceholder')"
                :disabled="isValidatingCoupon"
                class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-50"
                @input="onCouponInput"
                @keyup.enter="validateCoupon"
              />
              <button
                :disabled="!couponCode.trim() || isValidatingCoupon"
                class="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 transition-colors"
                @click="validateCoupon"
              >
                <div
                  v-if="isValidatingCoupon"
                  class="animate-spin rounded-full h-4 w-4 border-b-2 border-white mx-1"
                />
                <span v-else>{{ t("cart.applyCoupon") }}</span>
              </button>
            </div>
          </div>

          <!-- 優惠券驗證狀態 -->
          <div v-if="couponValidationMessage" class="mt-3">
            <div
              v-if="couponValidationError"
              class="flex items-center text-sm text-red-600"
            >
              <svg
                class="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {{ couponValidationMessage }}
            </div>
            <div v-else class="flex items-center text-sm text-green-600">
              <svg
                class="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              {{ couponValidationMessage }}
            </div>
          </div>

          <!-- 已應用的優惠券 -->
          <div
            v-if="appliedCoupon"
            class="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg"
          >
            <div class="flex justify-between items-center">
              <div>
                <div class="flex items-center space-x-2">
                  <svg
                    class="w-5 h-5 text-green-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span class="text-sm font-medium text-green-800">{{
                    appliedCoupon.name || appliedCoupon.code
                  }}</span>
                </div>
                <p class="text-sm text-green-600 mt-1">
                  {{ t("cart.saving") }} ${{
                    formatPrice(couponDiscountAmount)
                  }}
                </p>
              </div>
              <button
                class="text-sm text-green-600 hover:text-green-800 font-medium"
                @click="clearCoupon"
              >
                {{ t("cart.removeCoupon") }}
              </button>
            </div>
          </div>
        </div>

        <!-- 智能推薦優惠券 -->
        <CouponRecommendation
          v-if="!appliedCoupon && availableCoupons.length > 0"
          :coupons="availableCoupons"
          :order-amount="cartStore.subtotal"
          @select-coupon="selectAndApplyCoupon"
        />

        <!-- 備註欄位 -->
        <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <label
            for="order-notes"
            class="block text-sm font-medium text-gray-700 mb-3"
          >
            {{ t("cart.notes") }} ({{ t("menuItem.optional") }})
          </label>
          <textarea
            id="order-notes"
            v-model="orderNotes"
            rows="3"
            :placeholder="t('menuItem.notesPlaceholder')"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
          />
        </div>

        <!-- 顧客資訊 -->
        <div class="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 class="text-lg font-semibold text-gray-900 mb-4">
            {{ t("order.details.customerInfo") }}
          </h3>

          <div class="space-y-4">
            <div>
              <label
                for="customer-name"
                class="block text-sm font-medium text-gray-700 mb-2"
              >
                {{ t("order.details.customerName") }} ({{
                  t("menuItem.optional")
                }})
              </label>
              <input
                id="customer-name"
                v-model="customerInfo.name"
                type="text"
                :placeholder="t('order.details.customerName')"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label
                for="customer-phone"
                class="block text-sm font-medium text-gray-700 mb-2"
              >
                {{ t("order.details.phone") }} ({{ t("menuItem.optional") }})
              </label>
              <input
                id="customer-phone"
                v-model="customerInfo.phone"
                type="tel"
                :placeholder="t('order.details.phone')"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
        </div>
      </div>
    </main>

    <!-- 底部確認按鈕 -->
    <div
      v-if="!cartStore.isEmpty"
      class="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4"
    >
      <div class="max-w-md mx-auto">
        <button
          :disabled="!canPlaceOrder"
          :class="[
            'w-full font-semibold py-4 px-6 rounded-2xl transition-colors flex items-center justify-center space-x-2',
            canPlaceOrder
              ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
              : 'bg-gray-400 text-white cursor-not-allowed',
          ]"
          @click="handleSubmitOrder"
        >
          <div
            v-if="isSubmitting"
            class="animate-spin rounded-full h-5 w-5 border-b-2 border-white"
          />
          <span v-if="isSubmitting">{{ t("order.placeOrder") }}...</span>
          <span v-else-if="!isMinimumOrderMet && minimumOrderEnabled"
            >還需加點 ${{ formatPrice(minimumOrderShortfall) }}</span
          >
          <span v-else
            >{{ t("order.placeOrder") }} · ${{ formatPrice(totalAmount) }}</span
          >
        </button>

        <!-- 最低消費提醒（按鈕下方） -->
        <div
          v-if="
            !isMinimumOrderMet && minimumOrderEnabled && minimumOrderAmount > 0
          "
          class="mt-2 text-center"
        >
          <p class="text-sm text-yellow-600">
            最低消費：${{ formatPrice(minimumOrderAmount) }}
          </p>
        </div>

        <div class="mt-3 text-center">
          <p class="text-sm text-gray-500">
            {{ t("common.confirm") }}
            <router-link
              to="/terms"
              class="text-indigo-600 hover:text-indigo-500"
            >
              {{ t("terms.title") }}
            </router-link>
            {{ t("common.next") }}
            <router-link
              to="/privacy"
              class="text-indigo-600 hover:text-indigo-500"
            >
              {{ t("privacy.title") }}
            </router-link>
          </p>
        </div>
      </div>
    </div>

    <!-- 訂單確認對話框 -->
    <ConfirmationModal
      :show="showConfirmation"
      :title="t('order.placeOrder')"
      :message="`您即將提交總額 $${formatPrice(totalAmount)} 的訂單，確定要繼續嗎？`"
      :confirm-text="t('common.confirm')"
      :cancel-text="t('common.cancel')"
      @confirm="submitOrder"
      @cancel="showConfirmation = false"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import { useQuery, useMutation } from "@tanstack/vue-query";
import { useToast } from "vue-toastification";
import { useI18n } from "@/composables/useI18n";
import { useCartStore } from "@/stores/cart";
import CartItemCard from "@/components/CartItemCard.vue";
import ConfirmationModal from "@/components/ConfirmationModal.vue";
import CouponRecommendation from "@/components/CouponRecommendation.vue";
import { orderApi } from "@/services/orderApi";
import menuApi from "@/services/menuApi";
import { formatPrice } from "@/utils/format";
import type { CreateOrderRequest } from "@makanmakan/shared-types";

// Props
const props = defineProps<{
  restaurantId: number;
  tableId: number;
}>();

// Composables
const router = useRouter();
const toast = useToast();
const { t } = useI18n();
const cartStore = useCartStore();

// State
const orderNotes = ref("");
const customerInfo = ref({
  name: "",
  phone: "",
});
const showConfirmation = ref(false);
const isSubmitting = ref(false);

// 優惠券相關狀態
const couponCode = ref("");
const appliedCoupon = ref<any>(null);
const isValidatingCoupon = ref(false);
const couponValidationMessage = ref("");
const couponValidationError = ref(false);
const couponDiscountAmount = ref(0);

// 可用優惠券列表相關狀態
const showAvailableCoupons = ref(false);
const isLoadingCoupons = ref(false);
const availableCoupons = ref<any[]>([]);
const selectedCoupon = ref<any>(null);

// 最低消費相關狀態
const minimumOrderAmount = ref(0);
const minimumOrderEnabled = ref(false);

// API Queries
const { data: restaurant } = useQuery({
  queryKey: ["restaurant", props.restaurantId],
  queryFn: () => menuApi.getRestaurant(props.restaurantId),
  staleTime: 5 * 60 * 1000,
});

// 獲取最低消費設定
const { data: minOrderData } = useQuery({
  queryKey: ["minimumOrder", props.restaurantId],
  queryFn: async () => {
    const response = await fetch(
      `/api/v1/orders/restaurant/${props.restaurantId}/minimum-order`,
    );
    if (!response.ok) throw new Error("Failed to fetch minimum order");
    const result = await response.json();
    return result.data;
  },
  staleTime: 10 * 60 * 1000, // 10分鐘快取
});

// 監聽最低消費數據更新
watch(
  minOrderData,
  (data) => {
    if (data) {
      minimumOrderAmount.value = data.minOrderAmount || 0;
      minimumOrderEnabled.value = data.enabled || false;
    }
  },
  { immediate: true },
);

// 提交訂單 Mutation
const { mutate: createOrder } = useMutation({
  mutationFn: (orderData: CreateOrderRequest) =>
    orderApi.createOrder(orderData),
  onSuccess: (order) => {
    toast.success("訂單提交成功！");
    cartStore.clearCart();
    router.push(
      `/restaurant/${props.restaurantId}/table/${props.tableId}/order/${order.id}`,
    );
  },
  onError: (error: any) => {
    toast.error(error?.message || "訂單提交失敗，請重試");
    isSubmitting.value = false;
  },
});

// 計算費用
const serviceChargeRate = 0.1; // 10% 服務費
const taxRate = 0.05; // 5% 稅率

const serviceCharge = computed(() => {
  return Math.round(cartStore.subtotal * serviceChargeRate);
});

const tax = computed(() => {
  return Math.round((cartStore.subtotal + serviceCharge.value) * taxRate);
});

const discount = computed(() => {
  return couponDiscountAmount.value;
});

const totalAmount = computed(() => {
  return cartStore.subtotal + serviceCharge.value + tax.value - discount.value;
});

// 最低消費驗證
const orderAmountAfterDiscount = computed(() => {
  return cartStore.subtotal - discount.value;
});

const isMinimumOrderMet = computed(() => {
  if (!minimumOrderEnabled.value || minimumOrderAmount.value <= 0) {
    return true;
  }
  return orderAmountAfterDiscount.value >= minimumOrderAmount.value;
});

const minimumOrderShortfall = computed(() => {
  if (isMinimumOrderMet.value) return 0;
  return minimumOrderAmount.value - orderAmountAfterDiscount.value;
});

const canPlaceOrder = computed(() => {
  return !cartStore.isEmpty && isMinimumOrderMet.value && !isSubmitting.value;
});

// 初始化購物車
onMounted(() => {
  cartStore.initializeCart(props.restaurantId, props.tableId);

  // 如果購物車為空，重定向到菜單頁面
  if (cartStore.isEmpty) {
    router.replace(`/restaurant/${props.restaurantId}/table/${props.tableId}`);
  }
});

// Methods
const handleUpdateQuantity = (itemId: string, quantity: number) => {
  cartStore.updateQuantity(itemId, quantity);
};

const handleUpdateNotes = (itemId: string, notes: string) => {
  cartStore.updateItemNotes(itemId, notes);
};

const handleRemoveItem = (itemId: string) => {
  const item = cartStore.getItemById(itemId);
  if (item) {
    cartStore.removeItem(itemId);
    toast.success(`已移除 ${item.menuItem.name}`);
  }
};

const handleSubmitOrder = () => {
  // 驗證必要資訊
  if (cartStore.isEmpty) {
    toast.warning("購物車不能為空");
    return;
  }

  // 顯示確認對話框
  showConfirmation.value = true;
};

// 優惠券相關方法
const onCouponInput = () => {
  // 清除之前的驗證狀態
  couponValidationMessage.value = "";
  couponValidationError.value = false;
};

// Client-side coupon code validation
const validateCouponCode = (
  code: string,
): { isValid: boolean; error?: string } => {
  if (!code || typeof code !== "string") {
    return { isValid: false, error: "請輸入優惠券代碼" };
  }

  const trimmedCode = code.trim();

  if (trimmedCode.length === 0) {
    return { isValid: false, error: "請輸入優惠券代碼" };
  }

  if (trimmedCode.length > 50) {
    return { isValid: false, error: "優惠券代碼不能超過50個字符" };
  }

  // Allow alphanumeric characters, hyphens, and underscores only
  if (!/^[A-Za-z0-9\-_]+$/.test(trimmedCode)) {
    return {
      isValid: false,
      error: "優惠券代碼只能包含字母、數字、連字符和下劃線",
    };
  }

  return { isValid: true };
};

const validateCoupon = async () => {
  if (!couponCode.value.trim()) return;

  // Client-side input validation
  const validation = validateCouponCode(couponCode.value);
  if (!validation.isValid) {
    couponValidationMessage.value = validation.error || "";
    couponValidationError.value = true;
    return;
  }

  isValidatingCoupon.value = true;
  couponValidationMessage.value = "";
  couponValidationError.value = false;

  try {
    // Sanitize input: trim whitespace and convert to uppercase
    const sanitizedCode = couponCode.value.trim().toUpperCase();

    const response = await fetch("/api/v1/coupons/validate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code: sanitizedCode,
        restaurantId: props.restaurantId.toString(),
        orderAmount: cartStore.subtotal,
        menuItems: cartStore.items.map((item) => ({
          menuItemId: item.menuItem.id,
          quantity: item.quantity,
        })),
      }),
    });

    const result = await response.json();

    if (result.success && result.data.valid) {
      // 驗證成功
      appliedCoupon.value = result.data.coupon;
      couponDiscountAmount.value = result.data.discountAmount || 0;
      couponValidationMessage.value = `優惠券已套用！節省 $${formatPrice(couponDiscountAmount.value)}`;
      couponValidationError.value = false;
    } else {
      // 驗證失敗
      appliedCoupon.value = null;
      couponDiscountAmount.value = 0;
      couponValidationMessage.value = result.data?.error || "優惠券驗證失敗";
      couponValidationError.value = true;
    }
  } catch (error) {
    console.error("Coupon validation error:", error);
    appliedCoupon.value = null;
    couponDiscountAmount.value = 0;
    couponValidationMessage.value = "驗證過程中發生錯誤，請稍後再試";
    couponValidationError.value = true;
  } finally {
    isValidatingCoupon.value = false;
  }
};

const clearCoupon = () => {
  couponCode.value = "";
  appliedCoupon.value = null;
  couponDiscountAmount.value = 0;
  couponValidationMessage.value = "";
  couponValidationError.value = false;
  selectedCoupon.value = null;
};

// 可用優惠券相關方法
const toggleAvailableCoupons = async () => {
  showAvailableCoupons.value = !showAvailableCoupons.value;
  if (showAvailableCoupons.value && availableCoupons.value.length === 0) {
    await loadAvailableCoupons();
  }
};

const loadAvailableCoupons = async () => {
  if (isLoadingCoupons.value) return;

  isLoadingCoupons.value = true;
  try {
    const response = await fetch(
      `/api/v1/coupons/available/${props.restaurantId}`,
    );
    const result = await response.json();

    if (result.success) {
      availableCoupons.value = result.data || [];
    } else {
      console.error("Failed to load available coupons:", result.error);
      availableCoupons.value = [];
    }
  } catch (error) {
    console.error("Error loading available coupons:", error);
    availableCoupons.value = [];
  } finally {
    isLoadingCoupons.value = false;
  }
};

const selectCoupon = (coupon: any) => {
  if (appliedCoupon.value) return; // 如果已有應用的優惠券，不允許選擇
  selectedCoupon.value = selectedCoupon.value?.id === coupon.id ? null : coupon;
};

const applyCouponFromList = async () => {
  if (!selectedCoupon.value) return;

  // 使用選中的優惠券代碼進行驗證
  couponCode.value = selectedCoupon.value.code;
  await validateCoupon();
};

// 優惠券格式化方法
const formatCouponDiscount = (coupon: any) => {
  if (coupon.discountType === "percentage") {
    return `${coupon.discountValue}% ${t("common.off")}`;
  } else {
    return `$${formatPrice(coupon.discountValue)} ${t("common.off")}`;
  }
};

const formatCouponExpiry = (dateString: any) => {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  } catch (error) {
    return dateString;
  }
};

const getCouponTypeClass = (discountType: any) => {
  return discountType === "percentage"
    ? "bg-blue-100 text-blue-800"
    : "bg-green-100 text-green-800";
};

const getCouponTypeText = (discountType: any) => {
  return discountType === "percentage"
    ? t("cart.percentage")
    : t("cart.fixedAmount");
};

const selectAndApplyCoupon = async (coupon: any) => {
  selectedCoupon.value = coupon;
  await applyCouponFromList();
};

const submitOrder = async () => {
  try {
    isSubmitting.value = true;
    showConfirmation.value = false;

    // 構建訂單資料
    const orderData: CreateOrderRequest = {
      restaurantId: props.restaurantId,
      tableId: props.tableId,
      customerName: customerInfo.value.name.trim() || undefined,
      customerPhone: customerInfo.value.phone.trim() || undefined,
      items: cartStore.items.map((item) => ({
        menuItemId: item.menuItem.id,
        quantity: item.quantity,
        customizations: item.customizations,
        notes: item.notes,
      })),
      notes: orderNotes.value.trim() || undefined,
      couponCode: appliedCoupon.value
        ? couponCode.value.trim().toUpperCase()
        : undefined,
    };

    // 提交訂單
    createOrder(orderData);
  } catch (error) {
    console.error("提交訂單失敗:", error);
    toast.error("訂單提交失敗，請重試");
    isSubmitting.value = false;
  }
};

// 保存顧客資訊到 localStorage
const saveCustomerInfo = () => {
  try {
    localStorage.setItem(
      "makanmakan_customer_info",
      JSON.stringify(customerInfo.value),
    );
  } catch (error) {
    console.warn("保存顧客資訊失敗:", error);
  }
};

// 恢復顧客資訊
const restoreCustomerInfo = () => {
  try {
    const saved = localStorage.getItem("makanmakan_customer_info");
    if (saved) {
      const parsed = JSON.parse(saved);
      customerInfo.value = {
        name: parsed.name || "",
        phone: parsed.phone || "",
      };
    }
  } catch (error) {
    console.warn("恢復顧客資訊失敗:", error);
  }
};

// 監聽顧客資訊變化並保存
watch(customerInfo, saveCustomerInfo, { deep: true });

// 組件掛載時恢復顧客資訊
onMounted(() => {
  restoreCustomerInfo();
});
</script>
