<template>
  <div class="bank-transfer-info">
    <div class="info-header">
      <div class="bank-icon">
        <svg
          class="w-8 h-8 text-blue-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z"
          ></path>
        </svg>
      </div>
      <div class="info-title">
        <h3 class="title-text">{{ t("payment.bankTransfer.title") }}</h3>
        <p class="title-description">
          {{ t("payment.bankTransfer.subtitle") }}
        </p>
      </div>
    </div>

    <div class="transfer-details">
      <!-- Bank Information -->
      <div class="bank-details-section">
        <h4 class="section-title">{{ t("payment.bankTransfer.bankInfo") }}</h4>

        <div class="detail-grid">
          <div class="detail-item">
            <span class="detail-label">{{
              t("payment.bankTransfer.bankName")
            }}</span>
            <div class="detail-value-container">
              <span class="detail-value">{{ bankInfo.bankName }}</span>
              <button
                class="copy-button"
                :title="t('payment.bankTransfer.copyBankName')"
                @click="copyToClipboard(bankInfo.bankName)"
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
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  ></path>
                </svg>
              </button>
            </div>
          </div>

          <div class="detail-item">
            <span class="detail-label">{{
              t("payment.bankTransfer.bankCode")
            }}</span>
            <div class="detail-value-container">
              <span class="detail-value font-mono">{{
                bankInfo.bankCode
              }}</span>
              <button
                class="copy-button"
                :title="t('payment.bankTransfer.copyBankCode')"
                @click="copyToClipboard(bankInfo.bankCode)"
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
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  ></path>
                </svg>
              </button>
            </div>
          </div>

          <div class="detail-item">
            <span class="detail-label">{{
              t("payment.bankTransfer.accountNumber")
            }}</span>
            <div class="detail-value-container">
              <span class="detail-value font-mono">{{
                bankInfo.accountNumber
              }}</span>
              <button
                class="copy-button"
                :title="t('payment.bankTransfer.copyAccountNumber')"
                @click="copyToClipboard(bankInfo.accountNumber)"
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
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  ></path>
                </svg>
              </button>
            </div>
          </div>

          <div class="detail-item">
            <span class="detail-label">{{
              t("payment.bankTransfer.accountName")
            }}</span>
            <div class="detail-value-container">
              <span class="detail-value">{{ bankInfo.accountName }}</span>
              <button
                class="copy-button"
                :title="t('payment.bankTransfer.copyAccountName')"
                @click="copyToClipboard(bankInfo.accountName)"
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
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                  ></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Transfer Instructions -->
      <div class="instructions-section">
        <h4 class="section-title">
          {{ t("payment.bankTransfer.instructions") }}
        </h4>
        <div class="instructions-list">
          <div class="instruction-item">
            <div class="instruction-step">1</div>
            <div class="instruction-content">
              <p class="instruction-title">
                {{ t("payment.bankTransfer.step1Title") }}
              </p>
              <p class="instruction-description">
                {{ t("payment.bankTransfer.step1Desc") }}
              </p>
            </div>
          </div>

          <div class="instruction-item">
            <div class="instruction-step">2</div>
            <div class="instruction-content">
              <p class="instruction-title">
                {{ t("payment.bankTransfer.step2Title") }}
              </p>
              <p class="instruction-description">
                {{ t("payment.bankTransfer.step2Desc") }}
              </p>
            </div>
          </div>

          <div class="instruction-item">
            <div class="instruction-step">3</div>
            <div class="instruction-content">
              <p class="instruction-title">
                {{ t("payment.bankTransfer.step3Title") }}
              </p>
              <p class="instruction-description">
                {{ t("payment.bankTransfer.step3Desc")
                }}<span class="highlight-text">{{ orderReference }}</span>
              </p>
            </div>
          </div>

          <div class="instruction-item">
            <div class="instruction-step">4</div>
            <div class="instruction-content">
              <p class="instruction-title">
                {{ t("payment.bankTransfer.step4Title") }}
              </p>
              <p class="instruction-description">
                {{ t("payment.bankTransfer.step4Desc") }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Important Notice -->
      <div class="notice-section">
        <div class="notice-header">
          <svg
            class="w-5 h-5 text-amber-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.996-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
            ></path>
          </svg>
          <span class="notice-title">{{
            t("payment.bankTransfer.importantNotice")
          }}</span>
        </div>
        <div class="notice-content">
          <ul class="notice-list">
            <li>{{ t("payment.bankTransfer.notice1") }}</li>
            <li>{{ t("payment.bankTransfer.notice2") }}</li>
            <li>
              {{ t("payment.bankTransfer.notice3", { hours: processingTime }) }}
            </li>
            <li>{{ t("payment.bankTransfer.notice4") }}</li>
          </ul>
        </div>
      </div>

      <!-- QR Code (if available) -->
      <div v-if="showQRCode && bankInfo.qrCode" class="qr-section">
        <h4 class="section-title">{{ t("payment.bankTransfer.qrTitle") }}</h4>
        <div class="qr-container">
          <div class="qr-code">
            <img
              :src="bankInfo.qrCode"
              :alt="`${bankInfo.bankName} QR Code`"
              class="qr-image"
            />
          </div>
          <p class="qr-description">
            {{ t("payment.bankTransfer.qrDescription") }}
          </p>
        </div>
      </div>
    </div>

    <!-- Copy Success Toast -->
    <Transition name="toast">
      <div v-if="showCopyToast" class="copy-toast">
        <svg
          class="w-4 h-4 text-green-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M5 13l4 4L19 7"
          ></path>
        </svg>
        <span>{{ t("payment.bankTransfer.copied") }}</span>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useI18n } from "@/i18n";
import type { CountryCode } from "@makanmasak/shared-types";

// Props
interface Props {
  country: CountryCode;
  orderReference?: string;
  showQRCode?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  orderReference: "ORDER_123456789",
  showQRCode: true,
});

const { t } = useI18n();

// Reactive state
const showCopyToast = ref(false);

// Computed properties
const bankInfo = computed(() => {
  const bankConfigs = {
    TW: {
      bankName: "台灣銀行",
      bankCode: "004",
      accountNumber: "123-456-789012",
      accountName: "MakanMasak Food Service Co., Ltd.",
      qrCode: "/images/bank-qr-tw.png",
    },
    MY: {
      bankName: "Maybank",
      bankCode: "MBB0227",
      accountNumber: "1234567890123456",
      accountName: "MakanMasak Sdn Bhd",
      qrCode: "/images/bank-qr-my.png",
    },
    VN: {
      bankName: "Vietcombank",
      bankCode: "VCB",
      accountNumber: "0123456789012345",
      accountName: "MakanMasak Vietnam Co., Ltd.",
      qrCode: "/images/bank-qr-vn.png",
    },
  };

  return bankConfigs[props.country] || bankConfigs.TW;
});

const processingTime = computed(() => {
  const processingTimes = {
    TW: 24,
    MY: 48,
    VN: 72,
  };
  return processingTimes[props.country] || 24;
});

// Methods
const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text);
    showCopyToast.value = true;

    // Hide toast after 2 seconds
    setTimeout(() => {
      showCopyToast.value = false;
    }, 2000);
  } catch (error) {
    console.error("Failed to copy to clipboard:", error);
    // Fallback for older browsers
    fallbackCopyToClipboard(text);
  }
};

const fallbackCopyToClipboard = (text: string) => {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.left = "-999999px";
  textArea.style.top = "-999999px";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  try {
    document.execCommand("copy");
    showCopyToast.value = true;
    setTimeout(() => {
      showCopyToast.value = false;
    }, 2000);
  } catch (error) {
    console.error("Fallback copy failed:", error);
  }

  document.body.removeChild(textArea);
};

// Lifecycle
onMounted(() => {
  // Any initialization if needed
});
</script>

<style scoped>
/* Main container */
.bank-transfer-info {
  @apply space-y-6 relative;
}

/* Header */
.info-header {
  @apply flex items-start space-x-4 p-6 bg-blue-50 rounded-xl border border-blue-100;
}

.bank-icon {
  @apply flex-shrink-0 p-2 bg-blue-100 rounded-lg;
}

.info-title {
  @apply flex-1;
}

.title-text {
  @apply text-lg font-semibold text-blue-900;
}

.title-description {
  @apply text-blue-700 text-sm mt-1;
}

/* Transfer details */
.transfer-details {
  @apply space-y-6;
}

/* Section styles */
.section-title {
  @apply font-semibold text-gray-900 text-base mb-4;
}

/* Bank details */
.bank-details-section {
  @apply space-y-4;
}

.detail-grid {
  @apply grid grid-cols-1 md:grid-cols-2 gap-4;
}

.detail-item {
  @apply space-y-2;
}

.detail-label {
  @apply text-sm font-medium text-gray-600;
}

.detail-value-container {
  @apply flex items-center justify-between p-3 bg-gray-50 rounded-lg border;
}

.detail-value {
  @apply text-gray-900 font-medium flex-1;
}

.copy-button {
  @apply p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 
         rounded-md transition-colors duration-200
         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1;
}

/* Instructions */
.instructions-section {
  @apply space-y-4;
}

.instructions-list {
  @apply space-y-4;
}

.instruction-item {
  @apply flex items-start space-x-4;
}

.instruction-step {
  @apply w-8 h-8 bg-blue-600 text-white rounded-full 
         flex items-center justify-center text-sm font-semibold
         flex-shrink-0;
}

.instruction-content {
  @apply flex-1 space-y-1;
}

.instruction-title {
  @apply font-medium text-gray-900;
}

.instruction-description {
  @apply text-sm text-gray-600;
}

.highlight-text {
  @apply font-mono bg-yellow-100 text-yellow-800 px-2 py-1 rounded;
}

/* Notice section */
.notice-section {
  @apply bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3;
}

.notice-header {
  @apply flex items-center space-x-2;
}

.notice-title {
  @apply font-semibold text-amber-800;
}

.notice-content {
  @apply text-amber-700;
}

.notice-list {
  @apply list-disc list-inside space-y-1 text-sm;
}

/* QR Code section */
.qr-section {
  @apply space-y-4;
}

.qr-container {
  @apply text-center space-y-3;
}

.qr-code {
  @apply inline-block p-4 bg-white border-2 border-gray-200 rounded-xl shadow-sm;
}

.qr-image {
  @apply w-32 h-32 object-contain;
}

.qr-description {
  @apply text-sm text-gray-600 max-w-md mx-auto;
}

/* Copy toast */
.copy-toast {
  @apply fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg
         flex items-center space-x-2 shadow-lg z-50;
}

/* Toast transitions */
.toast-enter-active,
.toast-leave-active {
  @apply transition-all duration-300;
}

.toast-enter-from {
  @apply transform translate-x-full opacity-0;
}

.toast-leave-to {
  @apply transform translate-x-full opacity-0;
}

/* Responsive design */
@media (max-width: 768px) {
  .detail-grid {
    @apply grid-cols-1;
  }

  .info-header {
    @apply flex-col space-x-0 space-y-3 text-center;
  }

  .instruction-item {
    @apply flex-col space-x-0 space-y-3 text-center;
  }

  .instruction-step {
    @apply self-center;
  }

  .copy-toast {
    @apply bottom-2 right-2 text-sm px-3 py-2;
  }
}

/* Print styles */
@media print {
  .copy-button {
    @apply hidden;
  }

  .copy-toast {
    @apply hidden;
  }

  .qr-section {
    @apply hidden;
  }
}

/* High contrast mode */
@media (prefers-contrast: high) {
  .copy-button:hover {
    @apply bg-blue-200;
  }

  .instruction-step {
    @apply bg-blue-800;
  }
}

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  .copy-button,
  .toast-enter-active,
  .toast-leave-active {
    @apply transition-none;
  }
}
</style>
