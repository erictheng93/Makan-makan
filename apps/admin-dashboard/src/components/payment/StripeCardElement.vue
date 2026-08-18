<template>
  <div class="stripe-card-element">
    <div class="card-element-container">
      <!-- Stripe Card Element 載入中 -->
      <div v-if="!stripeElementReady" class="element-loading">
        <div class="loading-skeleton">
          <div class="skeleton-line"></div>
          <div class="skeleton-grid">
            <div class="skeleton-line short"></div>
            <div class="skeleton-line short"></div>
          </div>
        </div>
      </div>

      <!-- Stripe Card Element 掛載點 -->
      <div
        ref="cardElementRef"
        class="stripe-card-field"
        :class="{
          'field-ready': stripeElementReady,
          'field-focused': isCardFocused,
          'field-complete': isCardComplete,
          'field-error': cardError,
        }"
      ></div>

      <!-- 錯誤訊息 -->
      <div v-if="cardError" class="card-error">
        <ExclamationCircleIcon class="error-icon" />
        <span>{{ cardError }}</span>
      </div>

      <!-- 支付提示 -->
      <div v-if="!cardError" class="payment-hints">
        <div class="security-info">
          <LockClosedIcon class="security-icon" />
          <span>{{ t("payment.stripe.encryptionNotice") }}</span>
        </div>
        <div class="accepted-cards">
          <span class="hint-text">{{ t("payment.stripe.acceptedCards") }}</span>
          <div class="card-icons">
            <div class="card-icon visa">VISA</div>
            <div class="card-icon mastercard">MC</div>
            <div class="card-icon amex">AMEX</div>
            <div v-if="country === 'TW'" class="card-icon jcb">JCB</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 3D Secure 驗證 -->
    <div v-if="show3DSecure" class="secure-verification">
      <div class="verification-header">
        <ShieldCheckIcon class="verification-icon" />
        <h3>{{ t("payment.stripe.securityVerification") }}</h3>
      </div>
      <p class="verification-message">
        {{ t("payment.stripe.verificationMessage") }}
      </p>
      <div class="verification-loading">
        <LoadingSpinner />
        <span>{{ t("payment.stripe.verifying") }}</span>
      </div>
    </div>

    <!-- 支付按鈕 -->
    <button
      v-if="showPayButton"
      class="pay-button"
      :disabled="!canPay || isProcessing"
      @click="handlePayment"
    >
      <span v-if="isProcessing" class="pay-loading">
        <LoadingSpinner size="sm" />
        {{ t("payment.stripe.processing") }}
      </span>
      <span v-else class="pay-content">
        <CreditCardIcon class="pay-icon" />
        {{ t("payment.stripe.confirmPayment") }} {{ formatAmount }}
      </span>
    </button>

    <!-- 測試卡片資訊 (僅開發環境) -->
    <div v-if="isDevelopment && showTestCards" class="test-cards">
      <div class="test-cards-header">
        <button class="test-toggle" @click="showTestCards = !showTestCards">
          {{ t("payment.stripe.testCards") }}
          <ChevronDownIcon
            class="toggle-icon"
            :class="{ rotated: showTestCards }"
          />
        </button>
      </div>

      <div v-if="showTestCards" class="test-cards-list">
        <div
          v-for="testCard in testCards"
          :key="testCard.number"
          class="test-card-item"
          @click="fillTestCard(testCard)"
        >
          <div class="test-card-number">{{ testCard.number }}</div>
          <div class="test-card-description">{{ testCard.description }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from "vue";
import { useI18n } from "@/i18n";
import { useToast } from "vue-toastification";
import {
  loadStripe,
  type Stripe,
  type StripeElements,
  type StripeCardElement,
  type StripeCardElementChangeEvent,
} from "@stripe/stripe-js";
import {
  ExclamationCircleIcon,
  LockClosedIcon,
  CreditCardIcon,
  ChevronDownIcon,
} from "@heroicons/vue/24/outline";
import ShieldCheckIcon from "@heroicons/vue/24/outline/ShieldCheckIcon";
import LoadingSpinner from "@/components/ui/LoadingSpinner.vue";
import {
  formatCurrency,
  CURRENCY_CONFIGS,
  type CurrencyCode,
} from "@makanmasak/utils";

// Props
interface Props {
  clientSecret?: string;
  publishableKey: string;
  amount: number;
  currency: string;
  country: "TW" | "MY" | "VN";
  customerEmail?: string;
  appearance?: "default" | "minimal" | "accordion";
  loading?: boolean;
  showPayButton?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  appearance: "default",
  loading: false,
  showPayButton: true,
});

// Emits
interface Emits {
  (
    e: "payment-success",
    data: { transactionId: string; paymentMethod: any },
  ): void;
  (e: "payment-error", error: string): void;
  (e: "payment-processing", isProcessing: boolean): void;
  (e: "card-change", data: { complete: boolean; error?: string }): void;
  (e: "element-ready"): void;
}

const emit = defineEmits<Emits>();

const { t, locale } = useI18n();
const toast = useToast();

// Stripe 實例
let stripe: Stripe | null = null;
let elements: StripeElements | null = null;
let cardElement: StripeCardElement | null = null;

// 響應式狀態
const cardElementRef = ref<HTMLElement>();
const stripeElementReady = ref(false);
const isCardFocused = ref(false);
const isCardComplete = ref(false);
const cardError = ref("");
const isProcessing = ref(false);
const show3DSecure = ref(false);
const showTestCards = ref(false);

// 計算屬性
// `currency` prop 型別為 string，可能超出 CurrencyCode 聯合型別，
// 因此先做執行期收斂；支援的幣別走共用格式化，其餘維持原本行為。
const isSupportedCurrency = (code: string): code is CurrencyCode =>
  code in CURRENCY_CONFIGS;

const formatAmount = computed(() => {
  if (isSupportedCurrency(props.currency)) {
    return formatCurrency(props.amount, props.currency);
  }

  // Follows the reader's language rather than a pinned zh-TW: this branch is
  // for a currency the shared config does not describe, so there is no
  // currency-native convention to fall back on.
  return new Intl.NumberFormat(locale.value, {
    style: "currency",
    currency: props.currency,
    minimumFractionDigits: 2,
  }).format(props.amount);
});

const canPay = computed(() => {
  return (
    stripeElementReady.value &&
    isCardComplete.value &&
    !cardError.value &&
    !props.loading
  );
});

const isDevelopment = computed(() => {
  return process.env.NODE_ENV === "development";
});

// 測試卡片資料
const testCards = computed(() => [
  {
    number: "4242 4242 4242 4242",
    expiry: "12/34",
    cvc: "123",
    description: t("payment.stripe.testCardSuccess"),
  },
  {
    number: "4000 0000 0000 0002",
    expiry: "12/34",
    cvc: "123",
    description: t("payment.stripe.testCardDeclined"),
  },
  {
    number: "4000 0000 0000 9995",
    expiry: "12/34",
    cvc: "123",
    description: t("payment.stripe.testCardInsufficientFunds"),
  },
  {
    number: "4000 0025 0000 3155",
    expiry: "12/34",
    cvc: "123",
    description: t("payment.stripe.testCard3DS"),
  },
]);

// Stripe 外觀主題
const getStripeTheme = () => {
  return {
    theme: "stripe" as const,
    variables: {
      colorPrimary: "#3b82f6",
      colorBackground: "#ffffff",
      colorText: "#1f2937",
      colorDanger: "#ef4444",
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      spacingUnit: "6px",
      borderRadius: "12px",
    },
    rules: {
      ".Input": {
        padding: "12px 16px",
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
        backgroundColor: "#ffffff",
        fontSize: "16px",
        transition: "border-color 0.2s, box-shadow 0.2s",
      },
      ".Input:focus": {
        borderColor: "#3b82f6",
        boxShadow: "0 0 0 3px rgba(59, 130, 246, 0.1)",
      },
      ".Input--invalid": {
        borderColor: "#ef4444",
      },
      ".Input--complete": {
        borderColor: "#10b981",
      },
    },
  };
};

// 初始化 Stripe
const initializeStripe = async () => {
  try {
    stripe = await loadStripe(props.publishableKey);

    if (!stripe) {
      throw new Error("Failed to load Stripe");
    }

    elements = stripe.elements({
      appearance: getStripeTheme(),
      clientSecret: props.clientSecret,
    });

    cardElement = elements.create("card", {
      style: {
        base: {
          fontSize: "16px",
          color: "#1f2937",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          "::placeholder": {
            color: "#9ca3af",
          },
        },
        invalid: {
          color: "#ef4444",
          iconColor: "#ef4444",
        },
        complete: {
          color: "#10b981",
          iconColor: "#10b981",
        },
      },
      hidePostalCode: true, // 隱藏郵遞區號欄位
    });

    // 掛載 Card Element
    if (cardElementRef.value) {
      cardElement.mount(cardElementRef.value);
    }

    // 監聽 Card Element 事件
    cardElement.on("ready", () => {
      stripeElementReady.value = true;
      emit("element-ready");
    });

    cardElement.on("focus", () => {
      isCardFocused.value = true;
    });

    cardElement.on("blur", () => {
      isCardFocused.value = false;
    });

    cardElement.on("change", (event: StripeCardElementChangeEvent) => {
      isCardComplete.value = event.complete;
      cardError.value = event.error?.message || "";

      emit("card-change", {
        complete: event.complete,
        error: event.error?.message,
      });
    });
  } catch (error) {
    console.error("Stripe initialization error:", error);
    emit("payment-error", "Failed to initialize payment system");
  }
};

// 處理支付
const handlePayment = async () => {
  if (!stripe || !cardElement || !props.clientSecret) {
    emit("payment-error", "Payment system not ready");
    return;
  }

  isProcessing.value = true;
  emit("payment-processing", true);

  try {
    const { error, paymentIntent } = await stripe.confirmCardPayment(
      props.clientSecret,
      {
        payment_method: {
          card: cardElement,
          billing_details: {
            email: props.customerEmail,
          },
        },
      },
    );

    if (error) {
      // 處理特定錯誤
      if (error.code === "card_declined") {
        cardError.value = t("payment.stripe.errors.cardDeclined");
      } else if (error.code === "expired_card") {
        cardError.value = t("payment.stripe.errors.expiredCard");
      } else if (error.code === "insufficient_funds") {
        cardError.value = t("payment.stripe.errors.insufficientFunds");
      } else if (error.code === "incorrect_cvc") {
        cardError.value = t("payment.stripe.errors.incorrectCvc");
      } else {
        cardError.value =
          error.message || t("payment.stripe.errors.processingFailed");
      }

      emit("payment-error", cardError.value);
    } else if (paymentIntent?.status === "succeeded") {
      emit("payment-success", {
        transactionId: paymentIntent.id,
        paymentMethod: paymentIntent.payment_method,
      });
    } else if (paymentIntent?.status === "requires_action") {
      show3DSecure.value = true;
      // Stripe 會自動處理 3D Secure，這裡只是顯示 UI
    }
  } catch (error) {
    console.error("Payment error:", error);
    emit("payment-error", t("payment.stripe.errors.paymentError"));
  } finally {
    isProcessing.value = false;
    show3DSecure.value = false;
    emit("payment-processing", false);
  }
};

// 填入測試卡片資料
const fillTestCard = (testCard: (typeof testCards.value)[0]) => {
  if (cardElement) {
    // 注意: Stripe Elements 不支援程式化填入資料
    // 這裡只是提供測試卡片號碼給開發者參考
    navigator.clipboard.writeText(testCard.number.replace(/\s/g, ""));
    toast.success(
      t("payment.stripe.testCardCopied", { number: testCard.number }),
    );
  }
};

// 監聽 props 變化
watch(
  () => props.clientSecret,
  async (newSecret) => {
    if (newSecret && stripe) {
      // Stripe Elements v4+ 不支援透過 update() 更新 clientSecret
      // 需要重新建立 Elements 實例
      if (cardElement) {
        cardElement.destroy();
      }
      await initializeStripe();
    }
  },
);

watch(
  () => props.loading,
  (isLoading) => {
    if (isLoading) {
      cardError.value = "";
    }
  },
);

// 生命週期
onMounted(() => {
  initializeStripe();
});

onUnmounted(() => {
  if (cardElement) {
    cardElement.destroy();
  }
});
</script>

<style scoped>
.stripe-card-element {
  @apply space-y-6;
}

.card-element-container {
  @apply space-y-4;
}

/* 載入骨架 */
.element-loading {
  @apply animate-pulse;
}

.loading-skeleton {
  @apply space-y-3;
}

.skeleton-line {
  @apply h-12 bg-gray-200 rounded-xl;
}

.skeleton-line.short {
  @apply h-12 bg-gray-200 rounded-xl;
}

.skeleton-grid {
  @apply grid grid-cols-2 gap-3;
}

/* Stripe Card Element 容器 */
.stripe-card-field {
  @apply p-4 border border-gray-200 rounded-xl bg-white
         transition-all duration-200 min-h-[3rem];
}

.stripe-card-field.field-ready {
  @apply opacity-100;
}

.stripe-card-field.field-focused {
  @apply border-blue-500 ring-2 ring-blue-500 ring-opacity-20;
}

.stripe-card-field.field-complete {
  @apply border-green-500;
}

.stripe-card-field.field-error {
  @apply border-red-500;
}

/* 錯誤訊息 */
.card-error {
  @apply flex items-center space-x-2 text-red-600 text-sm bg-red-50 
         px-4 py-3 rounded-xl border border-red-200;
}

.error-icon {
  @apply w-5 h-5 flex-shrink-0;
}

/* 支付提示 */
.payment-hints {
  @apply space-y-3;
}

.security-info {
  @apply flex items-center space-x-2 text-gray-600 text-sm;
}

.security-icon {
  @apply w-4 h-4 text-green-600;
}

.accepted-cards {
  @apply flex items-center justify-between text-sm;
}

.hint-text {
  @apply text-gray-600;
}

.card-icons {
  @apply flex space-x-2;
}

.card-icon {
  @apply px-2 py-1 text-xs font-bold rounded bg-gray-100 text-gray-700;
}

.card-icon.visa {
  @apply bg-blue-100 text-blue-800;
}

.card-icon.mastercard {
  @apply bg-red-100 text-red-800;
}

.card-icon.amex {
  @apply bg-green-100 text-green-800;
}

.card-icon.jcb {
  @apply bg-purple-100 text-purple-800;
}

/* 3D Secure 驗證 */
.secure-verification {
  @apply bg-blue-50 border border-blue-200 rounded-xl p-6 space-y-4;
}

.verification-header {
  @apply flex items-center space-x-3;
}

.verification-icon {
  @apply w-6 h-6 text-blue-600;
}

.verification-header h3 {
  @apply text-lg font-semibold text-blue-900;
}

.verification-message {
  @apply text-blue-700;
}

.verification-loading {
  @apply flex items-center space-x-3 text-blue-600;
}

/* 支付按鈕 */
.pay-button {
  @apply w-full bg-blue-600 text-white py-4 px-6 rounded-xl
         font-semibold text-lg transition-all duration-200
         hover:bg-blue-700 focus:outline-none focus:ring-2 
         focus:ring-blue-500 focus:ring-offset-2
         disabled:bg-gray-300 disabled:cursor-not-allowed
         shadow-sm hover:shadow;
}

.pay-loading,
.pay-content {
  @apply flex items-center justify-center space-x-2;
}

.pay-icon {
  @apply w-5 h-5;
}

/* 測試卡片 */
.test-cards {
  @apply mt-8 border border-yellow-200 rounded-xl bg-yellow-50 overflow-hidden;
}

.test-cards-header {
  @apply p-4 border-b border-yellow-200 bg-yellow-100;
}

.test-toggle {
  @apply flex items-center space-x-2 text-sm font-medium text-yellow-800
         hover:text-yellow-900 transition-colors;
}

.toggle-icon {
  @apply w-4 h-4 transition-transform duration-200;
}

.toggle-icon.rotated {
  @apply rotate-180;
}

.test-cards-list {
  @apply divide-y divide-yellow-200;
}

.test-card-item {
  @apply p-4 hover:bg-yellow-100 cursor-pointer transition-colors;
}

.test-card-number {
  @apply font-mono text-sm font-medium text-gray-900;
}

.test-card-description {
  @apply text-xs text-gray-600 mt-1;
}

/* 響應式設計 */
@media (max-width: 640px) {
  .pay-button {
    @apply py-3 text-base;
  }

  .accepted-cards {
    @apply flex-col items-start space-y-2;
  }

  .card-icons {
    @apply justify-start;
  }
}

/* 深色模式支援 */
@media (prefers-color-scheme: dark) {
  .stripe-card-field {
    @apply bg-gray-800 border-gray-700;
  }

  .skeleton-line {
    @apply bg-gray-700;
  }
}
</style>
