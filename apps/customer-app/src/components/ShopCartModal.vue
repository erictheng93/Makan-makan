<template>
  <!-- Modal Overlay -->
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-300"
      leave-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="show"
        class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-end justify-center"
        @click.self="emit('close')"
      >
        <!-- Modal Content -->
        <Transition
          enter-active-class="transition-transform duration-300"
          leave-active-class="transition-transform duration-200"
          enter-from-class="translate-y-full"
          leave-to-class="translate-y-full"
        >
          <div
            v-if="show"
            class="bg-white rounded-t-3xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
          >
            <!-- Header -->
            <div class="px-6 py-4 border-b border-gray-200">
              <div class="flex items-center justify-between">
                <h2 class="text-xl font-bold text-gray-900">
                  {{ t("shopCart.title") }}
                </h2>
                <button
                  class="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors"
                  @click="emit('close')"
                >
                  <svg
                    class="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <!-- Cart Items -->
            <div class="flex-1 overflow-y-auto px-6 py-4">
              <!-- Empty cart state -->
              <div v-if="shopCartStore.isEmpty" class="text-center py-12">
                <div
                  class="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4"
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
                <p class="text-gray-600">{{ t("shopCart.empty") }}</p>
              </div>

              <!-- Non-empty cart content -->
              <div v-else>
                <!-- Fulfillment Type Toggle -->
                <div class="mb-4">
                  <p class="text-sm font-semibold text-gray-700 mb-2">
                    {{ t("shopCart.pickupMethod") }}
                  </p>
                  <div class="flex gap-2">
                    <button
                      :class="[
                        'flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-colors',
                        shopCartStore.fulfillmentType === 'takeaway'
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-100 text-gray-600',
                      ]"
                      @click="shopCartStore.setFulfillmentType('takeaway')"
                    >
                      {{ t("shopCart.takeaway") }}
                    </button>
                    <button
                      v-if="deliveryEnabled"
                      :class="[
                        'flex-1 py-2 px-3 rounded-lg text-sm font-semibold transition-colors',
                        shopCartStore.fulfillmentType === 'delivery'
                          ? 'bg-amber-500 text-white'
                          : 'bg-gray-100 text-gray-600',
                      ]"
                      @click="shopCartStore.setFulfillmentType('delivery')"
                    >
                      {{ t("shopCart.delivery") }}
                    </button>
                  </div>
                </div>

                <!-- Delivery Form -->
                <div
                  v-if="shopCartStore.fulfillmentType === 'delivery'"
                  class="mb-4 space-y-3"
                >
                  <div>
                    <label class="block text-xs text-gray-500 mb-1">{{
                      t("shopCart.deliveryAddress")
                    }}</label>
                    <input
                      v-model="deliveryAddress"
                      type="text"
                      :placeholder="t('shopCart.deliveryAddressPlaceholder')"
                      class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label class="block text-xs text-gray-500 mb-1">{{
                      t("shopCart.contactPhone")
                    }}</label>
                    <input
                      v-model="deliveryPhone"
                      type="tel"
                      :placeholder="t('shopCart.contactPhonePlaceholder')"
                      class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label class="block text-xs text-gray-500 mb-1">{{
                      t("shopCart.deliveryNotes")
                    }}</label>
                    <input
                      v-model="deliveryInstructions"
                      type="text"
                      :placeholder="t('shopCart.deliveryNotesPlaceholder')"
                      class="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                </div>

                <!-- Takeaway Info -->
                <div
                  v-if="shopCartStore.fulfillmentType === 'takeaway'"
                  class="mb-4 p-3 bg-gray-50 rounded-lg"
                >
                  <p class="text-xs text-gray-500">
                    {{ t("shopCart.estimatedPickup") }}
                  </p>
                  <p class="font-semibold text-sm">
                    {{ t("shopCart.estimatedTime") }}
                  </p>
                </div>

                <!-- Cart Items List -->
                <div class="space-y-4">
                  <div
                    v-for="item in shopCartStore.items"
                    :key="item.id"
                    class="bg-gray-50 rounded-lg p-4"
                  >
                    <div class="flex items-start justify-between mb-2">
                      <div class="flex-1">
                        <h3 class="font-semibold text-gray-900">
                          {{ item.menuItem.name }}
                        </h3>
                        <p class="text-sm text-gray-600 mt-1">
                          ${{ formatPrice(item.price) }}
                        </p>

                        <!-- Customizations -->
                        <div
                          v-if="item.customizations"
                          class="mt-2 space-y-1 text-sm text-gray-500"
                        >
                          <p v-if="item.customizations.size">
                            {{ t("customization.size") }}:
                            {{ item.customizations.size.name }}
                          </p>
                          <p
                            v-if="
                              item.customizations.options &&
                              item.customizations.options.length > 0
                            "
                          >
                            {{ t("customization.options") }}:
                            {{
                              item.customizations.options
                                .map((o) => o.choiceName)
                                .join(", ")
                            }}
                          </p>
                          <p
                            v-if="
                              item.customizations.addOns &&
                              item.customizations.addOns.length > 0
                            "
                          >
                            {{ t("customization.addOns") }}:
                            {{
                              item.customizations.addOns
                                .map((a) => a.name)
                                .join(", ")
                            }}
                          </p>
                        </div>

                        <!-- Notes -->
                        <p
                          v-if="item.notes"
                          class="mt-2 text-sm text-gray-500 italic"
                        >
                          {{ t("shopCart.notes") }} {{ item.notes }}
                        </p>
                      </div>

                      <button
                        class="ml-4 text-red-500 hover:text-red-700 transition-colors"
                        @click="shopCartStore.removeItem(item.id)"
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
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>

                    <!-- Quantity Controls -->
                    <div class="flex items-center justify-between mt-3">
                      <div class="flex items-center space-x-3">
                        <button
                          class="w-8 h-8 flex items-center justify-center bg-white border border-gray-300 rounded-full text-gray-600 hover:bg-gray-50 transition-colors"
                          @click="
                            shopCartStore.updateQuantity(
                              item.id,
                              item.quantity - 1,
                            )
                          "
                        >
                          <svg
                            class="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M20 12H4"
                            />
                          </svg>
                        </button>
                        <span
                          class="text-lg font-semibold text-gray-900 w-8 text-center"
                          >{{ item.quantity }}</span
                        >
                        <button
                          class="w-8 h-8 flex items-center justify-center bg-white border border-gray-300 rounded-full text-gray-600 hover:bg-gray-50 transition-colors"
                          @click="
                            shopCartStore.updateQuantity(
                              item.id,
                              item.quantity + 1,
                            )
                          "
                        >
                          <svg
                            class="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              stroke-linecap="round"
                              stroke-linejoin="round"
                              stroke-width="2"
                              d="M12 4v16m8-8H4"
                            />
                          </svg>
                        </button>
                      </div>
                      <div class="text-lg font-bold text-gray-900">
                        ${{ formatPrice(item.totalPrice) }}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <!-- end v-else (non-empty cart) -->
            </div>

            <!-- Footer -->
            <div
              v-if="!shopCartStore.isEmpty"
              class="border-t border-gray-200 px-6 py-4 space-y-4"
            >
              <!-- Subtotal / Totals -->
              <div
                v-if="shopCartStore.fulfillmentType === 'delivery'"
                class="flex justify-between text-sm text-gray-500"
              >
                <span>{{ t("shopCart.subtotal") }}</span>
                <span>NT$ {{ formatPrice(shopCartStore.subtotal) }}</span>
              </div>
              <div
                v-if="
                  shopCartStore.fulfillmentType === 'delivery' &&
                  shopCartStore.deliveryFee > 0
                "
                class="flex justify-between text-sm text-gray-500"
              >
                <span>{{ t("shopCart.deliveryFee") }}</span>
                <span>NT$ {{ formatPrice(shopCartStore.deliveryFee) }}</span>
              </div>
              <div class="flex justify-between font-bold text-lg">
                <span>{{ t("shopCart.total") }}</span>
                <span class="text-gray-900"
                  >NT$ {{ formatPrice(shopCartStore.totalWithDelivery) }}</span
                >
              </div>

              <!-- Customer Info -->
              <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div class="flex items-center text-sm text-blue-900">
                  <svg
                    class="w-5 h-5 mr-2 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                  <span
                    >{{ t("shopCart.pickupNumber") }} ···{{
                      phoneLastDigits
                    }}</span
                  >
                </div>
              </div>

              <!-- Checkout Button -->
              <button
                :disabled="isSubmitting"
                class="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-4 px-6 rounded-xl font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                @click="handleCheckout"
              >
                <span
                  v-if="!isSubmitting"
                  class="flex items-center justify-center"
                >
                  <svg
                    class="w-5 h-5 mr-2"
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
                  {{ t("shopCart.confirmOrder") }}
                </span>
                <span v-else class="flex items-center justify-center">
                  <svg
                    class="animate-spin h-5 w-5 mr-2"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      class="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      stroke-width="4"
                    ></circle>
                    <path
                      class="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  {{ t("shopCart.processing") }}
                </span>
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { useToast } from "vue-toastification";
import { useShopCartStore } from "@/stores/shopCart";
import { formatPrice } from "@/utils/format";
import { apiClient } from "@/services/api";
import { useI18n } from "@/composables/useI18n";

const props = defineProps<{
  show: boolean;
  restaurantId: string;
  phoneLastDigits?: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

const router = useRouter();
const toast = useToast();
const { t } = useI18n();
const shopCartStore = useShopCartStore();
const isSubmitting = ref(false);

const deliveryAddress = ref("");
const deliveryPhone = ref("");
const deliveryInstructions = ref("");

const deliveryEnabled = computed(() => {
  // If user got to delivery selection on landing page, delivery is enabled
  return (
    shopCartStore.fulfillmentType === "delivery" ||
    shopCartStore.deliveryFee >= 0
  );
});

const handleCheckout = async () => {
  // Validate delivery fields before submitting
  if (shopCartStore.fulfillmentType === "delivery") {
    if (!deliveryAddress.value.trim()) {
      toast.error(t("toast.deliveryAddressRequired"));
      return;
    }
    if (
      !deliveryPhone.value.trim() ||
      deliveryPhone.value.replace(/\D/g, "").length < 8
    ) {
      toast.error(t("toast.invalidPhoneNumber"));
      return;
    }
    shopCartStore.setDeliveryInfo({
      address: deliveryAddress.value.trim(),
      phone: deliveryPhone.value.trim(),
      instructions: deliveryInstructions.value.trim(),
    });
  }

  try {
    isSubmitting.value = true;

    // 準備訂單資料
    const orderData = {
      restaurantId: props.restaurantId,
      orderType: "shop",
      items: shopCartStore.items.map((item) => ({
        menuItemId: item.menuItem.id,
        quantity: item.quantity,
        price: item.price,
        customizations: item.customizations,
        notes: item.notes,
      })),
      customerInfo: {
        phoneLastDigits: props.phoneLastDigits,
        orderType: "shop",
      },
      totalAmount: shopCartStore.totalWithDelivery,
      deliveryInfo: {
        type: shopCartStore.fulfillmentType,
        ...(shopCartStore.fulfillmentType === "delivery"
          ? {
              address: deliveryAddress.value,
              phone: deliveryPhone.value,
              instructions: deliveryInstructions.value,
              deliveryFee: shopCartStore.deliveryFee,
            }
          : {}),
      },
    };

    // Use guest endpoint if no customer auth token
    const hasCustomerToken = !!localStorage.getItem("customer_auth_token");
    const endpoint = hasCustomerToken
      ? "/api/v1/orders"
      : "/api/v1/orders/guest";

    // Use apiClient for automatic token injection
    const orderResult = await apiClient.post(endpoint, orderData);
    // apiClient unwraps response.data.data, so orderResult IS the order object
    const orderId = orderResult.id;

    // 清空購物車
    shopCartStore.clearCart();

    // 顯示成功訊息
    toast.success(t("toast.orderSent"));

    // 關閉彈窗
    emit("close");

    // 導航到訂單追蹤頁面
    router.push({
      name: "OrderTracking",
      params: {
        restaurantId: props.restaurantId,
        tableId: 0, // 店家模式使用 0 或特殊值
        orderId,
      },
      query: {
        type: "shop",
        phone: props.phoneLastDigits,
      },
    });
  } catch (error: any) {
    console.error("結帳失敗:", error);
    toast.error(error.message || t("toast.orderSendFailed"));
  } finally {
    isSubmitting.value = false;
  }
};
</script>

<style scoped>
/* Scrollbar styling */
::-webkit-scrollbar {
  width: 6px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
}

::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #555;
}
</style>
