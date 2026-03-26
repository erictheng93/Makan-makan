<template>
  <div class="payment-form">
    <!-- 支付流程指示器 -->
    <PaymentSteps
      :current-step="currentStep"
      :steps="paymentSteps"
      class="mb-8"
    />

    <!-- 主要支付容器 -->
    <div class="payment-container">
      <div class="payment-content">
        <!-- 步驟 1: 選擇支付方式 -->
        <div v-if="currentStep === 'method'" class="step-content">
          <div class="step-header">
            <h2 class="step-title">
              {{ t("payment.form.selectMethodTitle") }}
            </h2>
            <p class="step-description">
              {{ t("payment.form.selectMethodDesc") }}
            </p>
          </div>

          <PaymentMethodSelector
            v-model="selectedPaymentMethod"
            :available-methods="availablePaymentMethods"
            :country="country"
            :loading="loadingMethods"
            @method-selected="handleMethodSelected"
          />

          <div class="step-actions">
            <button
              class="btn btn-primary btn-large"
              :disabled="!selectedPaymentMethod"
              @click="proceedToDetails"
            >
              {{ t("payment.form.continue") }}
            </button>
          </div>
        </div>

        <!-- 步驟 2: 輸入支付詳情 -->
        <div v-else-if="currentStep === 'details'" class="step-content">
          <div class="step-header">
            <h2 class="step-title">{{ t("payment.form.detailsTitle") }}</h2>
            <p class="step-description">{{ t("payment.form.detailsDesc") }}</p>
          </div>

          <!-- 客戶資訊表單 -->
          <div class="form-section">
            <h3 class="section-title">{{ t("payment.form.contactInfo") }}</h3>
            <div class="form-grid">
              <div class="form-field">
                <label for="customer-name" class="field-label">{{
                  t("payment.form.name")
                }}</label>
                <input
                  id="customer-name"
                  v-model="customerInfo.name"
                  type="text"
                  class="field-input"
                  :placeholder="t('payment.form.namePlaceholder')"
                  :class="{ 'field-error': errors.name }"
                />
                <span v-if="errors.name" class="error-message">{{
                  errors.name
                }}</span>
              </div>

              <div class="form-field">
                <label for="customer-email" class="field-label">{{
                  t("payment.form.email")
                }}</label>
                <input
                  id="customer-email"
                  v-model="customerInfo.email"
                  type="email"
                  class="field-input"
                  placeholder="example@email.com"
                  :class="{ 'field-error': errors.email }"
                />
                <span v-if="errors.email" class="error-message">{{
                  errors.email
                }}</span>
              </div>

              <div class="form-field">
                <label for="customer-phone" class="field-label"
                  >{{ t("payment.form.phone") }}
                  <span class="field-optional"
                    >({{ t("payment.form.optional") }})</span
                  ></label
                >
                <input
                  id="customer-phone"
                  v-model="customerInfo.phone"
                  type="tel"
                  class="field-input"
                  :placeholder="phonePlaceholder"
                />
              </div>
            </div>
          </div>

          <!-- Stripe Elements 容器 -->
          <div
            v-if="selectedPaymentMethod === 'credit_card'"
            class="form-section"
          >
            <h3 class="section-title">
              {{ t("payment.form.creditCardInfo") }}
            </h3>
            <StripeCardElement
              :client-secret="clientSecret"
              :publishable-key="stripePublishableKey"
              :amount="amount"
              :currency="currency"
              :country="country"
              :loading="processingPayment"
              @payment-success="handlePaymentSuccess"
              @payment-error="handlePaymentError"
            />
          </div>

          <!-- 其他支付方式的特定 UI -->
          <div
            v-else-if="selectedPaymentMethod === 'bank_transfer'"
            class="form-section"
          >
            <h3 class="section-title">{{ t("payment.form.bankTransfer") }}</h3>
            <BankTransferInfo :country="paymentRequest.country" />
          </div>

          <div class="step-actions">
            <button class="btn btn-secondary" @click="goBack">
              {{ t("payment.form.back") }}
            </button>
            <button
              class="btn btn-primary btn-large"
              :disabled="!canProceedToPayment || processingPayment"
              @click="processPayment"
            >
              <span v-if="processingPayment" class="btn-loading">
                <LoadingSpinner size="sm" />
                {{ t("payment.form.processing") }}
              </span>
              <span v-else>
                {{ t("payment.form.confirmPayment") }}
                {{
                  formatAmount(paymentRequest.amount, paymentRequest.currency)
                }}
              </span>
            </button>
          </div>
        </div>

        <!-- 步驟 3: 處理中/完成 -->
        <div v-else-if="currentStep === 'processing'" class="step-content">
          <PaymentProcessing
            :status="paymentStatus"
            :transaction-id="transactionId"
            @retry="retryPayment"
            @close="closePayment"
          />
        </div>
      </div>

      <!-- 訂單摘要側邊欄 -->
      <div class="payment-sidebar">
        <OrderSummary
          :order="orderDetails"
          :loading="loadingOrder"
          :show-breakdown="true"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useI18n } from "@/i18n";
import { api } from "@/services/api";
import { usePaymentStore } from "@/stores/payment";
import type {
  PaymentRequest,
  PaymentMethod,
  CountryCode,
} from "@makanmakan/shared-types";

// 組件引入
import PaymentSteps from "./PaymentSteps.vue";
import PaymentMethodSelector from "./PaymentMethodSelector.vue";
import StripeCardElement from "./StripeCardElement.vue";
import BankTransferInfo from "./BankTransferInfo.vue";
import PaymentProcessing from "./PaymentProcessing.vue";
import OrderSummary from "./OrderSummary.vue";
import LoadingSpinner from "@/components/ui/LoadingSpinner.vue";

// Props
interface Props {
  orderId: string;
  restaurantId: string;
  country: CountryCode;
  currency: "TWD" | "MYR" | "VND";
  amount: number;
  autoStart?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  autoStart: true,
});

// Emits
interface Emits {
  (e: "payment-success", transactionId: string): void;
  (e: "payment-error", error: string): void;
  (e: "payment-cancel"): void;
  (e: "step-change", step: string): void;
}

const emit = defineEmits<Emits>();

// Composables
const { t } = useI18n();
const paymentStore = usePaymentStore();

// Stripe 配置
const stripePublishableKey =
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || "pk_test_default";

// 響應式狀態
const currentStep = ref<"method" | "details" | "processing">("method");
const selectedPaymentMethod = ref<PaymentMethod>();
const processingPayment = ref(false);
const clientSecret = ref("");
const transactionId = ref("");
const paymentStatus = ref<"processing" | "success" | "error" | "cancelled">(
  "processing",
);

// 表單資料
const customerInfo = ref({
  name: "",
  email: "",
  phone: "",
});

// 錯誤狀態
const errors = ref<Record<string, string>>({});

// 載入狀態
const loadingMethods = ref(false);
const loadingOrder = ref(false);

// 計算屬性
const paymentSteps = computed(() => [
  { key: "method", label: t("payment.form.stepMethod"), icon: "credit-card" },
  { key: "details", label: t("payment.form.stepDetails"), icon: "edit" },
  { key: "processing", label: t("payment.form.stepProcessing"), icon: "clock" },
]);

const paymentRequest = computed(
  (): PaymentRequest => ({
    orderId: props.orderId,
    restaurantId: props.restaurantId,
    country: props.country,
    currency: props.currency,
    amount: props.amount,
    method: selectedPaymentMethod.value || "credit_card",
    customerInfo: {
      name: customerInfo.value.name,
      email: customerInfo.value.email,
      phone: customerInfo.value.phone || undefined,
    },
  }),
);

const availablePaymentMethods = computed(() =>
  paymentStore.getAvailableMethodsForCountry(props.country),
);

const orderData = ref<any>(null);

const orderDetails = computed(() => ({
  id: props.orderId,
  restaurantId: props.restaurantId,
  country: props.country,
  currency: props.currency,
  subtotal: orderData.value?.totalAmount ?? props.amount,
  total: orderData.value?.totalAmount ?? props.amount,
  items: orderData.value?.items || [],
  tax: orderData.value?.tax ?? 0,
}));

const canProceedToPayment = computed(() => {
  return (
    customerInfo.value.name &&
    customerInfo.value.email &&
    isValidEmail(customerInfo.value.email) &&
    selectedPaymentMethod.value
  );
});

const phonePlaceholder = computed(() => {
  const placeholders = {
    TW: "+886 912 345 678",
    MY: "+60 12 345 6789",
    VN: "+84 987 654 321",
  };
  return placeholders[props.country] || "+1 234 567 890";
});

// 方法
const handleMethodSelected = (method: PaymentMethod) => {
  selectedPaymentMethod.value = method;
};

const proceedToDetails = () => {
  currentStep.value = "details";
  emit("step-change", "details");
};

const goBack = () => {
  if (currentStep.value === "details") {
    currentStep.value = "method";
  }
  emit("step-change", currentStep.value);
};

const processPayment = async () => {
  if (!validateForm()) return;

  processingPayment.value = true;
  currentStep.value = "processing";
  paymentStatus.value = "processing";

  try {
    const result = await paymentStore.createPayment(paymentRequest.value);

    if (result.success) {
      transactionId.value = result.transactionId;
      clientSecret.value = result.clientSecret || "";

      if (result.status === "completed") {
        paymentStatus.value = "success";
        emit("payment-success", result.transactionId);
      } else if (result.redirectUrl) {
        // 重定向到第三方支付
        window.location.href = result.redirectUrl;
      }
    } else {
      paymentStatus.value = "error";
      emit(
        "payment-error",
        result.error?.message || t("payment.form.paymentFailed"),
      );
    }
  } catch (error) {
    console.error("Payment processing error:", error);
    paymentStatus.value = "error";
    emit("payment-error", t("payment.form.paymentError"));
  } finally {
    processingPayment.value = false;
  }
};

const handlePaymentSuccess = (data: {
  transactionId: string;
  paymentMethod: any;
}) => {
  paymentStatus.value = "success";
  emit("payment-success", data.transactionId);
};

const handlePaymentError = (error: string) => {
  paymentStatus.value = "error";
  emit("payment-error", error);
};

const retryPayment = () => {
  paymentStatus.value = "processing";
  processPayment();
};

const closePayment = () => {
  emit("payment-cancel");
};

const validateForm = (): boolean => {
  errors.value = {};

  if (!customerInfo.value.name.trim()) {
    errors.value.name = t("payment.form.nameRequired");
  }

  if (!customerInfo.value.email.trim()) {
    errors.value.email = t("payment.form.emailRequired");
  } else if (!isValidEmail(customerInfo.value.email)) {
    errors.value.email = t("payment.form.emailInvalid");
  }

  return Object.keys(errors.value).length === 0;
};

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const formatAmount = (amount: number, currency: string): string => {
  return paymentStore.formatAmount(amount, currency as any);
};

// 載入可用的支付方式
const loadPaymentMethods = async () => {
  loadingMethods.value = true;
  try {
    await paymentStore.loadPaymentMethods(props.country);
  } catch (error) {
    console.error("Failed to load payment methods:", error);
  } finally {
    loadingMethods.value = false;
  }
};

// 載入訂單詳情
const loadOrderDetails = async () => {
  loadingOrder.value = true;
  try {
    const response = await api.get(`/orders/${props.orderId}`);
    orderData.value = response.data?.data || response.data;
  } catch (error) {
    console.error("Failed to load order details:", error);
  } finally {
    loadingOrder.value = false;
  }
};

// 生命週期
onMounted(async () => {
  await Promise.all([loadPaymentMethods(), loadOrderDetails()]);

  if (props.autoStart && availablePaymentMethods.value.length === 1) {
    selectedPaymentMethod.value = availablePaymentMethods.value[0];
    proceedToDetails();
  }
});

// 監聽步驟變化
watch(currentStep, (newStep) => {
  emit("step-change", newStep);
});
</script>

<style scoped>
.payment-form {
  @apply max-w-7xl mx-auto p-6 bg-gray-50 min-h-screen;
}

.payment-container {
  @apply grid grid-cols-1 lg:grid-cols-3 gap-8;
}

.payment-content {
  @apply lg:col-span-2;
}

.payment-sidebar {
  @apply lg:col-span-1;
}

/* 步驟內容 */
.step-content {
  @apply bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-8;
}

.step-header {
  @apply text-center space-y-2;
}

.step-title {
  @apply text-2xl font-semibold text-gray-900;
}

.step-description {
  @apply text-gray-600 text-lg;
}

/* 表單區塊 */
.form-section {
  @apply space-y-6;
}

.section-title {
  @apply text-lg font-medium text-gray-900 pb-2 border-b border-gray-100;
}

.form-grid {
  @apply grid grid-cols-1 md:grid-cols-2 gap-6;
}

.form-field {
  @apply space-y-2;
}

.field-label {
  @apply block text-sm font-medium text-gray-700;
}

.field-optional {
  @apply text-gray-400 font-normal;
}

.field-input {
  @apply w-full px-4 py-3 border border-gray-200 rounded-xl
         focus:ring-2 focus:ring-blue-500 focus:border-transparent
         transition-all duration-200 text-gray-900 placeholder-gray-400
         bg-white hover:border-gray-300;
}

.field-input:focus {
  @apply shadow-sm;
}

.field-error {
  @apply border-red-300 focus:ring-red-500;
}

.error-message {
  @apply text-sm text-red-600;
}

/* 按鈕樣式 */
.btn {
  @apply px-6 py-3 rounded-xl font-medium transition-all duration-200
         focus:outline-none focus:ring-2 focus:ring-offset-2
         disabled:opacity-50 disabled:cursor-not-allowed;
}

.btn-primary {
  @apply bg-blue-600 text-white hover:bg-blue-700 
         focus:ring-blue-500 shadow-sm hover:shadow;
}

.btn-secondary {
  @apply bg-gray-100 text-gray-700 hover:bg-gray-200 
         focus:ring-gray-500;
}

.btn-large {
  @apply px-8 py-4 text-lg;
}

.btn-loading {
  @apply flex items-center space-x-2;
}

/* 步驟操作 */
.step-actions {
  @apply flex justify-between items-center pt-6 border-t border-gray-100;
}

.step-actions .btn:only-child {
  @apply ml-auto;
}

/* 響應式設計 */
@media (max-width: 768px) {
  .payment-form {
    @apply p-4;
  }

  .step-content {
    @apply p-6;
  }

  .form-grid {
    @apply grid-cols-1;
  }

  .step-actions {
    @apply flex-col space-y-3;
  }

  .step-actions .btn {
    @apply w-full;
  }
}

/* 動畫效果 */
.step-content {
  animation: slideInUp 0.4s ease-out;
}

@keyframes slideInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 載入狀態 */
.loading-overlay {
  @apply absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center rounded-2xl;
}
</style>
