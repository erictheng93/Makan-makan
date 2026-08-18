<template>
  <div class="payment-method-selector">
    <!-- 載入狀態 -->
    <div v-if="loading" class="loading-container">
      <div class="loading-grid">
        <div v-for="i in 4" :key="i" class="method-skeleton">
          <div class="skeleton-icon"></div>
          <div class="skeleton-text">
            <div class="skeleton-line"></div>
            <div class="skeleton-line short"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 支付方式列表 -->
    <div v-else class="methods-grid">
      <div
        v-for="method in availableMethodsWithDetails"
        :key="method.id"
        class="payment-method"
        :class="{
          'method-selected': selectedMethod === method.id,
          'method-recommended': method.recommended,
          'method-disabled': method.disabled,
        }"
        @click="selectMethod(method)"
      >
        <!-- 推薦標籤 -->
        <div v-if="method.recommended" class="recommended-badge">
          <StarIcon class="badge-icon" />
          {{ t("payment.recommended") }}
        </div>

        <!-- 方法圖標 -->
        <div class="method-icon">
          <component :is="method.iconComponent" class="icon" />
        </div>

        <!-- 方法資訊 -->
        <div class="method-info">
          <h3 class="method-name">{{ method.displayName }}</h3>
          <p class="method-description">{{ method.description }}</p>

          <!-- 處理時間和費用 -->
          <div class="method-details">
            <div class="detail-item">
              <ClockIcon class="detail-icon" />
              <span>{{ method.processingTime }}</span>
            </div>
            <div v-if="method.fee" class="detail-item">
              <CurrencyDollarIcon class="detail-icon" />
              <span>{{ method.fee }}</span>
            </div>
          </div>

          <!-- 支援的功能 -->
          <div v-if="method.features.length > 0" class="method-features">
            <div
              v-for="feature in method.features"
              :key="feature"
              class="feature-tag"
            >
              {{ getFeatureLabel(feature) }}
            </div>
          </div>
        </div>

        <!-- 選中指示器 -->
        <div v-if="selectedMethod === method.id" class="selected-indicator">
          <CheckCircleIcon class="check-icon" />
        </div>

        <!-- 不可用覆蓋層 -->
        <div v-if="method.disabled" class="disabled-overlay">
          <ExclamationTriangleIcon class="disabled-icon" />
          <span class="disabled-text">{{ method.disabledReason }}</span>
        </div>
      </div>
    </div>

    <!-- 無可用方式 -->
    <div
      v-if="!loading && availableMethodsWithDetails.length === 0"
      class="no-methods"
    >
      <CreditCardIcon class="no-methods-icon" />
      <h3 class="no-methods-title">{{ t("payment.noMethodsTitle") }}</h3>
      <p class="no-methods-description">
        {{ t("payment.noMethodsDescription") }}
      </p>
      <button class="retry-button" @click="$emit('retry')">
        <ArrowPathIcon class="retry-icon" />
        {{ t("payment.reload") }}
      </button>
    </div>

    <!-- 支付方式說明 -->
    <div v-if="selectedMethodDetails && !loading" class="method-explanation">
      <div class="explanation-header">
        <InformationCircleIcon class="info-icon" />
        <h4>
          {{ selectedMethodDetails.displayName }} {{ t("payment.explanation") }}
        </h4>
      </div>
      <div class="explanation-content">
        <p>{{ selectedMethodDetails.fullDescription }}</p>

        <div v-if="selectedMethodDetails.steps" class="payment-steps-preview">
          <h5>{{ t("payment.paymentProcess") }}</h5>
          <ol class="steps-list">
            <li v-for="step in selectedMethodDetails.steps" :key="step">
              {{ step }}
            </li>
          </ol>
        </div>

        <div v-if="selectedMethodDetails.requirements" class="requirements">
          <h5>{{ t("payment.requiredInfo") }}</h5>
          <ul class="requirements-list">
            <li v-for="req in selectedMethodDetails.requirements" :key="req">
              {{ req }}
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- 地區支付偏好提示 -->
    <div v-if="showRegionalHint" class="regional-hint">
      <MapPinIcon class="hint-icon" />
      <div class="hint-content">
        <h4>{{ getRegionalHintTitle() }}</h4>
        <p>{{ getRegionalHintMessage() }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, type Component } from "vue";
import { useI18n } from "@/i18n";
import {
  CreditCardIcon,
  ClockIcon,
  CurrencyDollarIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  StarIcon,
  InformationCircleIcon,
  ArrowPathIcon,
  MapPinIcon,
} from "@heroicons/vue/24/outline";
import {
  CreditCardIcon as CreditCardIconSolid,
  BanknotesIcon,
  DevicePhoneMobileIcon,
  BuildingLibraryIcon,
} from "@heroicons/vue/24/solid";
import QrCodeIcon from "@heroicons/vue/24/solid/QrCodeIcon";
import type { PaymentMethod, CountryCode } from "@makanmasak/shared-types";

// Props
interface Props {
  availableMethods: PaymentMethod[];
  selectedMethod?: PaymentMethod;
  country: CountryCode;
  loading?: boolean;
  showRegionalHint?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  showRegionalHint: true,
});

// Emits
interface Emits {
  (e: "update:selectedMethod", method: PaymentMethod): void;
  (e: "method-selected", method: PaymentMethod): void;
  (e: "retry"): void;
}

const emit = defineEmits<Emits>();

const { t } = useI18n();

// 內部狀態
const selectedMethod = ref<PaymentMethod | undefined>(props.selectedMethod);

// 支付方式詳細資訊
interface PaymentMethodDetails {
  id: PaymentMethod;
  displayName: string;
  description: string;
  fullDescription: string;
  iconComponent: Component;
  processingTime: string;
  fee?: string;
  features: string[];
  recommended: boolean;
  disabled: boolean;
  disabledReason?: string;
  steps?: string[];
  requirements?: string[];
}

const paymentMethodsConfig = computed<
  Record<PaymentMethod, Omit<PaymentMethodDetails, "id">>
>(() => ({
  credit_card: {
    displayName: t("payment.methods.creditCard.name"),
    description: t("payment.methods.creditCard.description"),
    fullDescription: t("payment.methods.creditCard.fullDescription"),
    iconComponent: CreditCardIconSolid,
    processingTime: t("payment.processingTime.instant"),
    features: ["3d_secure", "auto_retry", "refund"],
    recommended: true,
    disabled: false,
    steps: [
      t("payment.methods.creditCard.steps.enterInfo"),
      t("payment.methods.creditCard.steps.verifyCard"),
      t("payment.methods.creditCard.steps.complete3DS"),
      t("payment.methods.creditCard.steps.confirmPayment"),
    ],
    requirements: [
      t("payment.methods.creditCard.requirements.validCard"),
      t("payment.methods.creditCard.requirements.expiryDate"),
      t("payment.methods.creditCard.requirements.cvc"),
    ],
  },

  debit_card: {
    displayName: t("payment.methods.debitCard.name"),
    description: t("payment.methods.debitCard.description"),
    fullDescription: t("payment.methods.debitCard.fullDescription"),
    iconComponent: CreditCardIconSolid,
    processingTime: t("payment.processingTime.instant"),
    features: ["3d_secure", "refund"],
    recommended: false,
    disabled: false,
    steps: [
      t("payment.methods.debitCard.steps.enterInfo"),
      t("payment.methods.debitCard.steps.verifyBalance"),
      t("payment.methods.debitCard.steps.bankVerify"),
      t("payment.methods.debitCard.steps.confirmDebit"),
    ],
    requirements: [
      t("payment.methods.debitCard.requirements.validCard"),
      t("payment.methods.debitCard.requirements.sufficientBalance"),
      t("payment.methods.debitCard.requirements.pinOrSms"),
    ],
  },

  bank_transfer: {
    displayName: t("payment.methods.bankTransfer.name"),
    description: t("payment.methods.bankTransfer.description"),
    fullDescription: t("payment.methods.bankTransfer.fullDescription"),
    iconComponent: BuildingLibraryIcon,
    processingTime: t("payment.processingTime.oneToThreeDays"),
    features: ["manual_verify"],
    recommended: false,
    disabled: false,
    steps: [
      t("payment.methods.bankTransfer.steps.getInfo"),
      t("payment.methods.bankTransfer.steps.transfer"),
      t("payment.methods.bankTransfer.steps.keepReceipt"),
      t("payment.methods.bankTransfer.steps.waitConfirm"),
    ],
    requirements: [
      t("payment.methods.bankTransfer.requirements.bankAccount"),
      t("payment.methods.bankTransfer.requirements.onlineBanking"),
      t("payment.methods.bankTransfer.requirements.transferFee"),
    ],
  },

  digital_wallet: {
    displayName: t("payment.methods.digitalWallet.name"),
    description: t("payment.methods.digitalWallet.description"),
    fullDescription: t("payment.methods.digitalWallet.fullDescription"),
    iconComponent: DevicePhoneMobileIcon,
    processingTime: t("payment.processingTime.instant"),
    features: ["biometric", "quick_pay"],
    recommended: true,
    disabled: false,
    steps: [
      t("payment.methods.digitalWallet.steps.selectWallet"),
      t("payment.methods.digitalWallet.steps.biometricVerify"),
      t("payment.methods.digitalWallet.steps.confirmAmount"),
      t("payment.methods.digitalWallet.steps.completePayment"),
    ],
    requirements: [
      t("payment.methods.digitalWallet.requirements.supportedPhone"),
      t("payment.methods.digitalWallet.requirements.walletSetup"),
      t("payment.methods.digitalWallet.requirements.biometricOrPassword"),
    ],
  },

  // 台灣特定
  ecpay: {
    displayName: t("payment.methods.ecpay.name"),
    description: t("payment.methods.ecpay.description"),
    fullDescription: t("payment.methods.ecpay.fullDescription"),
    iconComponent: BanknotesIcon,
    processingTime: t("payment.processingTime.instantToThreeDays"),
    features: ["multi_method", "convenience_store"],
    recommended: true,
    disabled: false,
  },

  line_pay: {
    displayName: "LINE Pay",
    description: t("payment.methods.linePay.description"),
    fullDescription: t("payment.methods.linePay.fullDescription"),
    iconComponent: DevicePhoneMobileIcon,
    processingTime: t("payment.processingTime.instant"),
    features: ["app_based", "points_reward"],
    recommended: false,
    disabled: false,
  },

  // 馬來西亞特定
  fpx: {
    displayName: "FPX",
    description: t("payment.methods.fpx.description"),
    fullDescription: t("payment.methods.fpx.fullDescription"),
    iconComponent: BuildingLibraryIcon,
    processingTime: t("payment.processingTime.instant"),
    features: ["bank_direct", "real_time"],
    recommended: true,
    disabled: false,
  },

  touch_n_go: {
    displayName: "Touch 'n Go",
    description: t("payment.methods.touchNGo.description"),
    fullDescription: t("payment.methods.touchNGo.fullDescription"),
    iconComponent: DevicePhoneMobileIcon,
    processingTime: t("payment.processingTime.instant"),
    features: ["ewallet", "qr_code"],
    recommended: true,
    disabled: false,
  },

  grab_pay: {
    displayName: "GrabPay",
    description: t("payment.methods.grabPay.description"),
    fullDescription: t("payment.methods.grabPay.fullDescription"),
    iconComponent: DevicePhoneMobileIcon,
    processingTime: t("payment.processingTime.instant"),
    features: ["app_based", "rewards"],
    recommended: false,
    disabled: false,
  },

  // 越南特定
  momo: {
    displayName: "MoMo",
    description: t("payment.methods.momo.description"),
    fullDescription: t("payment.methods.momo.fullDescription"),
    iconComponent: DevicePhoneMobileIcon,
    processingTime: t("payment.processingTime.instant"),
    features: ["ewallet", "qr_code", "bank_link"],
    recommended: true,
    disabled: false,
  },

  zalo_pay: {
    displayName: "ZaloPay",
    description: t("payment.methods.zaloPay.description"),
    fullDescription: t("payment.methods.zaloPay.fullDescription"),
    iconComponent: DevicePhoneMobileIcon,
    processingTime: t("payment.processingTime.instant"),
    features: ["social_pay", "qr_code"],
    recommended: false,
    disabled: false,
  },

  viet_qr: {
    displayName: "VietQR",
    description: t("payment.methods.vietQR.description"),
    fullDescription: t("payment.methods.vietQR.fullDescription"),
    iconComponent: QrCodeIcon,
    processingTime: t("payment.processingTime.instant"),
    features: ["qr_code", "universal", "bank_support"],
    recommended: true,
    disabled: false,
  },

  vnpay: {
    displayName: "VNPay",
    description: t("payment.methods.vnpay.description"),
    fullDescription: t("payment.methods.vnpay.fullDescription"),
    iconComponent: BanknotesIcon,
    processingTime: t("payment.processingTime.instant"),
    features: ["multi_bank", "comprehensive"],
    recommended: false,
    disabled: false,
  },

  newebpay: {
    displayName: t("payment.methods.newebpay.name"),
    description: t("payment.methods.newebpay.description"),
    fullDescription: t("payment.methods.newebpay.fullDescription"),
    iconComponent: CreditCardIconSolid,
    processingTime: t("payment.processingTime.instant"),
    features: ["multi_payment"],
    recommended: false,
    disabled: false,
  },

  unipay: {
    displayName: t("payment.methods.unipay.name"),
    description: t("payment.methods.unipay.description"),
    fullDescription: t("payment.methods.unipay.fullDescription"),
    iconComponent: CreditCardIconSolid,
    processingTime: t("payment.processingTime.instant"),
    features: ["unified"],
    recommended: false,
    disabled: false,
  },

  touch_n_go_direct: {
    displayName: "Touch 'n Go Direct",
    description: t("payment.methods.touchNGoDirect.description"),
    fullDescription: t("payment.methods.touchNGoDirect.fullDescription"),
    iconComponent: DevicePhoneMobileIcon,
    processingTime: t("payment.processingTime.instant"),
    features: ["direct_payment"],
    recommended: false,
    disabled: false,
  },

  cash: {
    displayName: t("payment.methods.cash.name"),
    description: t("payment.methods.cash.description"),
    fullDescription: t("payment.methods.cash.fullDescription"),
    iconComponent: BanknotesIcon,
    processingTime: t("payment.processingTime.atStore"),
    features: ["in_person"],
    recommended: false,
    disabled: false,
  },
}));

// 計算可用方式的詳細資訊
const availableMethodsWithDetails = computed(() => {
  return props.availableMethods
    .map((method) => {
      const config = paymentMethodsConfig.value[method];
      return {
        id: method,
        ...config,
        // 根據國家調整推薦狀態
        recommended: getRecommendedForCountry(method, props.country),
      };
    })
    .sort((a, b) => {
      // 排序：推薦的在前，然後按字母排序
      if (a.recommended && !b.recommended) return -1;
      if (!a.recommended && b.recommended) return 1;
      return a.displayName.localeCompare(b.displayName);
    });
});

// 當前選中方式的詳細資訊
const selectedMethodDetails = computed(() => {
  if (!selectedMethod.value) return null;
  return availableMethodsWithDetails.value.find(
    (m) => m.id === selectedMethod.value,
  );
});

// 方法
const selectMethod = (method: PaymentMethodDetails) => {
  if (method.disabled) return;

  selectedMethod.value = method.id;
  emit("update:selectedMethod", method.id);
  emit("method-selected", method.id);
};

const getRecommendedForCountry = (
  method: PaymentMethod,
  country: CountryCode,
): boolean => {
  const countryRecommendations = {
    TW: ["credit_card", "ecpay", "line_pay"],
    MY: ["credit_card", "fpx", "touch_n_go"],
    VN: ["credit_card", "momo", "viet_qr"],
  };

  return countryRecommendations[country]?.includes(method) || false;
};

const getFeatureLabel = (feature: string): string => {
  const featureKeys: Record<string, string> = {
    "3d_secure": "payment.features.3dSecure",
    auto_retry: "payment.features.autoRetry",
    refund: "payment.features.refund",
    biometric: "payment.features.biometric",
    quick_pay: "payment.features.quickPay",
    multi_method: "payment.features.multiMethod",
    convenience_store: "payment.features.convenienceStore",
    app_based: "payment.features.appBased",
    points_reward: "payment.features.pointsReward",
    bank_direct: "payment.features.bankDirect",
    real_time: "payment.features.realTime",
    ewallet: "payment.features.ewallet",
    qr_code: "payment.features.qrCode",
    rewards: "payment.features.rewards",
    bank_link: "payment.features.bankLink",
    social_pay: "payment.features.socialPay",
    universal: "payment.features.universal",
    bank_support: "payment.features.bankSupport",
    multi_bank: "payment.features.multiBank",
    comprehensive: "payment.features.comprehensive",
    manual_verify: "payment.features.manualVerify",
    in_person: "payment.features.inPerson",
    multi_payment: "payment.features.multiPayment",
    unified: "payment.features.unified",
    direct_payment: "payment.features.directPayment",
  };

  return featureKeys[feature] ? t(featureKeys[feature]) : feature;
};

const getRegionalHintTitle = (): string => {
  const titleKeys: Record<string, string> = {
    TW: "payment.regional.twTitle",
    MY: "payment.regional.myTitle",
    VN: "payment.regional.vnTitle",
  };
  return titleKeys[props.country]
    ? t(titleKeys[props.country])
    : t("payment.regional.defaultTitle");
};

const getRegionalHintMessage = (): string => {
  const messageKeys: Record<string, string> = {
    TW: "payment.regional.twMessage",
    MY: "payment.regional.myMessage",
    VN: "payment.regional.vnMessage",
  };
  return messageKeys[props.country]
    ? t(messageKeys[props.country])
    : t("payment.regional.defaultMessage");
};

// 生命週期
onMounted(() => {
  // 自動選擇第一個推薦的方式
  if (!selectedMethod.value && availableMethodsWithDetails.value.length > 0) {
    const recommended = availableMethodsWithDetails.value.find(
      (m) => m.recommended,
    );
    if (recommended) {
      selectMethod(recommended);
    }
  }
});
</script>

<style scoped>
.payment-method-selector {
  @apply space-y-6;
}

/* 載入狀態 */
.loading-container {
  @apply animate-pulse;
}

.loading-grid {
  @apply grid grid-cols-1 sm:grid-cols-2 gap-4;
}

.method-skeleton {
  @apply flex items-center space-x-4 p-6 border border-gray-200 rounded-xl;
}

.skeleton-icon {
  @apply w-12 h-12 bg-gray-200 rounded-lg flex-shrink-0;
}

.skeleton-text {
  @apply flex-1 space-y-2;
}

.skeleton-line {
  @apply h-4 bg-gray-200 rounded;
}

.skeleton-line.short {
  @apply w-2/3;
}

/* 支付方式網格 */
.methods-grid {
  @apply grid grid-cols-1 sm:grid-cols-2 gap-4;
}

.payment-method {
  @apply relative p-6 border border-gray-200 rounded-xl cursor-pointer
         transition-all duration-200 hover:border-gray-300 hover:shadow-sm
         bg-white;
}

.payment-method:hover {
  @apply transform -translate-y-0.5;
}

.method-selected {
  @apply border-blue-500 ring-2 ring-blue-500 ring-opacity-20 bg-blue-50;
}

.method-recommended {
  @apply border-green-200 bg-green-50;
}

.method-disabled {
  @apply border-gray-100 bg-gray-50 cursor-not-allowed opacity-60;
}

/* 推薦標籤 */
.recommended-badge {
  @apply absolute -top-2 -right-2 bg-green-500 text-white text-xs
         px-2 py-1 rounded-full flex items-center space-x-1 font-medium;
}

.badge-icon {
  @apply w-3 h-3;
}

/* 方法圖標 */
.method-icon {
  @apply mb-4;
}

.method-icon .icon {
  @apply w-12 h-12 text-gray-600;
}

.method-selected .method-icon .icon {
  @apply text-blue-600;
}

/* 方法資訊 */
.method-info {
  @apply space-y-3;
}

.method-name {
  @apply text-lg font-semibold text-gray-900;
}

.method-description {
  @apply text-gray-600 text-sm leading-relaxed;
}

.method-details {
  @apply flex items-center space-x-4 text-sm text-gray-500;
}

.detail-item {
  @apply flex items-center space-x-1;
}

.detail-icon {
  @apply w-4 h-4;
}

/* 功能標籤 */
.method-features {
  @apply flex flex-wrap gap-2;
}

.feature-tag {
  @apply px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-md;
}

.method-selected .feature-tag {
  @apply bg-blue-100 text-blue-700;
}

/* 選中指示器 */
.selected-indicator {
  @apply absolute top-4 right-4;
}

.check-icon {
  @apply w-6 h-6 text-blue-600;
}

/* 不可用覆蓋層 */
.disabled-overlay {
  @apply absolute inset-0 bg-gray-100 bg-opacity-90 rounded-xl
         flex flex-col items-center justify-center space-y-2;
}

.disabled-icon {
  @apply w-8 h-8 text-gray-400;
}

.disabled-text {
  @apply text-gray-500 text-sm text-center;
}

/* 無可用方式 */
.no-methods {
  @apply text-center py-12 space-y-4;
}

.no-methods-icon {
  @apply w-16 h-16 text-gray-400 mx-auto;
}

.no-methods-title {
  @apply text-xl font-semibold text-gray-900;
}

.no-methods-description {
  @apply text-gray-600;
}

.retry-button {
  @apply inline-flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white
         rounded-lg hover:bg-blue-700 transition-colors;
}

.retry-icon {
  @apply w-4 h-4;
}

/* 支付方式說明 */
.method-explanation {
  @apply bg-blue-50 border border-blue-200 rounded-xl p-6 space-y-4;
}

.explanation-header {
  @apply flex items-center space-x-2;
}

.info-icon {
  @apply w-5 h-5 text-blue-600;
}

.explanation-header h4 {
  @apply font-semibold text-blue-900;
}

.explanation-content {
  @apply space-y-4 text-blue-800;
}

.payment-steps-preview h5,
.requirements h5 {
  @apply font-medium text-blue-900 mb-2;
}

.steps-list,
.requirements-list {
  @apply text-sm space-y-1 ml-4;
}

.steps-list {
  @apply list-decimal;
}

.requirements-list {
  @apply list-disc;
}

/* 地區提示 */
.regional-hint {
  @apply bg-amber-50 border border-amber-200 rounded-xl p-4 flex space-x-3;
}

.hint-icon {
  @apply w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5;
}

.hint-content h4 {
  @apply font-medium text-amber-900 mb-1;
}

.hint-content p {
  @apply text-amber-700 text-sm;
}

/* 響應式設計 */
@media (max-width: 640px) {
  .methods-grid {
    @apply grid-cols-1;
  }

  .method-details {
    @apply flex-col items-start space-x-0 space-y-1;
  }

  .method-features {
    @apply mt-2;
  }
}

/* 深色模式 */
@media (prefers-color-scheme: dark) {
  .payment-method {
    @apply bg-gray-800 border-gray-700;
  }

  .method-name {
    @apply text-gray-100;
  }

  .method-description,
  .method-details {
    @apply text-gray-400;
  }

  .method-selected {
    @apply bg-blue-900 border-blue-500;
  }
}
</style>
