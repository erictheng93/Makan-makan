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
          推薦
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
      <h3 class="no-methods-title">暫無可用的支付方式</h3>
      <p class="no-methods-description">請稍後再試，或聯繫客服協助</p>
      <button class="retry-button" @click="$emit('retry')">
        <ArrowPathIcon class="retry-icon" />
        重新載入
      </button>
    </div>

    <!-- 支付方式說明 -->
    <div v-if="selectedMethodDetails && !loading" class="method-explanation">
      <div class="explanation-header">
        <InformationCircleIcon class="info-icon" />
        <h4>{{ selectedMethodDetails.displayName }} 說明</h4>
      </div>
      <div class="explanation-content">
        <p>{{ selectedMethodDetails.fullDescription }}</p>

        <div v-if="selectedMethodDetails.steps" class="payment-steps-preview">
          <h5>付款流程：</h5>
          <ol class="steps-list">
            <li v-for="step in selectedMethodDetails.steps" :key="step">
              {{ step }}
            </li>
          </ol>
        </div>

        <div v-if="selectedMethodDetails.requirements" class="requirements">
          <h5>所需資訊：</h5>
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
import { ref, computed, onMounted } from "vue";
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
import type { PaymentMethod, CountryCode } from "@makanmakan/shared-types";

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

// 內部狀態
const selectedMethod = ref<PaymentMethod | undefined>(props.selectedMethod);

// 支付方式詳細資訊
interface PaymentMethodDetails {
  id: PaymentMethod;
  displayName: string;
  description: string;
  fullDescription: string;
  iconComponent: any;
  processingTime: string;
  fee?: string;
  features: string[];
  recommended: boolean;
  disabled: boolean;
  disabledReason?: string;
  steps?: string[];
  requirements?: string[];
}

const paymentMethodsConfig: Record<
  PaymentMethod,
  Omit<PaymentMethodDetails, "id">
> = {
  credit_card: {
    displayName: "信用卡",
    description: "使用 Visa、MasterCard 等信用卡付款",
    fullDescription:
      "支援所有主要信用卡品牌，包括 Visa、MasterCard、American Express 等。付款過程安全可靠，支援 3D Secure 驗證。",
    iconComponent: CreditCardIconSolid,
    processingTime: "即時",
    features: ["3d_secure", "auto_retry", "refund"],
    recommended: true,
    disabled: false,
    steps: [
      "輸入信用卡資訊",
      "驗證卡片有效性",
      "完成 3D Secure 驗證（如需要）",
      "確認付款",
    ],
    requirements: ["有效的信用卡", "卡片到期日", "CVC 安全碼"],
  },

  debit_card: {
    displayName: "金融卡",
    description: "使用銀行金融卡直接扣款",
    fullDescription:
      "直接從您的銀行帳戶扣款，無需信用額度。支援大部分銀行發行的金融卡。",
    iconComponent: CreditCardIconSolid,
    processingTime: "即時",
    features: ["3d_secure", "refund"],
    recommended: false,
    disabled: false,
    steps: ["輸入金融卡資訊", "驗證卡片和帳戶餘額", "完成銀行驗證", "確認扣款"],
    requirements: ["有效的金融卡", "充足的帳戶餘額", "PIN 碼或簡訊驗證"],
  },

  bank_transfer: {
    displayName: "銀行轉帳",
    description: "透過網路銀行或 ATM 轉帳付款",
    fullDescription:
      "提供轉帳資訊，您可以透過網路銀行、ATM 或臨櫃完成轉帳。適合喜歡傳統付款方式的用戶。",
    iconComponent: BuildingLibraryIcon,
    processingTime: "1-3 個工作天",
    features: ["manual_verify"],
    recommended: false,
    disabled: false,
    steps: [
      "取得轉帳資訊",
      "使用網銀或 ATM 轉帳",
      "保留轉帳憑證",
      "等待轉帳確認",
    ],
    requirements: ["銀行帳戶", "網路銀行或 ATM 卡", "轉帳手續費"],
  },

  digital_wallet: {
    displayName: "數位錢包",
    description: "使用行動支付 App 快速付款",
    fullDescription:
      "支援各種數位錢包應用程式，如 Apple Pay、Google Pay、Samsung Pay 等。快速便捷，無需輸入卡片資訊。",
    iconComponent: DevicePhoneMobileIcon,
    processingTime: "即時",
    features: ["biometric", "quick_pay"],
    recommended: true,
    disabled: false,
    steps: [
      "選擇數位錢包",
      "使用指紋或Face ID驗證",
      "確認付款金額",
      "完成付款",
    ],
    requirements: ["支援的手機", "已設定數位錢包", "生物識別或密碼"],
  },

  // 台灣特定
  ecpay: {
    displayName: "綠界支付",
    description: "台灣本地綜合支付平台",
    fullDescription:
      "綠界科技提供的整合支付服務，支援信用卡、ATM 轉帳、超商代碼等多種付款方式。",
    iconComponent: BanknotesIcon,
    processingTime: "即時至3天",
    features: ["multi_method", "convenience_store"],
    recommended: true,
    disabled: false,
  },

  line_pay: {
    displayName: "LINE Pay",
    description: "使用 LINE 應用程式付款",
    fullDescription:
      "LINE 官方支付服務，可使用 LINE Points 或綁定的信用卡付款。",
    iconComponent: DevicePhoneMobileIcon,
    processingTime: "即時",
    features: ["app_based", "points_reward"],
    recommended: false,
    disabled: false,
  },

  // 馬來西亞特定
  fpx: {
    displayName: "FPX",
    description: "馬來西亞銀行直接扣款",
    fullDescription:
      "Financial Process Exchange，馬來西亞央行推出的即時銀行轉帳系統。",
    iconComponent: BuildingLibraryIcon,
    processingTime: "即時",
    features: ["bank_direct", "real_time"],
    recommended: true,
    disabled: false,
  },

  touch_n_go: {
    displayName: "Touch 'n Go",
    description: "馬來西亞電子錢包",
    fullDescription: "馬來西亞最受歡迎的電子錢包之一，廣泛用於交通和日常消費。",
    iconComponent: DevicePhoneMobileIcon,
    processingTime: "即時",
    features: ["ewallet", "qr_code"],
    recommended: true,
    disabled: false,
  },

  grab_pay: {
    displayName: "GrabPay",
    description: "Grab 應用程式內建錢包",
    fullDescription: "Grab 提供的數位錢包服務，在東南亞地區廣泛使用。",
    iconComponent: DevicePhoneMobileIcon,
    processingTime: "即時",
    features: ["app_based", "rewards"],
    recommended: false,
    disabled: false,
  },

  // 越南特定
  momo: {
    displayName: "MoMo",
    description: "越南領先的電子錢包",
    fullDescription:
      "MoMo 是越南最大的電子錢包平台之一，提供安全便捷的付款體驗。",
    iconComponent: DevicePhoneMobileIcon,
    processingTime: "即時",
    features: ["ewallet", "qr_code", "bank_link"],
    recommended: true,
    disabled: false,
  },

  zalo_pay: {
    displayName: "ZaloPay",
    description: "Zalo 生態系統的支付服務",
    fullDescription:
      "ZaloPay 是 Zalo 公司推出的數位錢包，在越南具有廣泛的用戶基礎。",
    iconComponent: DevicePhoneMobileIcon,
    processingTime: "即時",
    features: ["social_pay", "qr_code"],
    recommended: false,
    disabled: false,
  },

  viet_qr: {
    displayName: "VietQR",
    description: "越南統一 QR 碼支付",
    fullDescription: "越南國家支付公司推出的 QR 碼支付標準，支援所有參與銀行。",
    iconComponent: QrCodeIcon,
    processingTime: "即時",
    features: ["qr_code", "universal", "bank_support"],
    recommended: true,
    disabled: false,
  },

  vnpay: {
    displayName: "VNPay",
    description: "越南綜合支付平台",
    fullDescription: "越南領先的支付閘道，支援多種銀行和支付方式。",
    iconComponent: BanknotesIcon,
    processingTime: "即時",
    features: ["multi_bank", "comprehensive"],
    recommended: false,
    disabled: false,
  },

  newebpay: {
    displayName: "藍新金流",
    description: "台灣藍新金流支付",
    fullDescription: "台灣知名的第三方支付服務，支援多種付款方式。",
    iconComponent: CreditCardIconSolid,
    processingTime: "即時",
    features: ["multi_payment"],
    recommended: false,
    disabled: false,
  },

  unipay: {
    displayName: "統一支付",
    description: "統一集團支付服務",
    fullDescription: "統一集團旗下的支付服務，整合多種支付管道。",
    iconComponent: CreditCardIconSolid,
    processingTime: "即時",
    features: ["unified"],
    recommended: false,
    disabled: false,
  },

  touch_n_go_direct: {
    displayName: "Touch 'n Go Direct",
    description: "Touch 'n Go 直接付款",
    fullDescription: "Touch 'n Go 電子錢包直接付款，無需 QR 碼掃描。",
    iconComponent: DevicePhoneMobileIcon,
    processingTime: "即時",
    features: ["direct_payment"],
    recommended: false,
    disabled: false,
  },

  cash: {
    displayName: "現金付款",
    description: "到店現金付款",
    fullDescription: "到餐廳現場使用現金付款。適合不方便線上付款的顧客。",
    iconComponent: BanknotesIcon,
    processingTime: "到店時",
    features: ["in_person"],
    recommended: false,
    disabled: false,
  },
};

// 計算可用方式的詳細資訊
const availableMethodsWithDetails = computed(() => {
  return props.availableMethods
    .map((method) => {
      const config = paymentMethodsConfig[method];
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
  const labels: Record<string, string> = {
    "3d_secure": "3D安全驗證",
    auto_retry: "自動重試",
    refund: "支援退款",
    biometric: "生物識別",
    quick_pay: "快速付款",
    multi_method: "多種方式",
    convenience_store: "超商代碼",
    app_based: "App付款",
    points_reward: "點數回饋",
    bank_direct: "銀行直扣",
    real_time: "即時到帳",
    ewallet: "電子錢包",
    qr_code: "QR碼",
    rewards: "回饋優惠",
    bank_link: "銀行連結",
    social_pay: "社交支付",
    universal: "通用標準",
    bank_support: "銀行支援",
    multi_bank: "多銀行",
    comprehensive: "綜合平台",
    manual_verify: "人工核實",
    in_person: "現場付款",
  };

  return labels[feature] || feature;
};

const getRegionalHintTitle = (): string => {
  const titles = {
    TW: "台灣用戶推薦",
    MY: "馬來西亞用戶推薦",
    VN: "越南用戶推薦",
  };
  return titles[props.country] || "推薦支付方式";
};

const getRegionalHintMessage = (): string => {
  const messages = {
    TW: "信用卡和綠界支付在台灣使用最為廣泛，LINE Pay 也很受歡迎。",
    MY: "FPX 銀行轉帳和 Touch 'n Go 電子錢包是馬來西亞用戶的首選。",
    VN: "MoMo 和 VietQR 是越南最受歡迎的電子支付方式。",
  };
  return messages[props.country] || "選擇最適合您的支付方式。";
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
