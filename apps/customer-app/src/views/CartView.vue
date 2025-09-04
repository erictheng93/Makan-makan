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
              {{ t('cart.title') }}
            </h1>
            <p class="text-sm text-gray-500">
              {{ restaurant?.name }} · {{ t('order.details.table') }} {{ tableId }}
            </p>
          </div>

          <div class="w-8 h-8" /> <!-- 占位符保持居中 -->
        </div>
      </div>
    </nav>

    <!-- 主要內容 -->
    <main class="max-w-md mx-auto">
      <!-- 空購物車狀態 -->
      <div
        v-if="cartStore.isEmpty"
        class="px-4 py-16 text-center"
      >
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
          {{ t('cart.empty') }}
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
      <div
        v-else
        class="px-4 py-6 space-y-6"
      >
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
            {{ t('order.title') }}
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
            <div
              v-if="tax > 0"
              class="flex justify-between text-gray-600"
            >
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
            <hr class="border-gray-200">

            <!-- 總計 -->
            <div
              class="flex justify-between text-lg font-semibold text-gray-900"
            >
              <span>{{ t("cart.total") }}</span>
              <span>${{ formatPrice(totalAmount) }}</span>
            </div>
          </div>
        </div>

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
            {{ t('order.details.customerInfo') }}
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
              >
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
              >
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
          :disabled="isSubmitting"
          class="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white font-semibold py-4 px-6 rounded-2xl transition-colors flex items-center justify-center space-x-2"
          @click="handleSubmitOrder"
        >
          <div
            v-if="isSubmitting"
            class="animate-spin rounded-full h-5 w-5 border-b-2 border-white"
          />
          <span v-if="isSubmitting">{{ t("order.placeOrder") }}...</span>
          <span v-else>{{ t("order.placeOrder") }} · ${{ formatPrice(totalAmount) }}</span>
        </button>

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
import { orderApi } from "@/services/orderApi";
import menuApi from "@/services/menuApi";
import { formatPrice } from "@/utils/format";
import type { Restaurant, CreateOrderRequest } from "@makanmakan/shared-types";

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

// API Queries
const { data: restaurant } = useQuery({
  queryKey: ["restaurant", props.restaurantId],
  queryFn: () => menuApi.getRestaurant(props.restaurantId),
  staleTime: 5 * 60 * 1000,
});

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
  // 這裡可以實作折扣邏輯
  return 0;
});

const totalAmount = computed(() => {
  return cartStore.subtotal + serviceCharge.value + tax.value - discount.value;
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
